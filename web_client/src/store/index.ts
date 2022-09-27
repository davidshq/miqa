/* eslint-disable no-use-before-define */

import { createDirectStore } from 'direct-vuex';
import Vue from 'vue';
import Vuex from 'vuex';
import vtkProxyManager from 'vtk.js/Sources/Proxy/Core/ProxyManager';
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

const { convertItkToVtkImage } = ITKHelper;

Vue.use(Vuex);

const fileCache = new Map();
const frameCache = new Map();
let readDataQueue = [];
const pendingFrameDownloads = new Set<any>();
const poolSize = Math.floor(navigator.hardwareConcurrency / 2) || 2;
let taskRunId = -1;
let savedWorker = null;

/**
 * Delete existing VTK.js proxyManager views
 *
 * @param proxyManager
 */
function shrinkProxyManager(proxyManager) {
  proxyManager.getViews().forEach((view) => {
    view.setContainer(null);
    proxyManager.deleteProxy(view);
  });
}

/**
 * Disable Axes visibility, set InterpolationType to nearest and render
 * each view
 *
 * @param proxyManager
 */
function prepareProxyManager(proxyManager) {
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
 * @param id
 * @param file
 * @param webWorker
 */
function getData(id, file, webWorker = null) {
  return new Promise((resolve, reject) => {
    // Load image from frame cache if available
    if (frameCache.has(id)) {
      resolve({ frameData: frameCache.get(id), webWorker });
    } else {
      const fileName = file.name;
      const io = new FileReader();

      // Once image is loaded
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
              .getPointData()
              .getArray(0)
              .getRange();
            frameCache.set(id, { frameData });
            // eslint-disable-next-line no-use-before-define
            expandScanRange(id, dataRange);
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
 * Load file from cache if possible
 *
 * Only called by loadFileAndGetData
 *
 * @param frame
 * @param onDownloadProgress
 */
function loadFile(frame, { onDownloadProgress = null } = {}) {
  // If frame is cached, return it
  if (fileCache.has(frame.id)) {
    return { frameId: frame.id, fileP: fileCache.get(frame.id) };
  }
  // Otherwise download the frame
  let client = apiClient;
  let downloadURL = `/frames/${frame.id}/download`;
  if (frame.download_url) {
    client = axios.create();
    downloadURL = frame.download_url;
  }
  // ReaderFactory is from utils/ReaderFactory
  const { promise } = ReaderFactory.downloadFrame(
    client,
    `image${frame.extension}`,
    downloadURL,
    { onDownloadProgress },
  );
  fileCache.set(frame.id, promise);
  return { frameId: frame.id, fileP: promise };
}

/**
 * Gets the data from the selected image file using a webWorker.
 *
 * Only called by swapToFrame
 *
 * @param frame
 * @param onDownloadProgress
 */
function loadFileAndGetData(frame, { onDownloadProgress = null } = {}) {
  const loadResult = loadFile(frame, { onDownloadProgress });
  return loadResult.fileP.then((file) => getData(frame.id, file, savedWorker)
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
    }));
}

/**
 * Use a worker to download image files
 *
 * @param webWorker
 * @param taskInfo
 */
function poolFunction(webWorker, taskInfo) {
  return new Promise((resolve, reject) => {
    const { frame } = taskInfo;

    let filePromise = null;

    // Load file from cache if available
    if (fileCache.has(frame.id)) {
      filePromise = fileCache.get(frame.id);
    } else {
      // Download image file
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
      filePromise = download.promise;
      fileCache.set(frame.id, filePromise);
      pendingFrameDownloads.add(download);
      filePromise.then(() => {
        pendingFrameDownloads.delete(download);
      }).catch(() => {
        pendingFrameDownloads.delete(download);
      });
    }

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
 * Only called by checkLoadExperiment
 */
function startReaderWorkerPool() {
  const taskArgsArray = readDataQueue.map((taskInfo) => [taskInfo]);
  readDataQueue = [];

  const { runId, promise } = store.state.workerPool.runTasks(
    taskArgsArray,
    progressHandler,
  );
  taskRunId = runId;

  promise
    .then(() => {
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
 * Cache frames associated with scans of current experiment
 *
 * Only called by swapToFrame
 *
 * @param oldValue
 * @param newValue
 */
function checkLoadExperiment(oldValue, newValue) {
  if (
    !newValue
    || newValue === oldValue
  ) {
    return;
  }

  readDataQueue = [];
  // Get scans associated with `newValue` (a selected experiment)
  const newExperimentScans = store.state.experimentScans[newValue.id];
  newExperimentScans.forEach((scanId) => {
    const scanFrames = store.state.scanFrames[scanId].map(
      (frameId) => store.state.frames[frameId],
    );
    scanFrames.forEach((frame) => {
      readDataQueue.push({
        // TODO don't hardcode projectId
        projectId: 1,
        experimentId: newValue.id,
        scanId,
        frame,
      });
    });
  });
  startReaderWorkerPool();
}

/**
 * Get next frame (across experiments and scans)
 *
 * @param experiments
 * @param i
 * @param j
 */
function getNextFrame(experiments, i, j) {
  const experiment = experiments[i];
  const { scans } = experiment;

  if (j === scans.length - 1) {
    // last scan, go to next experiment
    if (i === experiments.length - 1) {
      // last experiment, nowhere to go
      return null;
    }
    // get first scan in next experiment
    const nextExperiment = experiments[i + 1];
    const nextScan = nextExperiment.scans[0];
    return nextScan.frames[0];
  }
  // get next scan in current experiment
  const nextScan = scans[j + 1];
  return nextScan.frames[0];
}

/**
 * ?
 *
 * Only called by `getData`
 *
 * @param frameId
 * @param dataRange
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
  state: {
    ...initState,
    workerPool: new WorkerPool(poolSize, poolFunction),
    lastApiRequestTime: Date.now(),
  },
  getters: {
    /**
     * Return all the state
     *
     * Never called
     *
     * @param state
     */
    wholeState(state) {
      return state;
    },
    /**
     * Runs for each VTKView?
     *
     * @param state
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
    /**
     * Gets the current frame when given a frameId
     *
     * @param state
     */
    currentFrame(state) {
      return state.currentFrameId ? state.frames[state.currentFrameId] : null;
    },
    /**
     * Gets the previous frame based on the currentFrame
     *
     * @param state
     * @param getters
     */
    previousFrame(state, getters) {
      return getters.currentFrame
        ? getters.currentFrame.previousFrame
        : null;
    },
    /**
     * Gets the next frame based on the currentFrame
     *
     * @param state
     * @param getters
     */
    nextFrame(state, getters) {
      return getters.currentFrame ? getters.currentFrame.nextFrame : null;
    },
    /**
     * Gets the current scan via the currentFrame
     *
     * @param state
     * @param getters
     */
    currentScan(state, getters) {
      if (getters.currentFrame) {
        const curScanId = getters.currentFrame.scan;
        return state.scans[curScanId];
      }
      return null;
    },
    /**
     * Gets the currentExperiment via the currentScan
     *
     * @param state
     * @param getters
     */
    currentExperiment(state, getters) {
      if (getters.currentScan) {
        const curExperimentId = getters.currentScan.experiment;
        return state.experiments[curExperimentId];
      }
      return null;
    },
    /**
     * Enumerates permissions of logged in user
     *
     * @param state
     */
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
    /**
     * Returns true if no project has been selected
     *
     * @param state
     */
    isGlobal(state) {
      return state.currentProject === null;
    },
  },
  mutations: {
    /**
     * ?
     *
     * @param state
     */
    reset(state) {
      Object.assign(state, { ...state, ...initState });
    },
    /**
     * Sets MIQAConfig equal to configuration
     *
     * @param state
     * @param configuration
     */
    setMIQAConfig(state, configuration) {
      state.MIQAConfig = configuration;
    },
    /**
     * Sets me to me
     *
     * @param state
     * @param me
     */
    setMe(state, me) {
      state.me = me;
    },
    /**
     * Sets allUsers to allUsers
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
     * Sets the currentFrameId to frameId
     *
     * @param state
     * @param frameId
     */
    setCurrentFrameId(state, frameId) {
      state.currentFrameId = frameId;
    },
    /**
     * What?
     *
     * @param state
     * @param frameId
     * @param frame
     */
    setFrame(state, { frameId, frame }) {
      // Replace with a new object to trigger a Vuex update
      state.frames = { ...state.frames };
      state.frames[frameId] = frame;
    },
    /**
     * What?
     *
     * @param state
     * @param scanId
     * @param scan
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
     * Sets the Vuex currentProject
     *
     * Also sets renderOrientation and currentProjectPermissions
     *
     * @param state
     * @param project
     */
    setCurrentProject(state, project: Project | null) {
      state.currentProject = project;
      if (project) {
        state.renderOrientation = project.settings.anatomy_orientation;
        state.currentProjectPermissions = project.settings.permissions;
      }
    },
    /**
     * Named the same as django.ts function?
     *
     * @param state
     * @param settings
     */
    setGlobalSettings(state, settings) {
      state.globalSettings = settings;
    },
    /**
     *
     * @param state
     * @param taskOverview
     */
    setTaskOverview(state, taskOverview: ProjectTaskOverview) {
      if (!taskOverview) return;
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
      if (state.currentProject && taskOverview.project_id === state.currentProject.id) {
        state.currentTaskOverview = taskOverview;
        Object.values(store.state.allScans).forEach((scan: Scan) => {
          if (taskOverview.scan_states[scan.id] && taskOverview.scan_states[scan.id] !== 'unreviewed') {
            store.dispatch.reloadScan(scan.id);
          }
        });
      }
    },
    /**
     * Gets a list of projects
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
     * @param currentScan
     * @param newDecision
     */
    addScanDecision(state, { currentScan, newDecision }) {
      state.scans[currentScan].decisions.push(newDecision);
    },
    /**
     * ?
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
     * Used by both `ScreenshotDialog.vue` and `VtkViewer.vue`
     *
     * @param state
     * @param screenshot
     */
    setCurrentScreenshot(state, screenshot) {
      state.currentScreenshot = screenshot;
    },
    /**
     * Create a screenshot
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
     * Removes a screenshot
     *
     * @param state
     * @param screenshot
     */
    removeScreenshot(state, screenshot) {
      state.screenshots.splice(state.screenshots.indexOf(screenshot), 1);
    },
    /**
     * Updates the last time the API was requested to now
     *
     * @param state
     */
    updateLastApiRequestTime(state) {
      state.lastApiRequestTime = Date.now();
    },
    /**
     *
     * @param state
     * @param value
     */
    setLoadingFrame(state, value) {
      state.loadingFrame = value;
    },
    /**
     *
     * @param state
     * @param value
     */
    setErrorLoadingFrame(state, value) {
      state.errorLoadingFrame = value;
    },
    /**
     *
     * @param state
     * @param sid
     * @param id
     */
    addScanFrames(state, { sid, id }) {
      state.scanFrames[sid].push(id);
    },
    /**
     *
     * @param state
     * @param eid
     * @param sid
     */
    addExperimentScans(state, { eid, sid }) {
      state.scanFrames[sid] = [];
      state.experimentScans[eid].push(sid);
    },
    /**
     *
     * @param state
     * @param id
     * @param value
     */
    addExperiment(state, { id, value }) {
      state.experimentScans[id] = [];
      if (!state.experimentIds.includes(id)) {
        state.experimentIds.push(id);
      }
      state.experiments[id] = value;
    },
    /**
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
     *
     * @param state
     * @param lockState
     */
    setWindowLocked(state, lockState) {
      state.windowLocked = lockState;
    },
    /**
     *
     * @param state
     * @param percentComplete
     */
    setScanCachedPercentage(state, percentComplete) {
      state.scanCachedPercentage = percentComplete;
    },
    /**
     *
     * @param state
     * @param ijkLocation
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
     *
     * @param state
     * @param value
     */
    setCurrentWindowWidth(state, value) {
      state.currentWindowWidth = value;
    },
    /**
     *
     * @param state
     * @param value
     */
    setCurrentWindowLevel(state, value) {
      state.currentWindowLevel = value;
    },
    /**
     *
     * @param state
     * @param show
     */
    setShowCrosshairs(state, show) {
      state.showCrosshairs = show;
    },
    /**
     *
     * @param state
     * @param value
     */
    setStoreCrosshairs(state, value) {
      state.storeCrosshairs = value;
    },
    /**
     *
     * @param state
     * @param mode
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
    /**
     *
     * @param commit
     */
    async loadConfiguration({ commit }) {
      const configuration = await djangoRest.MIQAConfig();
      commit('setMIQAConfig', configuration);
    },
    /**
     *
     * @param commit
     */
    async loadMe({ commit }) {
      const me = await djangoRest.me();
      commit('setMe', me);
    },
    /**
     *
     * @param commit
     */
    async loadAllUsers({ commit }) {
      const allUsers = await djangoRest.allUsers();
      commit('setAllUsers', allUsers.results);
    },
    /**
     *
     * @param commit
     */
    async loadGlobal({ commit }) {
      const globalSettings = await djangoRest.globalSettings();
      commit('setCurrentProject', null);
      commit('setGlobalSettings', {
        import_path: globalSettings.import_path,
        export_path: globalSettings.export_path,
      });
      commit('setTaskOverview', {});
    },
    /**
     *
     * @param commit
     */
    async loadProjects({ commit }) {
      const projects = await djangoRest.projects();
      commit('setProjects', projects);
    },
    /**
     *
     * @param commit
     * @param project
     */
    async loadProject({ commit }, project: Project) {
      commit('resetProject');

      // Build navigation links throughout the frame to improve performance.
      let firstInPrev = null;

      // Refresh the project from the API
      project = await djangoRest.project(project.id);
      commit('setCurrentProject', project);

      // place data in state
      const { experiments } = project;

      for (let i = 0; i < experiments.length; i += 1) {
        const experiment = experiments[i];
        // set experimentScans[experiment.id] before registering the experiment.id
        // so ExperimentsView doesn't update prematurely
        commit('addExperiment', {
          id: experiment.id,
          value: {
            id: experiment.id,
            name: experiment.name,
            note: experiment.note,
            project: experiment.project,
            index: i,
            lockOwner: experiment.lock_owner,
          },
        });

        // TODO these requests *can* be run in parallel, or collapsed into one XHR
        // eslint-disable-next-line no-await-in-loop
        const { scans } = experiment;
        for (let j = 0; j < scans.length; j += 1) {
          const scan = scans[j];
          commit('addExperimentScans', { eid: experiment.id, sid: scan.id });

          // TODO these requests *can* be run in parallel, or collapsed into one XHR
          // eslint-disable-next-line no-await-in-loop
          const { frames } = scan;

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

          const nextScan = getNextFrame(experiments, i, j);

          for (let k = 0; k < frames.length; k += 1) {
            const frame = frames[k];
            commit('addScanFrames', { sid: scan.id, id: frame.id });
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

          if (frames.length > 0) {
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
     * @param frame
     * @param onDownloadProgress
     */
    async swapToFrame({
      state, dispatch, getters, commit,
    }, { frame, onDownloadProgress = null }) {
      if (!frame) {
        throw new Error("frame id doesn't exist");
      }
      if (getters.currentFrame === frame) {
        return;
      }
      commit('setLoadingFrame', true);
      commit('setErrorLoadingFrame', false);
      const oldScan = getters.currentScan;
      const newScan = state.scans[frame.scan];
      const oldExperiment = getters.currentExperiment ? getters.currentExperiment : null;
      const newExperimentId = state.scans[frame.scan].experiment;
      const newExperiment = state.experiments[newExperimentId];

      // Check if we should cancel the currently loading experiment
      // e.g., if user is attempting to load a new experiment that is different from the current experiment
      if (
        newExperiment
        && oldExperiment
        && newExperiment.id !== oldExperiment.id
        && taskRunId >= 0
      ) {
        state.workerPool.cancel(taskRunId);
        pendingFrameDownloads.forEach(({ abortController }) => {
          abortController.abort();
        });
        pendingFrameDownloads.clear();
        taskRunId = -1;
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

      // If necessary, queue loading scans of new experiment
      checkLoadExperiment(oldExperiment, newExperiment);

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
