/* eslint-disable no-use-before-define */

import { createDirectStore } from 'direct-vuex';
import Vue from 'vue';
import Vuex from 'vuex';
import vtkProxyManager from 'vtk.js/Sources/Proxy/Core/ProxyManager';
import { InterpolationType } from 'vtk.js/Sources/Rendering/Core/ImageProperty/Constants';

import '../utils/registerReaders';

import readImageArrayBuffer from 'itk/readImageArrayBuffer';
// https://github.com/InsightSoftwareConsortium/itk-wasm/blob/master/src/core/WorkerPool.ts
import WorkerPool from 'itk/WorkerPool';
import ITKHelper from 'vtk.js/Sources/Common/DataModel/ITKHelper';
import djangoRest, { apiClient } from '@/django';
import {
  Project, ProjectTaskOverview, User, ProjectSettings, Scan,
} from '@/types';
import axios from 'axios';
import ReaderFactory from '../utils/ReaderFactory';

import { proxy } from '../vtk';
import { getView } from '../vtk/viewManager';
import { ijkMapping } from '../vtk/constants';

const { convertItkToVtkImage } = ITKHelper;

Vue.use(Vuex);

const fileCache = new Map();
const frameCache = new Map();
let readDataQueue = [];
const loadedData = [];
const pendingFrameDownloads = new Set<any>();
const poolSize = Math.floor(navigator.hardwareConcurrency / 2) || 2;
let taskRunId = -1;
let savedWorker = null;

/** Delete existing VTK.js proxyManager views */
function shrinkProxyManager(proxyManager: vtkProxyManager) {
  proxyManager.getViews().forEach((view) => {
    view.setContainer(null);
    proxyManager.deleteProxy(view);
  });
}

/** Disable Axes visibility, sets InterpolationType to nearest and renders each view */
function prepareProxyManager(proxyManager: vtkProxyManager) {
  if (!proxyManager.getViews().length) {
    ['View2D_Z:z', 'View2D_X:x', 'View2D_Y:y'].forEach((type) => {
      const view = getView(proxyManager, type);
      view.setOrientationAxesVisibility(false);
      view.getRepresentations().forEach((representation) => {
        representation.setInterpolationType(InterpolationType.NEAREST);
        representation.onModified(() => {
          view.render(true);
        });
      });
    });
  }
}

/**
 * Array name is file name minus last extension
 *
 * e.g. image.nii.gz => image.nii
 *
 * @param filename
 */
function getArrayName(filename) {
  const idx = filename.lastIndexOf('.');
  const name = idx > -1 ? filename.substring(0, idx) : filename;
  return `Scalars ${name}`;
}

/**
 * Load image data from cache or file
 *
 * 1. Checks cache for copy
 * 2. Loads from cache or server
 * 3. Reads image using ITK
 * 4. Converts image from ITK to VTK
 * 5. ...
 *
 * @param frameId     String  Frame ID to load
 * @param file        Object  File to load
 * @param webWorker
 */
function getData(frameId, file, webWorker = null) {
  return new Promise((resolve, reject) => {
    // Load image from frame cache if available, this resolves promise
    if (frameCache.has(frameId)) {
      resolve({ frameData: frameCache.get(frameId), webWorker });
    } else {
      const fileName = file.name;
      const io = new FileReader();

      // This won't run until io indicates it has loaded the file.
      io.onload = function onLoad() {
        // Read image with ITK
        readImageArrayBuffer(webWorker, io.result, fileName)
          .then(({ webWorker, image }) => { // eslint-disable-line no-shadow
            // Convert ITK to VTK image uses below from vtk.js:
            // https://github.com/Kitware/vtk-js/blob/master/Sources/Common/DataModel/ITKHelper/index.js
            const frameData = convertItkToVtkImage(image, {
              scalarArrayName: getArrayName(fileName),
            });
            const dataRange = frameData
              .getPointData() // From the image file
              .getArray(0) // Values in the file
              .getRange(); // Range of values in the file, e.g. [0, 3819]
            // Add frame to frameCache
            frameCache.set(frameId, { frameData });
            // eslint-disable-next-line no-use-before-define
            expandScanRange(frameId, dataRange); // Example dataRange: [0, 3819]
            resolve({ frameData, webWorker });
          })
          .catch((error) => {
            reject(error);
          });
      };

      io.readAsArrayBuffer(file);
    }
  });
}

/**
 * Load file, from cache if possible
 *
 * Only called by loadFileAndGetData
 *
 * @param frame Frame object
 * @param onDownloadProgress
 */
