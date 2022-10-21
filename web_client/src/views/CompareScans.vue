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
    <v-row id="ProjectExperimentSelect">
      <v-col>
        <v-select
          v-model="selectedProject"
          label="Project"
          :items="allProjects"
          item-text="name"
          item-value="id"
        />
      </v-col>
      <v-col>
        <v-select
          v-model="selectedExperiment"
          label="Experiment"
          :items="selectExperiments"
          item-text="name"
          item-value="id"
        />
      </v-col>
    </v-row>
    <v-row id="ScansSelects">
      <v-col>
        <v-select
          v-model="selectedScans[0]"
          label="Select Scan"
          :items="selectScans"
          item-text="name"
          item-value="id"
          return-object
        />
      </v-col>
      <v-col>
        <v-select
          v-model="selectedScans[1]"
          label="Select Scan"
          :items="selectScans"
          item-text="name"
          item-value="id"
          return-object
        />
      </v-col>
      <v-col>
        <v-select
          v-model="selectedScans[2]"
          label="Select Scan"
          :items="selectScans"
          item-text="name"
          item-value="id"
          return-object
        />
      </v-col>
    </v-row>
    <v-row id="ScanViews"
      class="frame fill-height"
    >
      <v-col class="layout-container">
        <template v-if="currentFrame">
          <div class="my-layout">
            <div class="view"><VtkViewer :view="vtkViews[0]" /></div>
            <div class="view"><VtkViewer :view="vtkViews[1]" /></div>
            <div class="view"><VtkViewer :view="vtkViews[2]" /></div>
          </div>
        </template>
      </v-col>
    </v-row>
    <v-row id="ControlPanelSelect">
      <v-col><v-select
        v-model="scanToEdit"
        label="Select Scan to Edit"
        :items="selectedScans"
        item-text="name"
        item-value="id"
      /></v-col>
    </v-row>
    <v-row id="ControlPanel">
      <v-col><p>Control Panel</p></v-col>
    </v-row>
  </div>
</template>

<style lang="scss" scoped>
.my-layout {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;

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
}

.frame {
  .scans-bar {
    display: flex;
    flex-direction: column;
    height: 100%;

    .scans-view {
      overflow: auto;
    }
  }

  .layout-container {
    position: relative;
  }

  .v-btn.smaller {
    height: 35px;
    width: 35px;
  }

  .bottom {
    > .container {
      position: relative;
    }

    .buttons {
      width: 100%;

      .v-btn {
        height: 36px;
        opacity: 1;
        flex: 1;
      }
    }
  }
}

.theme--light.v-btn.v-btn--disabled:not(.v-btn--flat):not(.v-btn--text):not(.v-btn-outlined),
.theme--light.v-btn:not(.v-btn--flat):not(.v-btn--text):not(.v-btn-outlined),
.v-btn::before {
  background-color: transparent !important;
}

</style>

<style lang="scss">
.load-completion {
  font-size: 1.1em;
}

.justifyRight {
  text-align: right;
}

.frame {
  .v-text-field.small .v-input__control {
    min-height: 36px !important;
  }

  .note-field .v-input__control {
    min-height: 36px !important;
  }

  .v-input--slider.frame-slider {
    margin-top: 0;
  }
}
</style>
