<script lang="ts">
import {
  mapActions,
  mapState,
} from 'vuex';

import VtkViewer from '@/components/VtkViewerCompare.vue';

export default {
  name: 'CompareScans',
  components: {
    VtkViewer,
  },
  inject: ['user'],
  data: () => ({
    downloadLoaded: 0,
    downloadTotal: 0,
    allProjects: [],
    selectedProject: '',
    childExperiments: [],
    selectedExperiment: '',
    childScans: [],
    selectedScan: '',
    selectedScan1: {},
    selectedScan2: {},
    selectedScan3: {},
    vtkView1Loaded: false,
    vtkView2Loaded: false,
    vtkView3Loaded: false,
  }),
  computed: {
    ...mapState([
      'currentFrameId',
      'projects',
      'experiments',
      'scans',
      'frames',
      'scanFrames',
      'vtkViews',
    ]),
  },
  watch: {
    /** Watch for changes to available projects */
    async projects(projects) {
      console.log('CompareScans.vue - projects: value changed');
      this.allProjects = projects;
    },
    /** Watch for project selection, load child experiments */
    async selectedProject(projectId) {
      console.log('CompareScans.vue - selectedProject: value changed');
      // Pass the object, not an array with the object
      const thisProject = this.allProjects.filter((project) => project.id === projectId)[0];
      await this.loadProject(thisProject);
      this.childExperiments = [];
      const keys = Object.keys(this.experiments);
      keys.forEach((key) => {
        const { name } = this.experiments[key];
        const { id } = this.experiments[key];
        this.childExperiments.push({ name, id });
      });
    },
    /** Watch for experiment selection, load child scans */
    async selectedExperiment(experiment) {
      console.log('CompareScans.vue - selectedExperiment: value changed');
      this.selectedExperiment = experiment;
      this.childScans = [];
      const keys = Object.keys(this.scans);
      keys.forEach((key) => {
        const { name } = this.scans[key];
        const { id } = this.scans[key];
        this.childScans.push({ name, id });
      });
    },
    async selectedScan1() {
      console.log('CompareScans.vue - selectedScan1: value changed');
      // Avoid error when loading a different image using same VtkViewer
      this.vtkView1Loaded = false;
      await this.loadImage(this.selectedScan1, 1);
    },
    async selectedScan2() {
      console.log('CompareScans.vue - selectedScan2: value changed');
      this.vtkView2Loaded = false;
      await this.loadImage(this.selectedScan2, 2);
    },
    async selectedScan3() {
      console.log('CompareScans.vue - selectedScan3: value changed');
      this.vtkView3Loaded = false;
      await this.loadImage(this.selectedScan3, 3);
    },
    vtkView1Loaded(vtkView1Loaded) {
      console.log('CompareScans.vue - vtkView1Loaded from watch', vtkView1Loaded);
      return true;
    },
    vtkView2Loaded(vtkView2Loaded) {
      console.log('CompareScans.vue - vtkView2Loaded from watch', vtkView2Loaded);
      return true;
    },
    vtkView3Loaded(vtkView3Loaded) {
      console.log('CompareScans.vue - vtkView3Loaded from watch', vtkView3Loaded);
      return true;
    },
  },
  mounted() {
    /** Wait until the view is mounted before attempting to load projects. */
    console.log('CompareScans.vue - mounted, now loadProjects')
    this.loadProjects();
  },
  methods: {
    ...mapActions([
      'loadProjects',
      'loadProject',
      'loadFrame',
    ]),
    /** Update the download progress */
    onFrameDownloadProgress(e) {
      console.log('CompareScans.vue - onFrameDownloadProgress: value changed', e);
      this.downloadLoaded = e.loaded;
      this.downloadTotal = e.total;
    },
    /** Get the specified image */
    async loadImage(scan, proxyNum) {
      console.log('CompareScans.vue - Running loadImage');
      // Attempt to load one image to start
      console.log(`CompareScans.vue - loadImage: scan id: ${scan.id}`);
      const frameId = this.scanFrames[scan.id][0];
      console.log('CompareScans.vue - loadImage: frameId', frameId);
      const frame = this.frames[frameId];
      console.log('CompareScans.vue - loadImage: frame', frame);
      if (frame) {
        await this.loadFrame({
          frame,
          onDownloadProgress: this.onFrameDownloadProgress,
          whichProxy: proxyNum,
        });
        console.log('CompareScans.vue - loadImage: After loadFrame');
      }
      console.log('CompareScans.vue - loadImage: vtkViews', this.vtkViews);
      if (proxyNum === 1) {
        this.vtkView1Loaded = true;
        console.log('CompareScans.vue - loadImage: vtkView1Loaded', this.vtkView1Loaded);
      } else if (proxyNum === 2) {
        this.vtkView2Loaded = true;
        console.log('CompareScans.vue - loadImage: vtkView2Loaded', this.vtkView2Loaded);
      } else if (proxyNum === 3) {
        this.vtkView3Loaded = true;
        console.log('CompareScans.vue - loadImage: vtkView3Loaded', this.vtkView3Loaded);
      }
    },
    openWindow(proxyNum) {
      console.log('CompareScans.vue - openWindow: Running');
      const project = this.selectedProject;
      const scan = this[`selectedScan${ proxyNum}`];
      window.open(`/#/${project}/${scan.id}`, '_blank');
    }
  },
};
</script>

