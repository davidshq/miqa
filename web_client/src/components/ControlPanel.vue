<script lang="ts">
import {
  mapActions, mapGetters, mapMutations, mapState,
} from 'vuex';
import ControlPanelExperiment from '@/components/ControlPanelExperiment.vue';
import ControlPanelScan from '@/components/ControlPanelScan.vue';
import ControlPanelDecision from './ControlPanelDecision.vue';

export default {
  name: 'ControlPanelFrame',
  components: {
    ControlPanelScan,
    ControlPanelExperiment,
    ControlPanelDecision,
  },
  inject: ['user'],
  data: () => ({
    loadingLock: undefined,
  }),
  computed: {
    ...mapState([
      'proxyManager',
    ]),
    ...mapGetters([
      'currentViewData',
      'nextFrame',
      'previousFrame',
      'currentFrame',
      'editRights',
    ]),
    experimentId() {
      return this.currentViewData.experimentId;
    },
    // TODO: Understand better
    representation() {
      return this.currentFrame && this.proxyManager.getRepresentations()[0];
    },
  },
  watch: {
    // Update the experiment that is locked
    experimentId(newValue, oldValue) {
      this.switchLock(newValue, oldValue);
      clearInterval(this.lockCycle);
    },
    currentViewData() {
      this.navigateToNextIfCurrentScanNull();
    },
  },
  mounted() {
    // If there is a current scan
    if (!this.navigateToNextIfCurrentScanNull()) {
      // Switch the lock to the current experiment
      this.switchLock(this.currentViewData.experimentId);
      // Handles key presses
      window.addEventListener('keydown', (event) => {
        if (['textarea', 'input'].includes(document.activeElement.type)) return;
        if (event.key === 'ArrowUp') {
          this.handleKeyPress('previous');
        } else if (event.key === 'ArrowDown') {
          this.handleKeyPress('next');
        } else if (event.key === 'ArrowLeft') {
          this.handleKeyPress('back');
        } else if (event.key === 'ArrowRight') {
          this.handleKeyPress('forward');
        }
      });
    }
  },
  beforeDestroy() {
    // Remove lock
    this.setLock({ experimentId: this.currentViewData.experimentId, lock: false });
    clearInterval(this.lockCycle);
  },
  methods: {
    ...mapActions([
      'setLock',
    ]),
    ...mapMutations([
      'setCurrentFrameId',
    ]),
    /**
     * Release lock on old experiment, set lock on new experiment
     *
     * Note: Lock is only set if the user has edit rights
     *
     * @param newExperimentId
     * @param oldExperimentId
     * @param force
     */
    async switchLock(newExperimentId, oldExperimentId = null, force = false) {
      // If there is a scan
      if (!this.navigateToNextIfCurrentScanNull()) {
        // And the user has edit rights
        if (this.editRights) {
          this.loadingLock = true;
          // If there is an old experiment
          if (oldExperimentId) {
            try {
              await this.setLock({ experimentId: oldExperimentId, lock: false, force });
            } catch (err) {
              this.$snackbar({
                text: 'Failed to release edit access on Experiment.',
                timeout: 6000,
              });
            }
          }
          // Set the new lock
          try {
            await this.setLock({ experimentId: newExperimentId, lock: true, force });
            this.lockCycle = setInterval(async (experimentId) => {
              await this.setLock({ experimentId, lock: true });
            }, 1000 * 60 * 5, this.currentViewData.experimentId);
          } catch (err) {
            this.$snackbar({
              text: 'Failed to claim edit access on Experiment.',
              timeout: 6000,
            });
            this.loadingLock = false;
          }
        }
      }
    },
    /**
     * Navigates to a different scan
     *
     * @param location
     */
    navigateToScan(location) {
      if (!location) location = 'complete';
      if (location && location !== this.$route.params.scanId) {
        this.$router
          .push(`/${this.currentViewData.projectId}/${location}` || '')
          .catch(this.handleNavigationError);
      }
    },
    /**
     * Handles navigation key presses
     *
     * TODO: Does it make sense to rename `handleKeyPress` to `handleNavigationKeyPress`?
     *
     * @param direction
     */
    handleKeyPress(direction) {
      this.direction = direction;
      if (this.direction === 'back') {
        this.setCurrentFrameId(this.previousFrame);
      } else if (this.direction === 'forward') {
        this.setCurrentFrameId(this.nextFrame);
      } else if (this.direction === 'previous') {
        this.navigateToScan(this.currentViewData.upTo);
      } else if (this.direction === 'next') {
        this.navigateToScan(this.currentViewData.downTo);
      }
    },

    /**
     * If there aren't at least two keys in `currentViewData` we know
     * that we aren't looking at a valid scan, so advance to next.
     */
    navigateToNextIfCurrentScanNull() {
      if (Object.keys(this.currentViewData).length < 2) {
        this.handleKeyPress('next');
        return true;
      }
      return false;
    },
  },
};
</script>

<template>
  <v-col
    v-if="representation"
    class="bottom shrink"
  >
    <v-container
      fluid
      class="pa-0"
    >
      <v-row no-gutters>
        <ControlPanelExperiment />

        <ControlPanelScan
          :representation="representation"
          @handleKeyPress="handleKeyPress"
        />

        <ControlPanelDecision
          :loading-lock="loadingLock"
          @handleKeyPress="handleKeyPress"
          @switchLock="switchLock"
        />
      </v-row>
    </v-container>
  </v-col>
</template>

<style lang="scss" scoped>

.bounce-enter-active {
  animation: bounce-in .5s;
}
.bounce-leave-active {
  animation: bounce-in .5s reverse;
}
@keyframes bounce-in {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.5);
  }
  100% {
    transform: scale(1);
  }
}

</style>
