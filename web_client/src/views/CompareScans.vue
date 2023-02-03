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
    async selectedScan1() {
      console.log('selectedScan1');
      await this.loadImage(this.selectedScan1, 1);
    },
    async selectedScan2() {
      console.log('selectedScan2');
      await this.loadImage(this.selectedScan2, 2);
    },
    async selectedScan3() {
      console.log('selectedScan3');
      await this.loadImage(this.selectedScan3, 3);
    },
    vtkView1Loaded(vtkView1Loaded) {
      console.log('vtkView1Loaded from watch', vtkView1Loaded);
      return true;
    },
    vtkView2Loaded(vtkView2Loaded) {
      console.log('vtkView2Loaded from watch', vtkView2Loaded);
      return true;
    },
    vtkView3Loaded(vtkView3Loaded) {
      console.log('vtkView3Loaded from watch', vtkView3Loaded);
      return true;
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
    async loadImage(scan, proxyNum) {
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
          whichProxy: proxyNum,
        });
        console.log('after swapToFrame');
      }
      console.log('vtkViews', this.vtkViews);
      if (proxyNum === 1) {
        this.vtkView1Loaded = true;
        console.log('vtkView1Loaded', this.vtkView1Loaded);
        console.log('vtkView1', this.vtkViews[1]);
        console.log('vtkView1', this.vtkViews[1][0]);
      } else if (proxyNum === 2) {
        this.vtkView2Loaded = true;
        console.log('vtkView2', this.vtkView2Loaded);
      } else if (proxyNum === 3) {
        this.vtkView3Loaded = true;
        console.log('vtkView3', this.vtkView3Loaded);
      }
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
            v-model="selectedScan1"
            label="Select Scan"
            :items="childScans"
            item-text="name"
            item-value="id"
            return-object
          />
        </v-col>
        <v-col>
          <v-select
            v-model="selectedScan2"
            label="Select Scan"
            :items="childScans"
            item-text="name"
            item-value="id"
            return-object
          />
        </v-col>
        <v-col>
          <v-select
            v-model="selectedScan3"
            label="Select Scan"
            :items="childScans"
            item-text="name"
            item-value="id"
            return-object
          />
        </v-col>
      </v-row>
    </v-col>
    <v-col
      id="ScanViews"
      class="layout-container"
    >
          <div>
            <template
              v-if="vtkView1Loaded"
              id="vtkView1"
            >
              <div>
                <VtkViewer
                  id="vtk1"
                  :view="vtkViews[1][1]"
                  :proxyNum="1"
                />
              </div>
            </template>
          </div>
          <div>
            <template
              v-if="vtkView2Loaded"
              id="vtkView2"
            >
              <div>
                <VtkViewer
                  id="vtk2"
                  :view="vtkViews[2][0]"
                  :proxyNum="2"
                />
              </div>
            </template>
          </div>
          <div>
            <template
              v-if="vtkView3Loaded"
              id="vtkView3"
            >
              <div>
                <VtkViewer
                  id="vtk3"
                  :view="vtkViews[3][1]"
                  :proxyNum="3"
                />
              </div>
            </template>
          </div>
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
  //display: flex;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;

  .view {
    position: relative;
    //flex: 1 0 0;

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