<template>
  <div id="CompareScans">
    <div class="ProjectExperimentContainer">
      <div class="SelectProject">
        <v-select
          v-model="selectedProject"
          label="Project"
          :items="allProjects"
          item-text="name"
          item-value="id"
        />
      </div>
      <div class="SelectExperiment">
        <v-select
          v-model="selectedExperiment"
          label="Experiment"
          :items="childExperiments"
          item-text="name"
          item-value="id"
        />
      </div>
    </div>
    <div class="SelectScansContainer">
      <div class="SelectScan1">
        <v-select
          v-model="selectedScan1"
          label="Select Scan"
          :items="childScans"
          item-text="name"
          item-value="id"
          return-object
        />
      </div>
      <div class="SelectScan2">
        <v-select
          v-model="selectedScan2"
          label="Select Scan"
          :items="childScans"
          item-text="name"
          item-value="id"
          return-object
        />
      </div>
      <div class="SelectScan3">
        <v-select
          v-model="selectedScan3"
          label="Select Scan"
          :items="childScans"
          item-text="name"
          item-value="id"
          return-object
        />
      </div>
    </div>
    <div class="OpenButtonsContainer">
      <div class="OpenButton1">
        <v-btn
          elevation="2"
          @click="openWindow(1)"
        >Select Scan Left</v-btn>
      </div>
      <div class="OpenButton2">
        <v-btn
          elevation="2"
          @click="openWindow(2)"
        >Select Scan Middle</v-btn>
      </div>
      <div class="OpenButton3">
        <v-btn
          elevation="2"
          @click="openWindow(3)"
          >Select Scan Right</v-btn>
      </div>
    </div>
    <div class="vtkViewsContainer">
      <div class="vtk1">
        <template
          v-if="vtkView1Loaded"
        >
          <div>
            <VtkViewer
              id="vtk1"
              :view="vtkViews[1][0]"
              :proxy-num="1"
            />
          </div>
        </template>
      </div>
      <div class="vtk2">
        <template
          v-if="vtkView2Loaded"
        >
          <div>
            <VtkViewer
              id="vtk2"
              :view="vtkViews[2][0]"
              :proxy-num="2"
            />
          </div>
        </template>
      </div>
      <div class="vtk3">
        <template
          v-if="vtkView3Loaded"
        >
          <div>
            <VtkViewer
              id="vtk3"
              :view="vtkViews[3][0]"
              :proxy-num="3"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.vtkViewsContainer {
  display: grid;
  grid-auto-columns: 1fr;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr;
  gap: 0 0;
  grid-template-areas: "vtk1 vtk2 vtk3";
}

.vtk1 { grid-area: vtk1; }
.vtk2 { grid-area: vtk2; }
.vtk3 { grid-area: vtk3; }

.SelectScansContainer {
  display: grid;
  grid-auto-columns: 1fr;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr;
  gap: 10px 10px;
  grid-template-areas: "SelectScan1 SelectScan2 SelectScan3";
}

.selectScan1 { grid-area: selectScan1; }
.selectScan2 { grid-area: selectScan2; }
.selectScan3 { grid-area: selectScan3; }

.OpenButtonsContainer {
  display: grid;
  grid-auto-columns: 1fr;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr;
  gap: 10px 10px;
  grid-template-areas: "OpenButton1 OpenButton2 OpenButton3";
}

.selectScan1 { grid-area: selectScan1; }
.selectScan2 { grid-area: selectScan2; }
.selectScan3 { grid-area: selectScan3; }

.ProjectExperimentContainer {
  display: grid;
  grid-auto-columns: 1fr;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
  gap: 10px 10px;
  grid-template-areas: "SelectProject SelectExperiment";
}

.selectProject { grid-area: selectProject; }
.selectExperiment { grid-area: selectExperiment; }
</style>