function loadFile(frame, { onDownloadProgress = null } = {}) {
  // If frame is cached, return it
  if (fileCache.has(frame.id)) {
    return { frameId: frame.id, cachedFile: fileCache.get(frame.id) };
  }
  // Otherwise download the frame
  let client = apiClient;
  let downloadURL = `/frames/${frame.id}/download`;
  if (frame.download_url) {
    client = axios.create();
    downloadURL = frame.download_url;
  }
  // ReaderFactory is from utils/ReaderFactory, it returns a promise which resolves to a downloaded file
  // TODO: Why are we adding the promise to fileCache and returning it before it has resolved?
  // TODO: Couldn't we use `.then` on promise so that these are only triggered once the file is resolved?
  const { promise } = ReaderFactory.downloadFrame(
    client,
    `image${frame.extension}`,
    downloadURL,
    { onDownloadProgress },
  );
  fileCache.set(frame.id, promise);
  return { frameId: frame.id, cachedFile: promise };
}

/**
 * Gets the data from the selected image file using a webWorker.
 *
 * Only called by swapToFrame
 *
 * @param frame Frame Object
 * @param onDownloadProgress
 */
function loadFileAndGetData(frame, { onDownloadProgress = null } = {}) {
  const loadResult = loadFile(frame, { onDownloadProgress });
  // Once the file has been cached and is available, call getData
  // Who is `savedWorker`?
  return loadResult.cachedFile
    .then((file) => getData(frame.id, file, savedWorker))
    .then(({ webWorker, frameData }) => {
      savedWorker = webWorker;
      return Promise.resolve({ frameData });
    })
    .catch(() => {
      const msg = 'loadFileAndGetData caught error getting data';
      return Promise.reject(msg);
    })
    .finally(() => {
      if (savedWorker) {
        savedWorker.terminate();
        savedWorker = null;
      }
    });
}

/**
 * Use a worker to download image files
 *
 * Only used by WorkerPool
 *
 * @param webWorker
 * @param taskInfo  Object  Contains experimentId, scanId, and a frame object
 */
// Where is poolFunction ever called with parameters?
function poolFunction(webWorker, taskInfo) {
  return new Promise((resolve, reject) => {
    const { frame } = taskInfo;

    let filePromise = null;

    // Load file from cache if available
    if (fileCache.has(frame.id)) {
      filePromise = fileCache.get(frame.id);
    } else { // Download image file
      let client = apiClient;
      let downloadURL = `/frames/${frame.id}/download`;
      if (frame.download_url) {
        client = axios.create();
        downloadURL = frame.download_url;
      }
      const download = ReaderFactory.downloadFrame(
        client,
        `image${frame.extension}`,
        downloadURL,
      );
      filePromise = download.promise; // Initial this will be a promise
      fileCache.set(frame.id, filePromise); // So we are setting fileCache to contain a promise?
      pendingFrameDownloads.add(download); // Adds to Set of all pending downloads
      filePromise // Delete from pending downloads once resolved/rejected
        .then(() => {
          pendingFrameDownloads.delete(download);
        }).catch(() => {
          pendingFrameDownloads.delete(download);
        });
    }

    // TODO: Could me moved into filePromise above or no?
    filePromise
      .then((file) => {
        resolve(getData(frame.id, file, webWorker));
      })
      .catch((err) => {
        reject(err);
      });
  });
}

/**
 * Calculates the percent downloaded of currently loading frames
 *
 * TODO: Should this be a mutation?
 *
 * @param completed
 * @param total
 */
function progressHandler(completed, total) {
  const percentComplete = completed / total;
  store.commit.setScanCachedPercentage(percentComplete);
}

/**
 * Creates array of tasks to run then runs tasks in parallel
 *
 * Only called by queueLoadScan
 */
function startReaderWorkerPool() {
  // Get the current array of tasks
  const taskArgsArray = readDataQueue.map((taskInfo) => [taskInfo]);
  // Reset the current array of tasks in readDataQueue
  readDataQueue = [];

  // https://github.com/InsightSoftwareConsortium/itk-wasm/blob/master/src/core/WorkerPool.ts
  // `runId` is WorkerPool.runInfo.length -1.
  const { runId, promise } = store.state.workerPool.runTasks(
    taskArgsArray,
    progressHandler,
  );
  // The number of tasks still running
  taskRunId = runId;

  promise
    .then(() => {
      // Indicates no tasks are running
      taskRunId = -1;
    })
    .catch((err) => {
      console.error(err);
    })
    .finally(() => {
      store.state.workerPool.terminateWorkers();
    });
}

/**
 * Queues scans for download
 *
 * @param scan      Scan
 * @param loadNext  Boolean
 */
