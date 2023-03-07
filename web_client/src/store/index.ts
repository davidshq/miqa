/* eslint-disable no-use-before-define */
import Vue from 'vue';
import Vuex from 'vuex';
import vtkProxyManager from 'vtk.js/Sources/Proxy/Core/ProxyManager';
import macro from 'vtk.js/Sources/macros';
import { InterpolationType } from 'vtk.js/Sources/Rendering/Core/ImageProperty/Constants';

import '../utils/registerReaders';

import readImageArrayBuffer from 'itk/readImageArrayBuffer';
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

import { RESET_STATE, SET_MIQA_CONFIG, SET_ME, SET_ALL_USERS, RESET_PROJECT_STATE, SET_CURRENT_FRAME_ID,
         SET_FRAME, SET_SCAN, SET_RENDER_ORIENTATION, SET_CURRENT_PROJECT, SET_GLOBAL_SETTINGS,
         SET_TASK_OVERVIEW, SET_PROJECTS, ADD_SCAN_DECISION, SET_FRAME_EVALUATION, SET_CURRENT_SCREENSHOT,
         ADD_SCREENSHOT, REMOVE_SCREENSHOT, UPDATE_LAST_API_REQUEST_TIME, SET_LOADING_FRAME,
         SET_ERROR_LOADING_FRAME, ADD_SCAN_FRAMES, ADD_EXPERIMENT_SCANS, ADD_EXPERIMENT,
         UPDATE_EXPERIMENT, SET_WINDOW_LOCKED, SET_SCAN_CACHED_PERCENTAGE, SET_SLICE_LOCATION,
         SET_CURRENT_VTK_INDEX_SLICES, SET_SHOW_CROSSHAIRS, SET_STORE_CROSSHAIRS, SET_REVIEW_MODE
       } from './mutation-types';

const { convertItkToVtkImage } = ITKHelper;

Vue.use(Vuex);

// Cache of downloaded files
const fileCache = new Map();
// Unclear how this differs from above
const frameCache = new Map();
// Queue of frames to be downloaded
let readDataQueue = [];
// List of frames that have been successfully added to readDataQueue
const loadedData = [];
// Frames that need to be downloaded
const pendingFrameDownloads = new Set<any>();
// Maximum number of workers in WorkerPool
const poolSize = Math.floor(navigator.hardwareConcurrency / 2) || 2;
// Defines the task currently running
let taskRunId = -1;
// Reuse workers for performance
let savedWorker = null;

/** Delete existing VTK.js proxyManager views */
function shrinkProxyManager(proxyManager: vtkProxyManager) {
  console.log('Vuex - shrinkProxyManager: Running');
  proxyManager.getViews().forEach((view) => {
    view.setContainer(null);
    proxyManager.deleteProxy(view);
  });
}

/** Renders each view. Also disables Axes visibility and sets InterpolationType to nearest */
function prepareProxyManager(proxyManager: vtkProxyManager) {
  console.log('Vuex - prepareProxyManager: Running');
  if (!proxyManager.getViews().length) {
    ['View2D_Z:z', 'View2D_X:x', 'View2D_Y:y'].forEach((type) => {
      // viewManager.getView
      const view = getView(proxyManager, type);
      console.log('Vuex - prepareProxyManager: View', view);
      // @ts-ignore
      view.setOrientationAxesVisibility(false);
      // @ts-ignore
      view.getRepresentations().forEach((representation) => {
        representation.setInterpolationType(InterpolationType.NEAREST);
        representation.onModified(macro.debounce(() => {
          // @ts-ignore
          if (view.getRepresentations()) {
            // @ts-ignore
            view.render(true);
          }
        }, 0));
        // debounce timer doesn't need a wait time because
        // the many onModified changes that it needs to collapse to a single rerender
        // all happen simultaneously when the input data is changed.
      });
    });
  }
}

