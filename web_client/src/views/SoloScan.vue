<script lang="ts">
import {
  mapActions,
  mapState,
} from 'vuex';

import VtkViewer from '@/components/VtkViewer.vue';

export default {
  name: 'SoloScan',
  components: {
    VtkViewer,
  },
  inject: ['user'],
  data: () => ({
    allProjects: [],
    selectedProject: '',
    childExperiments: [],
    selectedExperiment: '',
    childScans: [],
    selectedScan: {},
    vtkViewLoaded: false,
  }),
  computed: {
    ...mapState([
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
      console.log('SoloScan.vue - projects: value changed');
      this.allProjects = projects;
    },
    /** Watch for project selection, load child experiments */
    async selectedProject(projectId) {
      console.log('SoloScan.vue - selectedProject: value changed');
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
      console.log('SoloScan.vue - selectedExperiment: value changed');
      this.selectedExperiment = experiment;
      this.childScans = [];
      const keys = Object.keys(this.scans);
      keys.forEach((key) => {
        const { name } = this.scans[key];
        const { id } = this.scans[key];
        this.childScans.push({ name, id });
      });
    },
    async selectedScan() {
      console.log('SoloScan.vue - selectedScan: value changed');
      // Avoid error when loading a different image using same VtkViewer
      this.vtkViewLoaded = false;
      await this.loadImage(this.selectedScan, 1);
    },
    vtkViewLoaded(vtkViewLoaded) {
      console.log('SoloScan.vue - vtkViewLoaded from watch', vtkViewLoaded);
      return true;
    },
  },
  mounted() {
    /** Wait until the view is mounted before attempting to load projects. */
    console.log('SoloScan.vue - mounted, now loadProjects')
    this.loadProjects();
  },
  methods: {
    ...mapActions([
      'loadProjects',
      'loadProject',
      'loadFrame',
    ]),
    /** Get the specified image */
    async loadImage(scan, proxyNum) {
      console.log('SoloScan.vue - Running loadImage');
      // Attempt to load one image to start
      console.log(`SoloScan.vue - loadImage: scan id: ${scan.id}`);
      const frameId = this.scanFrames[scan.id][0];
      console.log('SoloScan.vue - loadImage: frameId', frameId);
      const frame = this.frames[frameId];
      console.log('SoloScan.vue - loadImage: frame', frame);
      if (frame) {
        await this.loadFrame({
          frame,
          whichProxy: proxyNum,
        });
      }
      this.vtkViewLoaded = true;
      console.log('SoloScan.vue - loadImage: vtkViewLoaded', this.vtkViewLoaded);
    },
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
      <div class="SelectScan">
        <v-select
          v-model="selectedScan"
          label="Select Scan"
          :items="childScans"
          item-text="name"
          item-value="id"
          return-object
        />
      </div>
    </div>
    <div class="vtk1">
      <template
        v-if="vtkViewLoaded"
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
  </div>
</template>

<style lang="scss" scoped>
.ProjectExperimentContainer {
  display: grid;
  grid-auto-columns: 1fr;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr;
  gap: 10px 10px;
  grid-template-areas: "SelectProject SelectExperiment SelectScan";
}
</style>