function queueLoadScan(scan, loadNext = false) {
  // load all frames in target scan
  // If the scan has not already been loaded
  if (!loadedData.includes(scan.id)) {
    // For each  scan in scanFrames
    store.state.scanFrames[scan.id].forEach(
      (frameId) => {
        // Add to readDataQueue a request to get the frames associated with that scan
        readDataQueue.push({
          experimentId: scan.experiment,
          scanId: scan.id,
          frame: store.state.frames[frameId],
        });
      },
    );
    loadedData.push(scan.id);
  }

  // semi-recursive; we only recurse on the first call
  // to queue up the next scan as well
  // to prefetch further ahead, modify the recursion
  if (loadNext) {
    const scansInSameExperiment = store.state.experimentScans[scan.experiment];
    let nextScan;
    if (scan.id === scansInSameExperiment[scansInSameExperiment.length - 1]) {
      // load first scan in next experiment
      const experimentIds = Object.keys(store.state.experimentScans);
      const nextExperimentId = experimentIds[experimentIds.indexOf(scan.experiment) + 1];
      const nextExperimentScans = store.state.experimentScans[nextExperimentId];
      if (nextExperimentScans && nextExperimentScans.length > 0) {
        nextScan = store.state.allScans[
          nextExperimentScans[0]
        ];
      }
    } else {
      // load next scan in same experiment
      nextScan = store.state.allScans[scansInSameExperiment[
        scansInSameExperiment.indexOf(scan.id) + 1
      ]];
    }
    if (nextScan) queueLoadScan(nextScan);
    startReaderWorkerPool();
  }
}

/**
 * Get next frame in specific experiment/scan
 *
 * @param experiments         Pass in all the experiments associated with the project
 * @param experimentIndex     The specific index of the experiment we are looking for
 * @param scanIndex           The specific index of the scan from the specified experiment
 */
function getNextFrame(experiments, experimentIndex, scanIndex) {
  const experiment = experiments[experimentIndex];
  const { scans } = experiment;

  if (scanIndex === scans.length - 1) {
    // last scan, go to next experiment
    if (experimentIndex === experiments.length - 1) {
      // last experiment, nowhere to go
      return null;
    }
    // get first scan in next experiment
    const nextExperiment = experiments[experimentIndex + 1];
    const nextScan = nextExperiment.scans[0]; // Get the first scan in the nextExperiment
    return nextScan.frames[0]; // Get the first frame in the nextScan
  }
  // get next scan in current experiment
  const nextScan = scans[scanIndex + 1];
  return nextScan.frames[0];
}

/**
 * Expands individual scan range
 *
 * If the range (e.g. [0, 3819] in a scan is <> the range read from data,
 * ensure that the ranges match
 *
 * Only called by `getData`
 *
 * @param frameId
 * @param dataRange Array
 */
function expandScanRange(frameId, dataRange) {
  // If we have a frame
  if (frameId in store.state.frames) {
    // Get the scanId from the frame.
    const scanId = store.state.frames[frameId].scan;
    // Get the scan of specified scanId
    const scan = store.state.scans[scanId];
    if (scan && dataRange[0] < scan.cumulativeRange[0]) {
      [scan.cumulativeRange[0]] = dataRange;
    }
    if (scan && dataRange[1] > scan.cumulativeRange[1]) {
      [, scan.cumulativeRange[1]] = dataRange;
    }
  }
}

const initState = {
  MIQAConfig: {},
  me: null,
  allUsers: [],
  reviewMode: false,
  globalSettings: undefined as ProjectSettings,
  currentProject: undefined as Project | null,
  currentTaskOverview: null as ProjectTaskOverview | null,
  currentProjectPermissions: {},
  projects: [] as Project[],
  allScans: {},
  experimentIds: [],
  experiments: {},
  experimentScans: {},
  scans: {},
  scanFrames: {},
  frames: {},
  proxyManager: null,
  vtkViews: [],
  currentFrameId: null,
  loadingFrame: false,
  errorLoadingFrame: false,
  loadingExperiment: false,
  currentScreenshot: null,
  screenshots: [],
  scanCachedPercentage: 0,
  showCrosshairs: true,
  storeCrosshairs: true,
  sliceLocation: {},
  iIndexSlice: 0,
  jIndexSlice: 0,
  kIndexSlice: 0,
  currentWindowWidth: 256,
  currentWindowLevel: 150,
  windowLocked: {
    lock: false,
    duration: undefined,
    target: undefined,
    associatedImage: undefined,
  },
  renderOrientation: 'LPS',
};

