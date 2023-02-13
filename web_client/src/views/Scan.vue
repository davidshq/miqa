<script lang="ts">
import {
  mapActions, mapState,
} from 'vuex';

import Navbar from '@/components/Navbar.vue';
import ControlPanel from '@/components/ControlPanel.vue';
import ExperimentsView from '@/components/ExperimentsView.vue';
import VtkViewer from '@/components/VtkViewer.vue';
import LoadingMessage from '@/components/LoadingMessage.vue';

export default {
  name: 'Scan',
  components: {
    LoadingMessage,
    Navbar,
    ExperimentsView,
    VtkViewer,
    ControlPanel,
  },
  inject: ['user'],
  data() {
    return {
      downloadLoaded: 0,
      downloadTotal: 0,
    };
  },
  computed: {
    ...mapState([
      'currentFrameId',
      'vtkViews',
      'frames',
      'scanFrames',
      'errorLoadingFrame',
    ]),
    currentFrame() {
      return this.frames[this.currentFrameId];
    },
  },
  watch: {
    async currentFrameId(frameId) {
      await this.swapToFrame({
        frame: this.frames[frameId],
        onDownloadProgress: this.onFrameDownloadProgress,
      });
    },
    // Replaces `beforeRouteUpdate` and code in `created` handling frame load
    '$route.params.scanId': {
      handler: 'swapToScan',
      immediate: true,
    },
  },
  mounted() {
    window.addEventListener('unauthorized', () => {
      this.$snackbar({
        text: 'Server session expired. Try again.',
        timeout: 6000,
      });
    });
  },
  methods: {
    ...mapActions([
      'swapToFrame',
      'loadScan',
    ]),
    // Update download percents for loading bar
    onFrameDownloadProgress(e) {
      this.downloadLoaded = e.loaded;
      this.downloadTotal = e.total;
    },
    // Loads a specific frame
    async swapToScan() {
      // Get the project/frame id's from the URL
      const { projectId, scanId } = this.$route.params;
      const scan = await this.loadScan({ scanId, projectId });
      const frame = this.frames[this.scanFrames[scan.id][0]];
      if (frame) {
        await this.swapToFrame({
          frame,
          onDownloadProgress: this.onFrameDownloadProgress,
        });
      } else {
        this.$router.replace('/').catch(this.handleNavigationError);
      }
    },
  },
};
</script>

<template>
  <v-row
    class="frame fill-height flex-column ma-0"
  >
    <!-- Top Navbar -->
    <Navbar frame-view />
    <!-- Left Navigation Drawer -->
    <v-navigation-drawer
      expand-on-hover
      permanent
      app
      width="350px"
    >
      <v-list>
        <v-list-item>
          <v-icon>fas fa-list</v-icon>
          <v-toolbar-title class="pl-5">
            Experiments
          </v-toolbar-title>
        </v-list-item>
        <v-list-item>
          <v-icon />
          <ExperimentsView
            class="mt-1"
            minimal
          />
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <!-- Show Loading Message -->
    <LoadingMessage
      :download-loaded="downloadLoaded"
      :download-total="downloadTotal"
    />
    <!-- Show VTK Viewers -->
    <template v-if="currentFrame">
      <v-col
        class="layout-container"
      >
        <div class="my-layout">
          <div
            v-for="(vtkView, index) in vtkViews[0]"
            :key="index"
            class="view"
          >
            <VtkViewer :view="vtkView" />
          </div>
        </div>
        <!-- Show Error Loading Frame -->
        <v-row
          v-if="errorLoadingFrame"
          class="align-center justify-center fill-height"
        >
          <div class="text-h6">
            Error loading this frame
          </div>
        </v-row>
        <!-- End Error Loading Frame -->
      </v-col>
      <!-- End Show VTK Viewers -->
      <!-- Show Bottom Control Panel -->
      <ControlPanel />
    </template>
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

  .experiment-note {
    max-width: 250px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

.v-list-item__content.note-history {
  width: 500px;
  max-height: 400px;
  overflow-y: auto;
}
</style>
