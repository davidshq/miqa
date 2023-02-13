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
      'currentView',
      'nextFrame',
      'previousFrame',
      'currentFrame',
      'editRights',
    ]),
    experimentId() {
      return this.currentView.experimentId;
    },
    representation() {
      return this.currentFrame && this.proxyManager[0].getRepresentations()[0];
    },
  },
  watch: {
    // Update the experiment that is locked
    experimentId(newValue, oldValue) {
      this.switchLock(newValue, oldValue);
      clearInterval(this.lockCycle);
    },
    currentView() {
      this.navigateToNextIfCurrentScanNull();
    },
  },
  mounted() {
    if (!this.navigateToNextIfCurrentScanNull()) {
      // Switch the lock to the current experiment
      this.switchLock(this.currentView.experimentId);
      // Handles key presses
      window.addEventListener('keydown', (event) => {
        // @ts-ignore
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
    this.setLock({ experimentId: this.currentView.experimentId, lockExperiment: false });
    clearInterval(this.lockCycle);
  },
  methods: {
    ...mapActions([
      'setLock',
    ]),
    ...mapMutations([
      'SET_CURRENT_FRAME_ID',
    ]),
    /**
     * Release lock on old experiment, set lock on new experiment
     *
     * Note: Lock is only set if the user has edit rights
     */
    async switchLock(newExperimentId, oldExperimentId = null, forceToLock = false) {
      if (!this.navigateToNextIfCurrentScanNull()) {
        // And the user has edit rights
        if (this.editRights) {
          this.loadingLock = true;
          // If there is an old experiment
          if (oldExperimentId) {
            try {
              await this.setLock({
                experimentId: oldExperimentId,
                lockExperiment: false,
                forceToLock,
              });
            } catch (err) {
              this.$snackbar({
                text: 'Failed to release edit access on Experiment.',
                timeout: 6000,
              });
            }
          }
          // Set the new lockExperiment
          try {
            await this.setLock({
              experimentId: newExperimentId,
              lockExperiment: true,
              forceToLock,
            });
            this.lockCycle = setInterval(async (experimentId) => {
              await this.setLock({ experimentId, lockExperiment: true });
            }, 1000 * 60 * 5, this.currentView.experimentId);
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
    navigateToScan(location) {
      if (!location) location = 'complete';
      if (location && location !== this.$route.params.scanId) {
        this.$router
          .push(`/${this.currentView.projectId}/${location}` || '')
          .catch(this.handleNavigationError);
      }
    },
    // Handles navigation key presses
    // TODO: Does it make sense to rename `handleKeyPress` to `handleNavigationKeyPress`?
    handleKeyPress(direction) {
      this.direction = direction;
      if (this.direction === 'back') {
        this.SET_CURRENT_FRAME_ID(this.previousFrame);
      } else if (this.direction === 'forward') {
        this.SET_CURRENT_FRAME_ID(this.nextFrame);
      } else if (this.direction === 'previous') {
        this.navigateToScan(this.currentView.upTo);
      } else if (this.direction === 'next') {
        this.navigateToScan(this.currentView.downTo);
      }
    },

    // If there aren't at least two keys in `currentView` we know
    // that we aren't looking at a valid scan, so advance to next.
    navigateToNextIfCurrentScanNull() {
      if (Object.keys(this.currentView).length < 2) {
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