const {
  store,
  rootActionContext,
  moduleActionContext,
  rootGetterContext,
  moduleGetterContext,
} = createDirectStore({
  strict: true, // TODO: turn off for production
  state: {
    ...initState,
    // WorkerPool creates a pool of poolSize that utilizes poolFunction to process
    // See: https://github.com/InsightSoftwareConsortium/itk-wasm/blob/master/src/core/WorkerPoolFunction.ts
    workerPool: new WorkerPool(poolSize, poolFunction),
    lastApiRequestTime: Date.now(),
  },

  // Getters in Vuex always take in all the state as their first parameter.
  getters: {
    /**
     * Returns data related to the current view's project, experiments, scans,
     * frames, and auto-evaluation.
     *
     * @returns Object
     */
    currentViewData(state) {
      // Get the current frame
      const currentFrame = state.currentFrameId ? state.frames[state.currentFrameId] : null;
      // Get the scan for the current frame
      const scan = currentFrame ? state.scans[currentFrame.scan] : undefined;
      if (!scan) {
        // scan was removed from list by review mode; do nothing
        return {};
      }
      // Get information about experiment associated with current frame
      const experiment = currentFrame.experiment
        ? state.experiments[currentFrame.experiment] : null;
      // Get the project associated with current experiment
      const project = state.projects.filter((x) => x.id === experiment.project)[0];
      // Get list of scans for current experiment
      const experimentScansList = state.experimentScans[experiment.id];
      // Get list of frames associated with current scan
      const scanFramesList = state.scanFrames[scan.id];
      // ?
      let upTo = currentFrame.firstFrameInPreviousScan;
      let downTo = currentFrame.firstFrameInNextScan;
      if (upTo && !Object.keys(state.scans).includes(state.frames[upTo].scan)) {
        upTo = null;
      }
      if (downTo && !Object.keys(state.scans).includes(state.frames[downTo].scan)) {
        downTo = null;
      }
      return {
        projectId: project.id,
        projectName: project.name,
        experimentId: experiment.id,
        experimentName: experiment.name,
        experimentNote: experiment.note,
        lockOwner: experiment.lock_owner || experiment.lockOwner,
        scanId: scan.id,
        scanName: scan.name,
        scanSession: scan.sessionID,
        scanSubject: scan.subjectID,
        scanLink: scan.link,
        scanDecisions: scan.decisions,
        scanPositionString: `(${experimentScansList.indexOf(scan.id) + 1}/${experimentScansList.length})`,
        framePositionString: `(${scanFramesList.indexOf(currentFrame.id) + 1}/${scanFramesList.length})`,
        backTo: currentFrame.previousFrame,
        forwardTo: currentFrame.nextFrame,
        upTo,
        downTo,
        currentFrame,
        currentAutoEvaluation: currentFrame.frame_evaluation,
      };
    },
    /** Gets the current frame when given a frameId */
    currentFrame(state) {
      return state.currentFrameId ? state.frames[state.currentFrameId] : null;
    },
    /** Gets the previous frame based on the currentFrame */
    previousFrame(state, getters) {
      return getters.currentFrame
        ? getters.currentFrame.previousFrame
        : null;
    },
    /** Gets the next frame based on the currentFrame */
    nextFrame(state, getters) {
      return getters.currentFrame ? getters.currentFrame.nextFrame : null;
    },
    /** Gets the current scan via the currentFrame */
    currentScan(state, getters) {
      if (getters.currentFrame) {
        const curScanId = getters.currentFrame.scan;
        return state.scans[curScanId];
      }
      return null;
    },
    /** Gets the currentExperiment via the currentScan */
    currentExperiment(state, getters) {
      if (getters.currentScan) {
        const curExperimentId = getters.currentScan.experiment;
        return state.experiments[curExperimentId];
      }
      return null;
    },
    /** Enumerates permissions of logged-in user */
    myCurrentProjectRoles(state) {
      const projectPerms = Object.entries(state.currentProjectPermissions)
        .filter((entry: [string, Array<User>]): Boolean => entry[1].map(
          (user) => user.username,
        ).includes(state.me.username))
        .map((entry) => entry[0]);
      if (state.me.is_superuser) {
        projectPerms.push('superuser');
      }
      return projectPerms;
    },
    /** Returns true if no project has been selected */
    isGlobal(state) {
      return state.currentProject === null;
    },
  },
  mutations: {
    /** Resets all state to that set in initState */
    reset(state) {
      Object.assign(state, { ...state, ...initState });
    },
    /**
     * Sets state.MIQAConfig equal to configuration pulled from API
     *
     * @param state         The whole state for the MIQA Vuex store
     * @param configuration The configuration object as received from Django API
     */
    setMIQAConfig(state, configuration) {
      state.MIQAConfig = configuration;
    },
    /**
     * Sets state.me to me received from API
     *
     * @param state Whole state associated with MIQA Vuex Store
     * @param me    Me object received from Django API
     */
    setMe(state, me) {
      state.me = me;
    },
    /**
     * Sets state.allUsers to allUsers pulled from API
     *
     * @param state
     * @param allUsers
     */
    setAllUsers(state, allUsers) {
      state.allUsers = allUsers;
    },
    /**
     * Resets project state when loading a new project
     *
     * Only called by loadProject
     *
     * @param state
     */
    resetProject(state) {
      state.experimentIds = [];
      state.experiments = {};
      state.experimentScans = {};
      state.scans = {};
      state.scanFrames = {};
      state.frames = {};
    },
    /**
     * Sets state.currentFrameId to a passed in frameId
     *
     * @param state
     * @param frameId
     */
    setCurrentFrameId(state, frameId) {
      state.currentFrameId = frameId;
    },
    /**
     * Sets a specific index within the frames array to a specified frame
     *
     * @param state
     * @param frameId Id of passed in frame
     * @param frame   Frame object
     */
    setFrame(state, { frameId, frame }) {
      // Replace with a new object to trigger a Vuex update
      state.frames = { ...state.frames }; // Why do we pass in the frameId when we can access it from frame.id?
      state.frames[frameId] = frame;
    },
    /**
     * Adds a scan to state.scans, then adds state.scans to allScans
     *
     * @param state
     * @param scanId  Id of a specific scan
     * @param scan    Scan
     */
    setScan(state, { scanId, scan }) {
      // Replace with a new object to trigger a Vuex update
      state.scans = { ...state.scans };
      state.scans[scanId] = scan;
      state.allScans = Object.assign(state.allScans, state.scans);
    },
    /**
     * Set the renderOrientation
     *
     * Only called by `ProjectSettings.vue` when saving a project's settings.
     *
     * @param state
     * @param anatomy
     */
    setRenderOrientation(state, anatomy) {
      state.renderOrientation = anatomy;
    },
    /**
     * Sets state.currentProject
     *
     * Also sets state.renderOrientation and state.currentProjectPermissions
     *
     * @param state
     * @param project Project A specific Project instance
     */
    setCurrentProject(state, project: Project | null) {
      state.currentProject = project; // We pass the entire Project Object here, not just its Id?
      if (project) {
        state.renderOrientation = project.settings.anatomy_orientation;
        state.currentProjectPermissions = project.settings.permissions;
      }
    },
    /**
     * Sets state.globalSettings to settings pulled from API
     *
     * @param state
     * @param settings  Settings from Django API
     */
    setGlobalSettings(state, settings) {
      state.globalSettings = settings;
    },
    /**
     * TODO
     * @param state
     * @param taskOverview  ProjectTaskOverview Instance of ProjectTaskOverview object
     */
    setTaskOverview(state, taskOverview: ProjectTaskOverview) {
      if (!taskOverview) return;
      // Calculates total scans and scans that have been marked complete
      if (taskOverview.scan_states) {
        state.projects.find(
          (project) => project.id === taskOverview.project_id,
        ).status = {
          total_scans: taskOverview.total_scans,
          total_complete: Object.values(taskOverview.scan_states).filter(
            (scanState) => scanState === 'complete',
          ).length,
        };
      }
      // If we have a value in state.currentProject, and it's id is equal to taskOverview's project_id then:
      if (state.currentProject && taskOverview.project_id === state.currentProject.id) {
        state.currentTaskOverview = taskOverview;
        // Iterate over allScans
        Object.values(store.state.allScans).forEach((scan: Scan) => {
          // If the scan exists and has been reviewed
          if (taskOverview.scan_states[scan.id] && taskOverview.scan_states[scan.id] !== 'unreviewed') {
            // Reload the scan
            store.dispatch.reloadScan(scan.id);
          }
        });
      }
    },
    /**
     * Sets state.projects to projects pulled from API
     *
     * @param state
     * @param projects
     */
    setProjects(state, projects: Project[]) {
      state.projects = projects;
    },
    /**
     * Adds a scanDecision to a scan
     *
     * @param state
     * @param currentScanId Id of the current scan
     * @param newDecision   A scan decision object
     */
    addScanDecision(state, { currentScanId, newDecision }) {
      state.scans[currentScanId].decisions.push(newDecision);
    },
    /**
     * Adds an evaluation to the current frame
     *
     * Note: We don't pass the frame, only the evaluation, we then append the value to `currentFrame`
     *
     * @param state
     * @param evaluation
     */
    setFrameEvaluation(state, evaluation) {
      const currentFrame = state.currentFrameId ? state.frames[state.currentFrameId] : null;
      if (currentFrame) {
        currentFrame.frame_evaluation = evaluation;
      }
    },
    /**
     * Sets state.currentScreenshot to the passed in screenshot
     *
     * Used by both `ScreenshotDialog.vue` and `VtkViewer.vue`
     *
     * @param state
     * @param screenshot
     */
    setCurrentScreenshot(state, screenshot) {
      state.currentScreenshot = screenshot;
    },
    /**
     * Adds a screenshot to state.screenshots
     *
     * Only called by `ScreenshotDialog.vue`
     *
     * @param state
     * @param screenshot
     */
    addScreenshot(state, screenshot) {
      state.screenshots.push(screenshot);
    },
    /**
     * Removes a screenshot from state.screenshots
     *
     * @param state
     * @param screenshot
     */
    removeScreenshot(state, screenshot) {
      state.screenshots.splice(state.screenshots.indexOf(screenshot), 1);
    },
    /**
     * Updates state.lastApiRequestTime to the current moment
     *
     * This is called by `django.ts` after an API called is made.
     *
     * @param state
     */
    updateLastApiRequestTime(state) {
      state.lastApiRequestTime = Date.now();
    },
    /**
     * Sets whether state.loadingFrame is true or false
     *
     * @param state
     * @param isLoading Boolean
     */
    setLoadingFrame(state, isLoading) {
      state.loadingFrame = isLoading;
    },
    /**
     * Sets whether state.errorLoadingFrame is true or false
     *
     * @param state
     * @param isErrorLoading Boolean
     */
    setErrorLoadingFrame(state, isErrorLoading) {
      state.errorLoadingFrame = isErrorLoading;
    },
    /**
     * Adds a scan ID, and it's corresponding Frame ID to state.scanFrames
     *
     * @param state
     * @param scanId Scan ID
     * @param frameId Frame ID
     */
    addScanFrames(state, { scanId, frameId }) { // TODO: Should this be addScanFrame or addScanToScanFrames?
      state.scanFrames[scanId].push(frameId);
    },
    /**
     * For each scan in Experiment, add it to state.experimentScans
     *
     * @param state
     * @param experimentId   Experiment ID
     * @param scanId         Scan ID
     */
    addExperimentScans(state, { experimentId, scanId }) {
      state.scanFrames[scanId] = []; // Why?
      state.experimentScans[experimentId].push(scanId);
    },
    /**
     * Add an experiment to state.experiments, it's id to state.experimentIds, and set
     * state.experimentScans to an empty array
     *
     * @param state
     * @param experimentId
     * @param experiment    Object  Instance of experiment
     */
    addExperiment(state, { experimentId, experiment }) {
      state.experimentScans[experimentId] = [];
      if (!state.experimentIds.includes(experimentId)) {
        state.experimentIds.push(experimentId);
      }
      state.experiments[experimentId] = experiment;
    },
    /**
     * Update state.experiments
     *
     * @param state
     * @param experiment
     */
    updateExperiment(state, experiment) {
      // Necessary for reactivity
      state.experiments = { ...state.experiments };
      state.experiments[experiment.id] = experiment;
    },
    /**
     * Ensures that a specific image is being reviewed by a single individual
     *
     * @param state
     * @param lockState Object  Instance of lockState object
     */
    setWindowLocked(state, lockState) {
      state.windowLocked = lockState;
    },
    /**
     * Set state.scanCachedPercentage equal to passed in percentage
     *
     * @param state
     * @param percentComplete Number A number representing the percentage of images that have been downloaded
     */
    setScanCachedPercentage(state, percentComplete) {
      state.scanCachedPercentage = percentComplete;
    },
    /**
     * Saves the location of a click related to a specific scan and decision
     *
     * @param state
     * @param ijkLocation Location of cursor click for a decision
     */
    setSliceLocation(state, ijkLocation) {
      if (Object.values(ijkLocation).every((value) => value !== undefined)) {
        state.vtkViews.forEach(
          (view) => {
            state.proxyManager.getRepresentation(null, view).setSlice(
              ijkLocation[ijkMapping[view.getName()]],
            );
          },
        );
      }
    },
    /**
     *
     * @param state
     * @param indexAxis
     * @param value
     */
    setCurrentVtkIndexSlices(state, { indexAxis, value }) {
      state[`${indexAxis}IndexSlice`] = value;
      state.sliceLocation = undefined;
    },
    /**
     * Toggle true/false for state.showCrosshairs
     *
     * @param state
     * @param show  Boolean
     */
    setShowCrosshairs(state, show) {
      state.showCrosshairs = show;
    },
    /**
     * Toggle true/false for state.storeCrosshairs
     *
     * @param state
     * @param value Boolean
     */
    setStoreCrosshairs(state, value) {
      state.storeCrosshairs = value;
    },
    /**
     * Toggles whether all scans or only unreviewed scans are shown
     *
     * @param state
     * @param mode  Boolean
     */
    switchReviewMode(state, mode) {
      state.reviewMode = mode || false;
      if (mode) {
        const myRole = state.currentTaskOverview.my_project_role;
        state.scans = Object.fromEntries(
          Object.entries(state.allScans).filter(
            ([scanId]) => {
              const scanState = state.currentTaskOverview.scan_states[scanId];
              switch (scanState) {
                case 'unreviewed':
                  return true;
                case 'complete':
                  return false;
                default:
                  return myRole === 'tier_2_reviewer';
              }
            },
          ),
        );
      } else {
        state.scans = state.allScans;
      }
    },
  },
  actions: {
    /**
     * Resets the Vuex state associated with MIQA, cancel any existing tasks in the workerPool, clear file and frame
     * caches
     *
     * @param state
     * @param commit
     */
    reset({ state, commit }) {
      if (taskRunId >= 0) {
        state.workerPool.cancel(taskRunId);
        taskRunId = -1;
      }
      commit('reset');
      fileCache.clear();
      frameCache.clear();
    },
    /** Pulls configuration from API and loads it into state */
    async loadConfiguration({ commit }) {
      const configuration = await djangoRest.MIQAConfig();
      commit('setMIQAConfig', configuration);
    },
    /** Pulls user from API and loads it into state */
    async loadMe({ commit }) {
      const me = await djangoRest.me();
      commit('setMe', me);
    },
    /** Pulls all users from API and loads into state */
    async loadAllUsers({ commit }) {
      const allUsers = await djangoRest.allUsers();
      commit('setAllUsers', allUsers.results);
    },
    /** Pulls global settings from API and updates currentProject and globalSettings in state */
    async loadGlobal({ commit }) {
      const globalSettings = await djangoRest.globalSettings();
      commit('setCurrentProject', null);
      commit('setGlobalSettings', {
        import_path: globalSettings.import_path,
        export_path: globalSettings.export_path,
      });
      commit('setTaskOverview', {});
    },
    /** Pulls all projects from API and loads into state */
    async loadProjects({ commit }) {
      const projects = await djangoRest.projects();
      commit('setProjects', projects);
    },
    /**
     * Pulls an individual project from API and loads into state
     *
     * @param commit
     * @param project Object Instance of Project
     */
    async loadProject({ commit }, project: Project) {
      commit('resetProject');

      // Build navigation links throughout the frame to improve performance.
      let firstInPrev = null;

      // Refresh the project from the API
      project = await djangoRest.project(project.id);
      commit('setCurrentProject', project);

      // place data in state, adds each experiment to experiments
      const { experiments } = project;

      for (let i = 0; i < experiments.length; i += 1) {
        // Get a specific experiment from the project
        const experiment = experiments[i];
        // set experimentScans[experiment.id] before registering the experiment.id
        // so ExperimentsView doesn't update prematurely
        commit('addExperiment', {
          experimentId: experiment.id,
          experiment: {
            id: experiment.id,
            name: experiment.name,
            note: experiment.note,
            project: experiment.project,
            index: i,
            lockOwner: experiment.lock_owner,
          },
        });

        // Get the associated scans from the experiment
        // TODO these requests *can* be run in parallel, or collapsed into one XHR
        // eslint-disable-next-line no-await-in-loop
        const { scans } = experiment;
        for (let j = 0; j < scans.length; j += 1) {
          const scan = scans[j];
          commit('addExperimentScans', { experimentId: experiment.id, scanId: scan.id });

          // TODO these requests *can* be run in parallel, or collapsed into one XHR
          // eslint-disable-next-line no-await-in-loop
          const { frames } = scan; // Get the frames associated with a specific scan

          commit('setScan', {
            scanId: scan.id,
            scan: {
              id: scan.id,
              name: scan.name,
              experiment: experiment.id,
              cumulativeRange: [Number.MAX_VALUE, -Number.MAX_VALUE],
              decisions: scan.decisions,
              sessionID: scan.session_id,
              subjectID: scan.subject_id,
              link: scan.scan_link,
            },
          });

          const nextScan = getNextFrame(experiments, i, j); // Check where i j come from above, is this getting the current scan?

          for (let k = 0; k < frames.length; k += 1) { // then this is getting each frame associated with the scan
            const frame = frames[k];
            commit('addScanFrames', { scanId: scan.id, frameId: frame.id });
            commit('setFrame', {
              frameId: frame.id,
              frame: {
                ...frame,
                scan: scan.id,
                experiment: experiment.id,
                index: k,
                previousFrame: k > 0 ? frames[k - 1].id : null,
                nextFrame: k < frames.length - 1 ? frames[k + 1].id : null,
                firstFrameInPreviousScan: firstInPrev,
                firstFrameInNextScan: nextScan ? nextScan.id : null,
              },
            });
          }

          if (frames.length > 0) { // If a frame exists
            firstInPrev = frames[0].id;
          } else {
            console.error(
              `${experiment.name}/${scan.name} has no frames`,
            );
          }
        }
      }
      // get the task overview for this project
      const taskOverview = await djangoRest.projectTaskOverview(project.id);
      commit('setTaskOverview', taskOverview);
    },
    /**
     * Add a scan to scans
     *
     * @param commit
     * @param getters
     * @param scanId
     */
    async reloadScan({ commit, getters }, scanId) {
      const { currentFrame } = getters;
      scanId = scanId || currentFrame.scan;
      if (!scanId) return;
      const scan = await djangoRest.scan(scanId);
      commit('setScan', {
        scanId: scan.id,
        scan: {
          id: scan.id,
          name: scan.name,
          experiment: scan.experiment,
          cumulativeRange: [Number.MAX_VALUE, -Number.MAX_VALUE],
          notes: scan.notes,
          decisions: scan.decisions,
          sessionID: scan.session_id,
          subjectID: scan.subject_id,
          link: scan.scan_link,
        },
      });
    },
    /**
     * Get the desired frame
     *
     * @param state       Object   Contains the entire Vuex store for MIQA
     * @param dispatch
     * @param frameId     string   ID of the frame to load, e.g. de0f2e0a-3dfb-47b7-831b-9dd562caa6cf
     * @param projectId   string   ID of the currently loaded project, e.g., 2dd4e46d-0a34-4267-be8c-3ccfbd4e9fcc
     */
    async getFrame({ state, dispatch }, { frameId, projectId }) {
      if (!frameId) {
        return undefined;
      }
      // If currently loaded frameId does not match frameId to load
      if (!state.frames[frameId]) {
        await dispatch('loadProjects');
        const targetProject = state.projects.filter((proj) => proj.id === projectId)[0];
        await dispatch('loadProject', targetProject);
      }
      return state.frames[frameId];
    },
    /**
     * Sets state.currentFrameId
     *
     * @param commit
     * @param frameId
     */
    async setCurrentFrame({ commit }, frameId) {
      commit('setCurrentFrameId', frameId);
    },
    /**
     * This is a key function
     * @param state
     * @param dispatch
     * @param getters
     * @param commit
     * @param frame Frame Instance of Frame
     * @param onDownloadProgress Passes local download state from Frame view
     */
    async swapToFrame({
      state, dispatch, getters, commit,
    }, { frame, onDownloadProgress = null }) {
      if (!frame) {
        throw new Error("frame id doesn't exist");
      }
      // If we already have the desired frame
      if (getters.currentFrame === frame) {
        return;
      }
      commit('setLoadingFrame', true);
      commit('setErrorLoadingFrame', false);
      const oldScan = getters.currentScan;
      // frame.scan returns the scan id
      const newScan = state.scans[frame.scan];

      if (newScan !== oldScan && newScan) {
        queueLoadScan(
          newScan, true,
        );
      }

      let newProxyManager = false;
      if (oldScan !== newScan && state.proxyManager) {
        // If we don't "shrinkProxyManager()" and reinitialize it between
        // scans, then we can end up with no frame
        // slices displayed, even though we have the data and attempted
        // to render it.  This may be due to frame extents changing between
        // scans, which is not the case from one timestep of a single scan
        // to tne next.
        shrinkProxyManager(state.proxyManager);
        newProxyManager = true;
      }

      // vtkProxyManager is from VTK.js
      // If it doesn't exist, create new instance of proxyManager
      if (!state.proxyManager || newProxyManager) {
        state.proxyManager = vtkProxyManager.newInstance({
          proxyConfiguration: proxy,
        });
        state.vtkViews = [];
      }

      // sourceProxy / source?
      let sourceProxy = state.proxyManager.getActiveSource();
      let needPrep = false;
      if (!sourceProxy) {
        sourceProxy = state.proxyManager.createProxy(
          'Sources',
          'TrivialProducer',
        );
        needPrep = true;
      }

      // This try catch and logic within it are mainly for handling data doesn't exist issue
      try {
        let frameData = null;
        // load from cache if possible
        if (frameCache.has(frame.id)) {
          frameData = frameCache.get(frame.id).frameData;
        } else {
          // download from server if not cached
          const result = await loadFileAndGetData(
            frame, { onDownloadProgress },
          );
          frameData = result.frameData;
        }
        sourceProxy.setInputData(frameData);
        // If sourceProxy doesn't have valid config or proxyManager has no views
        if (needPrep || !state.proxyManager.getViews().length) {
          prepareProxyManager(state.proxyManager);
          state.vtkViews = state.proxyManager.getViews();
        }
        if (!state.vtkViews.length) {
          state.vtkViews = state.proxyManager.getViews();
        }
      } catch (err) {
        console.log('Caught exception loading next frame');
        console.log(err);
        state.vtkViews = [];
        commit('setErrorLoadingFrame', true);
      } finally {
        dispatch('setCurrentFrame', frame.id);
        commit('setLoadingFrame', false);
      }

      // check for window lock expiry
      if (state.windowLocked.lock) {
        const { currentViewData } = getters;
        const unlock = () => {
          commit('setWindowLocked', {
            lock: false,
            duration: undefined,
            target: undefined,
            associatedImage: undefined,
          });
        };
        switch (state.windowLocked.duration) {
          case 'scan':
            if (currentViewData.scanId !== state.windowLocked.target) unlock();
            break;
          case 'experiment':
            if (currentViewData.experimentId !== state.windowLocked.target) unlock();
            break;
          case 'project':
            if (currentViewData.projectId !== state.windowLocked.target) unlock();
            break;
          default:
            break;
        }
      }
    },
    /**
     * Sets a lock on the current experiment
     *
     * @param commit
     * @param experimentId
     * @param lock
     * @param force
     */
    async setLock({ commit }, { experimentId, lock, force }) {
      if (lock) {
        commit(
          'updateExperiment',
          await djangoRest.lockExperiment(experimentId, force),
        );
      } else {
        commit(
          'updateExperiment',
          await djangoRest.unlockExperiment(experimentId),
        );
      }
    },
  },
});

// Export the direct-store instead of the classic Vuex store.
export default store;

// The following exports will be used to enable types in the
// implementation of actions and getters.
export {
  rootActionContext,
  moduleActionContext,
  rootGetterContext,
  moduleGetterContext,
};

export type AppStore = typeof store;
