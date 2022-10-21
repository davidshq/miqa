<script lang="ts">
import {
  mapActions,
  mapState,
} from 'vuex';

import VtkViewer from '@/components/VtkViewer.vue';

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
    selectExperiments: [],
    selectedExperiment: '',
    selectScans: [],
    selectedScans: [],
    scanToEdit: '',
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
    currentFrame() {
      return this.frames[this.currentFrameId];
    },
  },
  watch: {
    // Keeps the list of projects updated
    async projects(projects) {
      this.allProjects = projects;
    },
    // Selects a specific project, loads list of it's experiments
    async selectedProject(projectId) {
      // Pass the object, not an array with the object
      const thisProject = this.allProjects.filter((project) => project.id === projectId)[0];
      await this.loadProject(thisProject);
      this.selectExperiments = [];
      const keys = Object.keys(this.experiments);
      keys.forEach((key) => {
        const { name } = this.experiments[key];
        const { id } = this.experiments[key];
        this.selectExperiments.push({ name, id });
      });
    },
    // Selects a specific experiment, loads list of it's scans
    async selectedExperiment(experiment) {
      console.log('watched experiments');
      this.selectedExperiment = experiment;
      console.log(experiment);
      console.log('getting current scans');
      this.selectScans = [];
      const keys = Object.keys(this.scans);
      console.log('add scans to selectScans');
      keys.forEach((key) => {
        const { name } = this.scans[key];
        const { id } = this.scans[key];
        this.selectScans.push({ name, id });
      });
    },
    async selectedScans() {
      await this.loadImage();
    },
  },
  mounted() {
    this.loadProjects();
    console.log(this.projects);
  },
  methods: {
    ...mapActions([
      'loadProjects',
      'loadProject',
      'swapToFrame',
    ]),
    async loadImage() {
      // Attempting to load 1 image to start.
      const scan = this.selectedScans[0];
      const frameId = this.scanFrames[scan.id][0];
      console.log('loadImage: frameId');
      console.log(frameId);
      const frame = this.frames[frameId];
      console.log('loadImage: frame');
      console.log(frame);
      if (frame) {
        await this.swapToFrame({
          frame,
          onDownloadProgress: this.onFrameDownloadProgress,
        });
        console.log('after swapToFrame');
      }
    },
    onFrameDownloadProgress(e) {
      this.downloadLoaded = e.loaded;
      this.downloadTotal = e.total;
    },
  },
};
</script>

<template>
  <div>
    <v-select
      v-model="selectedProject"
      label="Project"
      :items="allProjects"
      item-text="name"
      item-value="id"
    />
    <v-select
      v-model="selectedExperiment"
      label="Experiment"
      :items="selectExperiments"
      item-text="name"
      item-value="id"
    />
    <table>
      <tr>
        <td>
          <v-select
            v-model="selectedScans[0]"
            label="Select Scan"
            :items="selectScans"
            item-text="name"
            item-value="id"
            return-object
          />
        </td>
        <td>
          <v-select
            v-model="selectedScans[1]"
            label="Select Scan"
            :items="selectScans"
            item-text="name"
            item-value="id"
            return-object
          />
        </td>
        <td>
          <v-select
            v-model="selectedScans[2]"
            label="Select Scan"
            :items="selectScans"
            item-text="name"
            item-value="id"
            return-object
          />
        </td>
      </tr>
      <tr>
        <template v-if="currentFrame">
          <td><div class="view"><VtkViewer :view="vtkViews[0]" /></div></td>
          <td>View 2</td>
          <td>View 3</td>
        </template>
      </tr>
      <tr>
        <td>
          <v-select
            v-model="scanToEdit"
            label="Select Scan to Edit"
            :items="selectedScans"
            item-text="name"
            item-value="id"
          />
        </td>
      </tr>
      <tr>
        <td>Control Panel</td>
      </tr>
    </table>
  </div>
</template>

<style lang="scss" scoped>
.view {
  position: relative;
  flex: 1 0 0;

  border: 1.5px solid white;
  border-top: none;
  border-bottom: none;

  &:first-child {
    border-left: none;
  }

  &:last-child {
    border-right: none;
  }
}
</style>
