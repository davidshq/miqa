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
    childExperiments: [],
    selectedExperiment: '',
    childScans: [],
    selectedScan: '',
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
    /** Watch for changes to available projects */
    async projects(projects) {
      this.allProjects = projects;
    },
    /** Watch for project selection, load child experiments */
    async selectedProject(projectId) {
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
      this.selectedExperiment = experiment;
      this.childScans = [];
      const keys = Object.keys(this.scans);
      keys.forEach((key) => {
        const { name } = this.scans[key];
        const { id } = this.scans[key];
        this.childScans.push({ name, id });
      });
    },
    /** Watch for scan selection, load associated image */
    async selectedScan() {
      console.log('selectedScan', this.selectedScan);
      await this.loadImage(this.selectedScan);
    },
  },
  mounted() {
    /** Wait until the view is mounted before attempting to load projects. */
    this.loadProjects();
  },
  methods: {
    ...mapActions([
      'loadProjects',
      'loadProject',
      'swapToFrame',
      'loadFrame',
    ]),
    /** Update the download progress */
    onFrameDownloadProgress(e) {
      this.downloadLoaded = e.loaded;
      this.downloadTotal = e.total;
    },
    /** Get the specified image */
    async loadImage(scan) {
      // Attempt to load one image to start
      console.log(`loadImage: scan id: ${scan.id}`);
      const frameId = this.scanFrames[scan.id][0];
      console.log('loadImage: frameId', frameId);
      const frame = this.frames[frameId];
      console.log('loadImage: frame', frame);
      if (frame) {
        await this.loadFrame({
          frame,
          onDownloadProgress: this.onFrameDownloadProgress,
        });
        console.log('after swapToFrame');
      }
      console.log('vtkViews', this.vtkViews);
    },
  },
};
</script>

<template>
  <v-row
    class="frame fill-height flex-column ma-0"
  >
    <v-col id="ProjectExperimentSelect" class="shrink">
      <v-row>
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
            :items="childExperiments"
            item-text="name"
            item-value="id"
          />
        </v-col>
      </v-row>
    </v-col>
    <v-col id="ScansSelects" class="shrink">
      <v-row>
        <v-col>
          <v-select
            v-model="selectedScan"
            label="Select Scan"
            :items="childScans"
            item-text="name"
            item-value="id"
            return-object
          />
        </v-col>
        <v-col>
          <v-select
            v-model="selectedScan"
            label="Select Scan"
            :items="childScans"
            item-text="name"
            item-value="id"
            return-object
          />
        </v-col>
        <v-col>
          <v-select
            v-model="selectedScan"
            label="Select Scan"
            :items="childScans"
            item-text="name"
            item-value="id"
            return-object
          />
        </v-col>
      </v-row>
    </v-col>
    <v-col id="ScanViews" class="layout-container">
      <template v-if="currentFrame">
        <div class="my-layout">
          <div
            v-for="(vtkView, index) in vtkViews[0]"
            :key="index"
            class="view"
          >
            <VtkViewer :view="vtkView" />
          </div>
        </div>
      </template>
    </v-col>
  </v-row>
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