/** Array name is file name minus last extension, e.g. image.nii.gz => image.nii */
function getArrayNameFromFilename(filename) {
  console.log('Vuex - getArrayNameFromFilename: Running');
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
function getImageData(frameId, file, webWorker = null) {
  console.log('Vuex - getImageData: Running');
  return new Promise((resolve, reject) => {
    // Load image from frame cache if available, this resolves promise
    if (frameCache.has(frameId)) {
      console.log("Vuex - getImageData: Pulling from cache");
      resolve({ frameData: frameCache.get(frameId), webWorker });
    } else {
      console.log("Vuex - getImageData: Not in cache, loading file");
      const fileName = file.name;
      const io = new FileReader();

      // This won't run until io indicates it has loaded the file.
      io.onload = function onLoad() {
        // Read image with ITK
        readImageArrayBuffer(webWorker, io.result, fileName)
          .then(({ webWorker, image }) => { // eslint-disable-line no-shadow
            const frameData = convertItkToVtkImage(image, {
              scalarArrayName: getArrayNameFromFilename(fileName),
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

/** Load file, from cache if possible. Only called by loadFileAndGetData */
function loadFile(frame, { onDownloadProgress = null } = {}) {
  console.log('Vuex - loadFile: Running');
  if (fileCache.has(frame.id)) { // If frame is cached, return it
    console.log('Vuex - loadFile: Pulled from cache');
    console.log('Vuex - loadFile: returning: ', { frameId: frame.id, cachedFile: fileCache.get(frame.id) });
    return { frameId: frame.id, cachedFile: fileCache.get(frame.id) };
  } else { // Otherwise download the frame
    let client = apiClient;
    let downloadURL = `/frames/${frame.id}/download`;
    if (frame.download_url) {
      client = axios.create();
      downloadURL = frame.download_url;
    }
    const { promise } = ReaderFactory.downloadFrame(
      client,
      `image${frame.extension}`,
      downloadURL,
      { onDownloadProgress },
    );
    fileCache.set(frame.id, promise);
    console.log('Vuex - loadFile: Downloaded');
    console.log('Vuex - loadFile: returning: ', { frameId: frame.id, cachedFile : promise });
    return { frameId: frame.id, cachedFile: promise };
  }
}

/** Downloads an image file. */
function downloadFile(frame, onDownloadProgress) {
  console.log('Vuex - downloadFile: Running');
  let client = apiClient;
  let downloadURL = `/frames/${frame.id}/download`;
  if (frame.download_url) {
    client = axios.create();
    downloadURL = frame.download_url;
  }
  const { promise } = ReaderFactory.downloadFrame(
    client,
    `image${frame.extension}`,
    downloadURL,
    { onDownloadProgress },
  );
  fileCache.set(frame.id, promise);
  return { frameId: frame.id, cachedFile: promise };
}

/** Gets the data from the selected image file using a webWorker. */
async function loadFileAndGetData(frame, { onDownloadProgress = null } = {}) {
  console.log('Vuex - loadFileAndGetData: Running');
  console.log('Vuex - loadFileAndGetData: frame', frame);
  const loadResult = loadFile(frame, { onDownloadProgress });
  console.log('Vuex - loadFileAndGetData: loadResult', loadResult);
  // Once the file has been cached and is available, call getImageData
  return loadResult.cachedFile
    .then((file) => getImageData(frame.id, file, savedWorker))
    .then(({ webWorker, frameData }) => {
      savedWorker = webWorker;
      console.log('Vuex - loadFileAndGetData: Getting from cache');
      return Promise.resolve({ frameData });
    })
    .catch(() => {
      const msg = 'Vuex - loadFileAndGetData: Caught error getting data';
      return Promise.reject(msg);
    })
    .finally(() => {
      if (savedWorker) {
        savedWorker.terminate();
        savedWorker = null;
        // console.log('Vuex - loadFileAndGetData: Terminated worker');
      }
    });
}

/**
 * Use a worker to download image files. Only used by WorkerPool
 * taskInfo  Object  Contains experimentId, scanId, and a frame object
 */
function poolFunction(webWorker, taskInfo) {
  console.log('Vuex - poolFunction: Running');
  return new Promise((resolve, reject) => {
    const { frame } = taskInfo;

    let filePromise = null;

    if (fileCache.has(frame.id)) { // Load file from cache if available
      console.log('Vuex - poolFunction: Pulling from cache');
      filePromise = fileCache.get(frame.id);
    } else { // Download image file
      console.log('Vuex - poolFunction: Downloading file');
      let download = downloadFile(frame, {});
      pendingFrameDownloads.add(download); // Adds to Set of all pending downloads
      filePromise = download.cachedFile;
      filePromise // Delete from pending downloads once resolved/rejected
        .then(() => {
          pendingFrameDownloads.delete(download);
        }).catch(() => {
          pendingFrameDownloads.delete(download);
        });
    }

    filePromise
      .then((file) => {
        resolve(getImageData(frame.id, file, webWorker));
      })
      .catch((err) => {
        reject(err);
      });
  });
}

/** Calculates the percent downloaded of currently loading frames */
function progressHandler(completed, total) {
  console.log('Vuex - progressHandler: Running');
  const percentComplete = completed / total;
  store.commit('SET_SCAN_CACHED_PERCENTAGE', percentComplete);
}

/** Creates array of tasks to run then runs tasks in parallel. Only called by queueLoadScan */
function startReaderWorkerPool() {
  console.log('Vuex - startReaderWorkerPool: Running');
  // Get the current array of tasks in readDataQueue
  const taskArgsArray = readDataQueue.map((taskInfo) => [taskInfo]);
  // Reset the current array of tasks in readDataQueue
  readDataQueue = [];

  const { runId, promise } = store.state.workerPool.runTasks(
    taskArgsArray,
    progressHandler,
  );
  taskRunId = runId; // The number of tasks still running

  promise
    .then(() => {
      taskRunId = -1; // Indicates no tasks are running
    })
    .catch((err) => {
      console.error(err);
    })
    .finally(() => {
      store.state.workerPool.terminateWorkers();
    });
}

/** Queues scan for download, will load all frames for a target scan if the scan has not already been loaded. */
function queueLoadScan(scan, loadNext: 0) {
  console.log('Vuex - queueLoadScan: Running');
  console.log('Vuex - queueLoadScan: scan', scan);
  console.log('Vuex - queueLoadScan: loadNext', loadNext);
  console.log('Vuex - queueLoadScan: scan.id', scan.id);
  // load all frames in target scan
  if (!loadedData.includes(scan.id)) {
    console.log('Vuex - queueLoadScan: scan.id not found in loadedData');
    // For each scan in scanFrames
    store.state.scanFrames[scan.id].forEach(
      (frameId) => {
        console.log('Vuex - queueLoadScan: Adding to readDataQueue', frameId);
        // Add to readDataQueue a request to get the frames associated with that scan
        readDataQueue.push({
          experimentId: scan.experiment,
          scanId: scan.id,
          frame: store.state.frames[frameId],
        });
      },
    );
    // Once frame has been successfully added to queue:
    console.log('Vuex - queueLoadScan: Adding scan to loadedData');
    loadedData.push(scan.id);
  }

  if (loadNext > 0) {
    // Get the other scans in the experiment.
    const scansInSameExperiment = store.state.experimentScans[scan.experiment];
    let nextScan;
    if (scan.id === scansInSameExperiment[scansInSameExperiment.length - 1]) {
      // load first scan in next experiment
      const experimentIds = Object.keys(store.state.experimentScans);
      const nextExperimentId = experimentIds[experimentIds.indexOf(scan.experiment) + 1];
      const nextExperimentScans = store.state.experimentScans[nextExperimentId];
      if (nextExperimentScans && nextExperimentScans.length > 0) {
        nextScan = store.state.scans[
          nextExperimentScans[0]
        ];
      }
    } else {
      let newIndex = scansInSameExperiment.indexOf(scan.id) + 1;
      while (
        (!nextScan || !includeScan(nextScan.id))
         && newIndex < scansInSameExperiment.length
         && newIndex > 0
      ) {
        // load next scan in same experiment
        nextScan = store.state.scans[scansInSameExperiment[newIndex]];
        newIndex += 1;
      }
    }
    // @ts-ignore - TODO: Fix this
    if (nextScan) queueLoadScan(nextScan, loadNext - 1);
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
  console.log('Vuex - getNextFrame: Running');
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
 * Only called by `getImageData`
 */
function expandScanRange(frameId, dataRange) {
  console.log('Vuex - expandScanRange: Running');
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

/** Determines whether a scan will be displayed based on its reviewed status */
export function includeScan(scanId) {
  console.log('Vuex - includeScan: Running');
  if (store.state.reviewMode) {
    const myRole = store.state.currentTaskOverview?.my_project_role;
    const scanState = store.state.currentTaskOverview?.scan_states[scanId];
    switch (scanState) {
      case 'unreviewed':
        return true;
      case 'complete':
        return false;
      default:
        return myRole === 'tier_2_reviewer';
    }
  }
  return true;
}

const initState = {
  MIQAConfig: {
    version: '',
  },
  me: {
    username: null,
    id: null,
    is_superuser: false,
  },
  allUsers: [],
  reviewMode: true,
  globalSettings: undefined as ProjectSettings,
  currentProject: undefined as Project | null,
  currentTaskOverview: null as ProjectTaskOverview | null,
  currentProjectPermissions: {},
  projects: [] as Project[],
  experimentIds: [],
  experiments: {},
  experimentScans: {},
  scans: {},
  scanFrames: {},
  frames: {},
  proxyManager: [],
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
  iIndexSlice: { 0:0, 1:0, 2:0, 3:0 },
  jIndexSlice: { 0:0, 1:0, 2:0, 3:0 },
  kIndexSlice: { 0:0, 1:0, 2:0, 3:0 },
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

export const storeConfig = {
  state: {
    ...initState,
    workerPool: new WorkerPool(poolSize, poolFunction),
    lastApiRequestTime: Date.now(),
  },
  // Getters in Vuex always take in all the state as their first parameter.
  getters: {
    /** Returns current view's project, experiments, scans, frames, and auto-evaluation. */
    currentView(state) {
      console.log('Vuex - Getter - currentView: Running');
      const currentFrame = state.currentFrameId ? state.frames[state.currentFrameId] : null;
      const scan = currentFrame ? state.scans[currentFrame.scan] : undefined;
      if (!scan) {
        // scan was removed from list by review mode; do nothing
        return {};
      }
      const experiment = currentFrame.experiment
        ? state.experiments[currentFrame.experiment] : null;
      const project = state.projects.filter((x) => x.id === experiment.project)[0];
      // Get list of scans for current experiment
      const experimentScansList = state.experimentScans[experiment.id];
      // Get list of frames associated with current scan
      const scanFramesList = state.scanFrames[scan.id];

      const scanOrder = Object.values(state.experimentScans).flat().filter(includeScan);
      const currIndexInOrder = scanOrder.indexOf(scan.id);
      const upTo = scanOrder[currIndexInOrder - 1];
      const downTo = scanOrder[currIndexInOrder + 1];
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
        experimentScansList,
        scanFramesList,
        scanPosition: experimentScansList.indexOf(scan.id) + 1,
        framePosition: scanFramesList.indexOf(currentFrame.id) + 1,
        upTo,
        downTo,
        currentFrame,
        currentAutoEvaluation: currentFrame.frame_evaluation,
      };
    },
    /** Gets the current frame when given a frameId */
    currentFrame(state) {
      console.log('Vuex - Getter - currentFrame: Running');
      return state.currentFrameId ? state.frames[state.currentFrameId] : null;
    },
    previousFrame(state, getters) {
      console.log('Vuex - Getter - previousFrame: Running');
      return getters.currentFrame
        ? getters.currentFrame.previousFrame
        : null;
    },
    nextFrame(state, getters) {
      console.log('Vuex - Getter - nextFrame: Running');
      return getters.currentFrame ? getters.currentFrame.nextFrame : null;
    },
    /** Gets the current scan via the currentFrame */
    currentScan(state, getters) {
      console.log('Vuex - Getter - currentScan: Running');
      if (getters.currentFrame) {
        const curScanId = getters.currentFrame.scan;
        return state.scans[curScanId];
      }
      return null;
    },
    /** Gets the currentExperiment via the currentScan */
    currentExperiment(state, getters) {
      console.log('Vuex - Getter - currentExperiment: Running');
      if (getters.currentScan) {
        const curExperimentId = getters.currentScan.experiment;
        return state.experiments[curExperimentId];
      }
      return null;
    },
    /** Enumerates permissions of logged-in user */
    myCurrentProjectRoles(state) {
      console.log('Vuex - Getter - myCurrentProjectRoles:  Running');
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
      console.log('Vuex - Getter - isGlobal: Running');
      return state.currentProject === null;
    },
    editRights(state, getters) {
      console.log('Vuex - Getter - editRights: Running');
      return getters.myCurrentProjectRoles.includes('tier_1_reviewer')
        || getters.myCurrentProjectRoles.includes('tier_2_reviewer')
        || getters.myCurrentProjectRoles.includes('superuser');
    },
    experimentIsEditable(state, getters) {
      console.log('Vuex - Getter - experimentIsEditable: Running');
      return getters.currentView.lockOwner && getters.currentView.lockOwner.id === state.me.id;
    },
  },
  mutations: {
    [RESET_STATE] (state) {
      console.log('Vuex - Mutation - RESET_STATE: Running');
      Object.assign(state, { ...state, ...initState });
    },
    [SET_MIQA_CONFIG] (state, configuration) {
      console.log('Vuex - Mutation - SET_MIQA_CONFIG: Running');
      if (!configuration) configuration = {};
      if (!configuration.version) configuration.version = '';
      state.MIQAConfig = configuration;
    },
    [SET_ME] (state, me) {
      console.log('Vuex - Mutation - SET_ME: Running');
      state.me = me;
    },
    [SET_ALL_USERS] (state, allUsers) {
      console.log('Vuex - Mutation - SET_ALL_USERS: Running');
      state.allUsers = allUsers;
    },
    /** Resets project state when loading a new project */
    [RESET_PROJECT_STATE] (state) {
      console.log('Vuex - Mutation - RESET_PROJECT_STATE: Running');
      state.experimentIds = [];
      state.experiments = {};
      state.experimentScans = {};
      state.scans = {};
      state.scanFrames = {};
      state.frames = {};
    },
    [SET_CURRENT_FRAME_ID] (state, frameId) {
      console.log('Vuex - Mutation - SET_CURRENT_FRAME_ID: Running');
      state.currentFrameId = frameId;
    },
    /** Sets a specific index within the frames array to a specified frame */
    [SET_FRAME] (state, { frameId, frame }) {
      console.log('Vuex - Mutation - SET_FRAME: Running');
      // Replace with a new object to trigger a Vuex update
      state.frames = { ...state.frames }; // Why do we pass in the frameId when we can access it from frame.id?
      state.frames[frameId] = frame;
    },
    [SET_SCAN] (state, { scanId, scan }) {
      console.log('Vuex - Mutation - SET_SCAN: Running');
      // Replace with a new object to trigger a Vuex update
      state.scans = { ...state.scans };
      state.scans[scanId] = scan;
    },
    [SET_RENDER_ORIENTATION] (state, anatomy) {
      console.log('Vuex - Mutation - SET_RENDER_ORIENTATION: Running');
      state.renderOrientation = anatomy;
    },
    /** Also sets state.renderOrientation and state.currentProjectPermissions */
    [SET_CURRENT_PROJECT] (state, project: Project | null) {
      console.log('Vuex - Mutation - SET_CURRENT_PROJECT: Running');
      state.currentProject = project;
      if (project) {
        state.renderOrientation = project.settings.anatomy_orientation;
        state.currentProjectPermissions = project.settings.permissions;
      }
    },
    [SET_GLOBAL_SETTINGS] (state, settings) {
      console.log('Vuex - Mutation - SET_GLOBAL_SETTINGS: Running');
      state.globalSettings = settings;
    },
    /** TODO: Does too much, should be action w/mutations */
    [SET_TASK_OVERVIEW] (state, taskOverview: ProjectTaskOverview) {
      console.log('Vuex - Mutation - SET_TASK_OVERVIEW: Running');
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
        Object.values(store.state.scans).forEach((scan: Scan) => {
          // If the scan exists and has been reviewed
          if (taskOverview.scan_states[scan.id] && taskOverview.scan_states[scan.id] !== 'unreviewed') {
            // Reload the scan
            store.dispatch('reloadScan', scan.id);
          }
        });
      }
    },
    [SET_PROJECTS] (state, projects: Project[]) {
      console.log('Vuex - Mutation - SET_PROJECTS: Running');
      state.projects = projects;
    },
    [ADD_SCAN_DECISION] (state, { currentScanId, newScanDecision }) {
      console.log('Vuex - Mutation - ADD_SCAN_DECISION: Running');
      state.scans[currentScanId].decisions.push(newScanDecision);
    },
    /** Note: We don't pass the frame, only the frame_evaluation, we then append the value to `currentFrame` */
    [SET_FRAME_EVALUATION] (state, frame_evaluation) {
      console.log('Vuex - Mutation - SET_FRAME_EVALUATION: Running');
      const currentFrame = state.currentFrameId ? state.frames[state.currentFrameId] : null;
      if (currentFrame) {
        currentFrame.frame_evaluation = frame_evaluation;
      }
    },
    [SET_CURRENT_SCREENSHOT] (state, screenshot) {
      console.log('Vuex - Mutation - SET_CURRENT_SCREENSHOT: Running');
      state.currentScreenshot = screenshot;
    },
    [ADD_SCREENSHOT] (state, screenshot) {
      console.log('Vuex - Mutation - ADD_SCREENSHOT: Running');
      state.screenshots.push(screenshot);
    },
    [REMOVE_SCREENSHOT] (state, screenshot) {
      console.log('Vuex - Mutation - REMOVE_SCREENSHOT: Running');
      state.screenshots.splice(state.screenshots.indexOf(screenshot), 1);
    },
    [UPDATE_LAST_API_REQUEST_TIME] (state) {
      console.log('Vuex - Mutation - UPDATE_LAST_API_REQUEST_TIME: Running');
      state.lastApiRequestTime = Date.now();
    },
    [SET_LOADING_FRAME] (state, isLoading: boolean) {
      console.log('Vuex - Mutation - SET_LOADING_FRAME: Running');
      state.loadingFrame = isLoading;
    },
    [SET_ERROR_LOADING_FRAME] (state, isErrorLoading: boolean) {
      console.log('Vuex - Mutation - SET_ERROR_LOADING_FRAME: Running');
      state.errorLoadingFrame = isErrorLoading;
    },
    /** Adds a scan ID, and it's corresponding Frame ID to state.scanFrames */
    [ADD_SCAN_FRAMES] (state, { scanId, frameId }) { // TODO: Should this be addScanFrame or addScanToScanFrames?
      console.log('Vuex - Mutation - ADD_SCAN_FRAMES: Running');
      state.scanFrames[scanId].push(frameId);
    },
    [ADD_EXPERIMENT_SCANS] (state, { experimentId, scanId }) {
      console.log('Vuex - Mutation - ADD_EXPERIMENT_SCANS: Running');
      state.scanFrames[scanId] = []; // Why?
      state.experimentScans[experimentId].push(scanId);
    },
    /**
     * Add an experiment to state.experiments, it's id to state.experimentIds, and set
     * state.experimentScans to an empty array
     */
    [ADD_EXPERIMENT] (state, { experimentId, experiment }) {
      console.log('Vuex - Mutation - ADD_EXPERIMENT: Running');
      state.experimentScans[experimentId] = [];
      if (!state.experimentIds.includes(experimentId)) {
        state.experimentIds.push(experimentId);
      }
      state.experiments[experimentId] = experiment;
    },
    [UPDATE_EXPERIMENT] (state, experiment) {
      console.log('Vuex - Mutation - UPDATE_EXPERIMENT: Running');
      // Necessary for reactivity
      state.experiments = { ...state.experiments };
      state.experiments[experiment.id] = experiment;
    },
    /** Ensures that a specific image is being reviewed by a single individual */
    [SET_WINDOW_LOCKED] (state, lockState) {
      console.log('Vuex - Mutation - SET_WINDOW_LOCKED: Running');
      state.windowLocked = lockState;
    },
    [SET_SCAN_CACHED_PERCENTAGE] (state, percentComplete) {
      console.log('Vuex - Mutation - SET_SCAN_CACHED_PERCENTAGE: Running');
      state.scanCachedPercentage = percentComplete;
    },
    /** Saves the location of the cursor click related to a specific scan and decision */
    [SET_SLICE_LOCATION] (state, ijkLocation, whichProxy = 0) {
      console.log('Vuex - Mutation - SET_SLICE_LOCATION: Running');
      if (Object.values(ijkLocation).every((value) => value !== undefined)) {
        state.vtkViews[whichProxy].forEach(
          (view) => {
            state.proxyManager[whichProxy].getRepresentation(null, view).setSlice(
              ijkLocation[ijkMapping[view.getName()]],
            );
          },
        );
      }
    },
    [SET_CURRENT_VTK_INDEX_SLICES] (state, { indexAxis, value, whichProxy = 0 }) {
      console.log('Vuex - Mutation - SET_CURRENT_VTK_INDEX_SLICES: Running');
      console.log('Vuex - Mutation - SET_CURRENT_VTK_INDEX_SLICES: whichProxy: ', whichProxy);
      const currentAxis = `${indexAxis}IndexSlice`;
      console.log(`Vuex - Mutation - SET_CURRENT_VTK_INDEX_SLICES: ${currentAxis} with Proxy: `, state[currentAxis][whichProxy.toString()]);
      console.log(`Vuex - Mutation - SET_CURRENT_VTK_INDEX_SLICES: ${currentAxis} w/out Proxy: `, state[currentAxis]);
      state[currentAxis][whichProxy] = value;
      state.sliceLocation = undefined;
      console.log('Vuex - Mutation - SET_CURRENT_VTK_INDEX_SLICES - i:', state.iIndexSlice[whichProxy], 'j:', state.jIndexSlice[whichProxy], 'k:', state.kIndexSlice[whichProxy]);
    },
    [SET_SHOW_CROSSHAIRS] (state, show: boolean) {
      console.log('Vuex - Mutation - SET_SHOW_CROSSHAIRS: Running');
      state.showCrosshairs = show;
    },
    [SET_STORE_CROSSHAIRS] (state, value: boolean) {
      console.log('Vuex - Mutation - SET_STORE_CROSSHAIRS: Running');
      state.storeCrosshairs = value;
    },
    [SET_REVIEW_MODE] (state, mode: boolean) {
      console.log('Vuex - Mutation - SET_REVIEW_MODE: Running');
      state.reviewMode = mode || false;
    },
  },
  actions: {
    /** Reset the Vuex state of MIQA, cancel any existing tasks in the workerPool, clear file and frame caches */
    reset({ state, commit }) {
      console.log('Vuex - Action - reset: Running');
      if (taskRunId >= 0) {
        state.workerPool.cancel(taskRunId);
        taskRunId = -1;
      }
      commit('RESET_STATE');
      fileCache.clear();
      frameCache.clear();
    },
    /** Pulls configuration from API and loads it into state */
    async loadConfiguration({ commit }) {
      console.log('Vuex - Action - loadConfiguration: Running');
      const configuration = await djangoRest.MIQAConfig();
      commit('SET_MIQA_CONFIG', configuration);
    },
    /** Pulls user from API and loads it into state */
    async loadMe({ commit }) {
      console.log('Vuex - Action - loadMe: Running');
      const me = await djangoRest.me();
      commit('SET_ME', me);
    },
    /** Pulls all users from API and loads into state */
    async loadAllUsers({ commit }) {
      console.log('Vuex - Action - loadAllUsers: Running');
      const allUsers = await djangoRest.allUsers();
      commit('SET_ALL_USERS', allUsers.results);
    },
    /** Pulls global settings from API and updates currentProject and globalSettings in state */
    async loadGlobal({ commit }) {
      console.log('Vuex - Action - loadGlobal: Running');
      const globalSettings = await djangoRest.globalSettings();
      commit('SET_CURRENT_PROJECT', null);
      commit('SET_GLOBAL_SETTINGS', {
        import_path: globalSettings.import_path,
        export_path: globalSettings.export_path,
      });
      commit('SET_TASK_OVERVIEW', {});
    },
    /** Pulls all projects from API and loads into state */
    async loadProjects({ commit }) {
      console.log('Vuex - Action - loadProjects: Running');
      const projects = await djangoRest.projects();
      commit('SET_PROJECTS', projects);
    },
    /** Pulls an individual project from API and loads into state */
    async loadProject({ commit }, project: Project) {
      console.log('Vuex - Action - loadProject: Running');
      commit('RESET_PROJECT_STATE');

      // Build navigation links throughout the frame to improve performance.
      let firstInPrev = null;

      // Refresh the project from the API
      project = await djangoRest.project(project.id);
      commit('SET_CURRENT_PROJECT', project);

      // place data in state, adds each experiment to experiments
      const { experiments } = project;

      for (let experimentIndex = 0; experimentIndex < experiments.length; experimentIndex += 1) {
        // Get a specific experiment from the project
        const experiment = experiments[experimentIndex];
        // set experimentScans[experiment.id] before registering the experiment.id
        // so ExperimentsView doesn't update prematurely
        commit('ADD_EXPERIMENT', {
          experimentId: experiment.id,
          experiment: {
            id: experiment.id,
            name: experiment.name,
            note: experiment.note,
            project: experiment.project,
            index: experimentIndex,
            lockOwner: experiment.lock_owner,
          },
        });

        // Get the associated scans from the experiment
        // TODO these requests *can* be run in parallel, or collapsed into one XHR
        // eslint-disable-next-line no-await-in-loop
        const { scans } = experiment;
        for (let scanIndex = 0; scanIndex < scans.length; scanIndex += 1) {
          const scan = scans[scanIndex];
          commit('ADD_EXPERIMENT_SCANS', { experimentId: experiment.id, scanId: scan.id });

          // TODO these requests *can* be run in parallel, or collapsed into one XHR
          // eslint-disable-next-line no-await-in-loop
          const { frames } = scan; // Get the frames associated with a specific scan

          commit('SET_SCAN', {
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

          const nextScan = getNextFrame(experiments, experimentIndex, scanIndex);

          for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) { // then this is getting each frame associated with the scan
            const frame = frames[frameIndex];
            commit('ADD_SCAN_FRAMES', { scanId: scan.id, frameId: frame.id });
            commit('SET_FRAME', {
              frameId: frame.id,
              frame: {
                ...frame,
                scan: scan.id,
                experiment: experiment.id,
                index: frameIndex,
                previousFrame: frameIndex > 0 ? frames[frameIndex - 1].id : null,
                nextFrame: frameIndex < frames.length - 1 ? frames[frameIndex + 1].id : null,
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
      commit('SET_TASK_OVERVIEW', taskOverview);
    },
    /** Add a scan to scans */
    async reloadScan({ commit, getters }, scanId) {
      console.log('Vuex - Action - reloadScan: Running');
      const { currentFrame } = getters;
      scanId = scanId || currentFrame.scan;
      if (!scanId) return;
      const scan = await djangoRest.scan(scanId);
      commit('SET_SCAN', {
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
    async loadScan({ state, dispatch }, { scanId, projectId }) {
      console.log('Vuex - Action - loadScan: Running');
      if (!scanId || !state.projects) {
        return undefined;
      }
      // If currently loaded frameId does not match frameId to load
      if (!state.scans[scanId] && state.projects) {
        console.log('Vuex - Action - loadScan: Loading projects');
        await dispatch('loadProjects');
        if (state.projects) {
          const targetProject = state.projects.filter((proj) => proj.id === projectId)[0];
          console.log('Vuex - Action - loadScan: Loading project');
          await dispatch('loadProject', targetProject);
        } else {
          return undefined;
        }
      }
      console.log('Vuex - Action - loadScan: Returning scan', state.scans[scanId]);
      return state.scans[scanId];
    },
    async setCurrentFrame({ commit }, frameId) {
      console.log('Vuex - Action - setCurrentFrame: Running');
      commit('SET_CURRENT_FRAME_ID', frameId);
    },
    /**
     * Handles the process of changing frames in Scan.vue
     *
     * onDownloadProgress passes local download state from Frame view
     *
     * Frame is the object
     */
    async swapToFrame({
      state, dispatch, getters, commit,
    }, { frame, onDownloadProgress = null, loadAll = true, whichProxy = 0 }) {
      console.log('Vuex - Action - swapToFrame: Running');
      // Guard Clauses
      if (!frame) {
        throw new Error("Vuex - Action - swapToFrame: frame id doesn't exist");
      }
      if (getters.currentFrame === frame) {
        return;
      }
      commit('SET_LOADING_FRAME', true);
      commit('SET_ERROR_LOADING_FRAME', false);

      if (loadAll) {
        const oldScan = getters.currentScan;
        // frame.scan returns the scan id
        const newScan = state.scans[frame.scan];

        // Queue the new scan to be loaded
        if (newScan !== oldScan && newScan) {
          console.log('Vuex - Action - swapToFrame: Call queueLoadScan');
          queueLoadScan(
            // @ts-ignore - TODO: fix this
            newScan, 3,
          );
        }
        let newProxyManager = false;
        // Create new proxyManager if scans are different, retain proxyManager otherwise
        console.log('Vuex - Action - swapToFrame: Next check if we have a proxyManager');
        if (oldScan !== newScan && state.proxyManager[whichProxy]) {
          // If we don't shrink and reinitialize between scans
          // we sometimes end up with no frame slices displayed.
          // This may be due to the extents changing between scans,
          // the extents do not change from one timestep to another
          // in a single scan.
          console.log('Vuex - Action - swapToFrame: We have a proxyManager, shrink it');
          shrinkProxyManager(state.proxyManager[whichProxy]);
          newProxyManager = true;
        }
        console.log('Vuex - Action - swapToFrame: Calling setupProxyManager');
        // Handles shrinking and/or instantiating a new proxyManager instance
        await dispatch('setupProxyManager', newProxyManager);
      }

      try {
        console.log('Vuex - Action - swapToFrame: Calling getFrameData')
        // Gets the data we need to display
        const frameData = await dispatch('getFrameData', { frame, onDownloadProgress });

        console.log('Vuex - Action - swapToFrame: Calling setupSourceProxy');
        // Handles configuring the sourceProxy and getting the views
        await dispatch('setupSourceProxy', { frame, frameData });
      }
      catch (err) {
        console.log('Vuex - Action - swapToFrame: Caught exception loading next frame');
        console.log(err);
        state.vtkViews[whichProxy] = [];
        commit('SET_ERROR_LOADING_FRAME', true);
      } finally {
        commit('SET_CURRENT_FRAME_ID', frame.id);
        commit('SET_LOADING_FRAME', false);
      }

      await dispatch('updateLock');
    },
    async loadFrame({
      state, dispatch, getters, commit
    }, { frame, onDownloadProgress = null, whichProxy = 0 }) {
      console.log('Vuex - Action - loadFrame: Running');
      // Guard clauses
      if (!frame) {
        throw new Error("Vuex - Action - loadFrame: frame id doesn't exist");
      }

      console.log('Vuex - Action - loadFrame: frame', frame);
      console.log('Vuex - Action - loadFrame: whichProxy', whichProxy);

      commit('SET_LOADING_FRAME', true);
      commit('SET_ERROR_LOADING_FRAME', false);

      const newScan = state.scans[frame.scan];

      console.log('Vuex - Action - loadFrame: Call queueLoadScan');
      queueLoadScan(newScan, 0);

      let newProxyManager = false;

      console.log('Vuex - Action - loadFrame: Next check if we have a proxyManager');
      if (state.proxyManager[whichProxy]) {
        console.log('Vuex - Action - loadFrame: We have a proxyManager, shrink it');
        shrinkProxyManager(state.proxyManager[whichProxy]);
        newProxyManager = true;
      }

      console.log('Vuex - Action - loadFrame: Calling setupProxyManager');
      await dispatch('setupProxyManager', { newProxyManager, whichProxy });

      console.log('Vuex - Action - loadFrame: Calling getFrameData');
      const frameData = await dispatch('getFrameData', { frame, onDownloadProgress });

      try {
        console.log('Vuex - Action - loadFrame: Calling setupSourceProxy');
        await dispatch('setupSourceProxy', { frame, frameData, whichProxy });
      } catch (err) {
        console.log('Vuex - Action - loadFrame: Caught exception loading frame');
        console.log(err);
        state.vtkViews[whichProxy] = [];
        commit('SET_ERROR_LOADING_FRAME', true);
      } finally {
        commit('SET_CURRENT_FRAME_ID', frame.id);
        commit('SET_LOADING_FRAME', false);
      }

      // console.log('Vuex - View0', state.vtkViews[0]);
      // console.log('Vuex - View1', state.vtkViews[1]);
    },
    async setupProxyManager({ state, dispatch, getters, commit }, { newProxyManager, whichProxy = 0 }) {
      // If it doesn't exist, create new instance of proxyManager
      // Also, if it does exist but was used for a different scan, create a new one
      console.log('Vuex - Action - setupProxyManager: Running');
      if (!state.proxyManager[whichProxy] || newProxyManager) {
        state.proxyManager[whichProxy] = vtkProxyManager.newInstance({
          proxyConfiguration: proxy,
        });
        console.log('Vuex - Action - setupProxyManager: proxyManager', state.proxyManager[whichProxy]);
        state.vtkViews[whichProxy] = [];
      }
    },
    async setupSourceProxy({ state, dispatch, getters, commit }, { frameData, whichProxy = 0 }) {
      console.log('Vuex - Action - setupSourceProxy: Running');
      // get the source from which we are loading the images
      let sourceProxy = state.proxyManager[whichProxy].getActiveSource();
      let needPrep = false;
      // Provide default source if it doesn't exist
      if (!sourceProxy) {
        sourceProxy = state.proxyManager[whichProxy].createProxy(
          'Sources',
          'TrivialProducer',
        );
        needPrep = true;
      }

      // This try catch and within logic are mainly for handling data doesn't exist issue
      // We set the source equal to the frameData we've loaded
      sourceProxy.setInputData(frameData);
      console.log('Vuex - Action - setupSourceProxy - sourceProxy:', sourceProxy);
      // If sourceProxy doesn't have valid config or proxyManager has no views
      if (needPrep || !state.proxyManager[whichProxy].getViews().length) {
        prepareProxyManager(state.proxyManager[whichProxy]);
        state.vtkViews[whichProxy] = state.proxyManager[whichProxy].getViews();
      }
      // If no vtkViews, get them from proxyManager
      if (!state.vtkViews[whichProxy].length) {
        state.vtkViews[whichProxy] = state.proxyManager[whichProxy].getViews();
      }
    },
    async getFrameData({ state, dispatch, getters, commit, }, { frame, onDownloadProgress = null }) {
      console.log('Vuex - Action - getFrameData: Running');
      let frameData = null;
      // load from cache if possible
      if (frameCache.has(frame.id)) {
        frameData = await frameCache.get(frame.id).frameData;
        console.log('Vuex - Action - getFrameData: from cache');
        console.log('Vuex - Action - getFrameData: frameData', frameData);
      } else {
        // download from server if not cached
        console.log('Vuex - Action - getFrameData: from server');
        const result = await loadFileAndGetData(
          frame, { onDownloadProgress },
        );
        frameData = await result.frameData;
        console.log('Vuex - Action - getFrameData: frameData', frameData);
      }
      return frameData;
    },
    /** Determines what lock status should be and updates accordingly */
    async updateLock({ state, getters, commit }) {
      console.log('Vuex - Action - updateLock: Running');
      // check for window lock expiry
      if (state.windowLocked.lock) {
        const { currentView } = getters;
        // Handles unlocking if necessary
        const unlock = () => {
          commit('SET_WINDOW_LOCKED', {
            lock: false,
            duration: undefined,
            target: undefined,
            associatedImage: undefined,
          });
        };
        // Unlocks window if scan, experiment, or project has changed
        switch (state.windowLocked.duration) {
          case 'scan':
            if (currentView.scanId !== state.windowLocked.target) unlock();
            break;
          case 'experiment':
            if (currentView.experimentId !== state.windowLocked.target) unlock();
            break;
          case 'project':
            if (currentView.projectId !== state.windowLocked.target) unlock();
            break;
          default:
            break;
        }
      }
    },
    /** Sets a lock on the current experiment */
    async setLock({ commit }, { experimentId, lockExperiment, forceToLock }) {
      console.log('Vuex - Action - setLock: Running');
      if (lockExperiment) {
        commit(
          'UPDATE_EXPERIMENT',
          await djangoRest.lockExperiment(experimentId, forceToLock),
        );
      } else {
        commit(
          'UPDATE_EXPERIMENT',
          await djangoRest.unlockExperiment(experimentId),
        );
      }
    },
  },
};

const store = new Vuex.Store(storeConfig);

export default store;
