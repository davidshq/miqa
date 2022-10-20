<script lang="ts">
import {
  mapState, mapGetters, mapMutations, mapActions,
} from 'vuex';
import djangoRest from '@/django';
import store from '@/store';

import UserAvatar from './UserAvatar.vue';
import ScanDecision from './ScanDecision.vue';
import DecisionButtons from './DecisionButtons.vue';
import WindowWidget from './WindowWidget.vue';

export default {
  name: 'ControlPanelFrame',
  components: {
    UserAvatar,
    ScanDecision,
    DecisionButtons,
    WindowWidget,
  },
  inject: ['user'],
  data: () => ({
    newExperimentNote: '',
    loadingLock: undefined,
  }),
  computed: {
    ...mapState([
      'proxyManager',
      'scanCachedPercentage',
      'showCrosshairs',
      'storeCrosshairs',
    ]),
    ...mapGetters([
      'currentViewData',
      'nextFrame',
      'previousFrame',
      'currentFrame',
      'myCurrentProjectRoles',
      'editRights',
      'experimentIsEditable',
    ]),
    experimentId() {
      // This could be retrieved using `currentExperiment` getter
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
      'setShowCrosshairs',
      'setStoreCrosshairs',
      'setCurrentFrameId',
    ]),
    // Link is name of link file
    // TODO: This doesn't seem to open the correct link
    openScanLink() {
      window.open(this.currentViewData.scanLink, '_blank');
    },
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
     * Change current frame view
     *
     * @param framePosition
     */
    slideToFrame(framePosition) {
      this.setCurrentFrameId(this.currentViewData.scanFramesList[framePosition - 1]);
    },
    // Change the currently displayed frame
    // TODO: Would it make sense to rename `updateImage` to `updateFrame`?
    updateImage() {
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
     * Handles navigation key presses
     *
     * TODO: Does it make sense to rename `handleKeyPress` to `handleNavigationKeyPress`?
     *
     * @param direction
     */
    handleKeyPress(direction) {
      this.direction = direction;
      this.updateImage();
    },
    /**
     * After every keystroke into experiment notes, this updates the local component state.
     *
     * TODO: Why are we keeping both Vuex state and local state, e.g., we update
     * this.currentViewData.experimentNote and the local this.newExperimentNote.
     *
     * @param value
     */
    handleExperimentNoteChange(value) {
      this.newExperimentNote = value;
    },
    // Saves the note using to backend and store
    async handleExperimentNoteSave() {
      if (this.newExperimentNote.length > 0) {
        try {
          // TODO: This shouldn't be necessary?
          const { updateExperiment } = store.commit;
          // Save note using API
          const newExpData = await djangoRest.setExperimentNote(
            this.currentViewData.experimentId, this.newExperimentNote,
          );
          this.$snackbar({
            text: 'Saved note successfully.',
            timeout: 6000,
          });
          // TODO: What happens to the old experiment notes?
          this.newExperimentNote = '';
          // TODO: This is where we actually commit the data...but this is already
          //  happening via bind?
          updateExperiment(newExpData);
        } catch (err) {
          this.$snackbar({
            text: `Save failed: ${err.response.data.detail || 'Server error'}`,
            timeout: 6000,
          });
        }
      }
    },
    // TODO: How does this work? Why < 2?
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
  <v-flex
    v-if="representation"
    shrink
    class="bottom"
  >
    <v-container
      fluid
      class="pa-0"
    >
      <v-row no-gutters>
        <!-- Left Pane (Project/Experiment) -->
        <!-- TODO: Extract into separate component -->
        <v-col
          cols="4"
          class="pa-2 pr-1"
        >
          <v-card
            height="100%"
            elevation="3"
          >
            <div class="d-flex">
              <div
                class="d-flex px-5 py-3 flex-grow-1 flex-column"
              >
                <div class="current-info-container">
                  <div>
                    Project:
                  </div>
                  <div>
                    {{ currentViewData.projectName }}
                  </div>
                </div>
                <div class="current-info-container">
                  <div>
                    Experiment:
                  </div>
                  <div>
                    {{ currentViewData.experimentName }}
                    <UserAvatar
                      v-if="currentViewData.lockOwner"
                      :target-user="currentViewData.lockOwner"
                      as-editor
                    />
                  </div>
                </div>
                <div class="current-info-container">
                  <div>
                    Subject:
                  </div>
                  <div>
                    <b>{{ currentViewData.scanSubject || 'None' }}</b>
                  </div>
                </div>
                <div class="current-info-container">
                  <div>
                    Session:
                  </div>
                  <div>
                    <b>{{ currentViewData.scanSession || 'None' }}</b>
                  </div>
                </div>
              </div>
              <div
                v-if="scanCachedPercentage < 1 && scanCachedPercentage > 0"
                class="px-6 py-8 align-center"
              >
                <v-progress-circular
                  :value="scanCachedPercentage * 100"
                  color="blue"
                />
                <div> Loading... </div>
              </div>
            </div>
            <v-textarea
              v-model="currentViewData.experimentNote"
              filled
              :disabled="!experimentIsEditable"
              no-resize
              height="95px"
              hide-details
              name="input-experiment-notes"
              label="Experiment Notes"
              placeholder="There are no notes on this experiment."
              class="mx-3"
              @input="handleExperimentNoteChange"
            />
            <v-row no-gutters>
              <v-col
                :class="newExperimentNote.length > 0 ? 'blue--text' : 'grey--text'"
                class="px-3 text-right"
                @click="handleExperimentNoteSave()"
              >
                Save Note
              </v-col>
            </v-row>
            <v-flex
              class="d-flex ml-5"
              style="flex-direction:row"
            >
              <div style="flex-grow: 1">
                <v-switch
                  :input-value="showCrosshairs"
                  label="Display crosshairs"
                  hide-details
                  class="shrink pa-0 ml-n2"
                  @change="setShowCrosshairs"
                />
              </div>
              <div style="flex-grow: 1">
                <v-switch
                  :input-value="storeCrosshairs"
                  label="Store crosshairs with decision"
                  hide-details
                  class="shrink pa-0 ml-n2"
                  @change="setStoreCrosshairs"
                />
              </div>
            </v-flex>
          </v-card>
        </v-col>
        <!-- End Left Pane (Project/Experiment) -->
        <!-- Center/Right Panes (Scan/Frame/Decision) -->
        <v-col
          cols="8"
          class="pa-2 pl-1"
        >
          <v-card
            height="100%"
            elevation="3"
          >
            <v-container
              fluid
              class="pa-0"
            >
              <v-row no-gutters>
                <!-- Center Pane (Scan/Frame) -->
                <!-- TODO: Extract as separate component -->
                <v-col cols="6">
                  <v-container
                    fill-height
                    fluid
                  >
                    <div
                      class="d-flex flex-column"
                      style="width: 100%"
                    >
                      <!-- Scan Navigation -->
                      <div class="d-flex justify-space-between">
                        <div>
                          Scan:
                          <p
                            :class="currentViewData.scanLink ? 'link' : 'grey--text'"
                            style="display:inline"
                            @click="openScanLink"
                          >
                            <b>{{ currentViewData.scanName }}</b>
                          </p>
                          <p
                            class="grey--text"
                            style="display:inline"
                          >
                            ({{ currentViewData.scanPosition }} /
                            {{ currentViewData.experimentScansList.length }})
                          </p>
                        </div>
                        <div>
                          <v-btn
                            :disabled="!currentViewData.upTo"
                            small
                            depressed
                            class="transparent-btn"
                            @mousedown="handleKeyPress('previous')"
                          >
                            <v-icon>fa-caret-up</v-icon>
                          </v-btn>
                          <v-btn
                            :disabled="!currentViewData.downTo"
                            small
                            depressed
                            class="transparent-btn"
                            @mousedown="handleKeyPress('next')"
                          >
                            <v-icon>fa-caret-down</v-icon>
                          </v-btn>
                        </div>
                      </div>
                      <!-- End Scan Navigation -->
                      <!-- Frame Navigation -->
                      <div class="d-flex justify-space-between">
                        <div>
                          Frame:
                          <p
                            class="grey--text"
                            style="display:inline"
                          >
                            ({{ currentViewData.framePosition }} /
                            {{ currentViewData.scanFramesList.length }})
                          </p>
                        </div>
                        <v-slider
                          :value="currentViewData.framePosition"
                          ticks="always"
                          tick-size="4"
                          :min="1"
                          :max="currentViewData.scanFramesList.length"
                          @input="slideToFrame"
                        />
                        <div>
                          <v-btn
                            :disabled="!previousFrame"
                            small
                            depressed
                            class="transparent-btn"
                            @mousedown="handleKeyPress('back')"
                          >
                            <v-icon>fa-caret-left</v-icon>
                          </v-btn>
                          <v-btn
                            :disabled="!nextFrame"
                            small
                            depressed
                            class="transparent-btn"
                            @mousedown="handleKeyPress('forward')"
                          >
                            <v-icon>fa-caret-right</v-icon>
                          </v-btn>
                        </div>
                      </div>
                      <!-- End Frame Navigation -->
                    </div>
                    <!-- Window Widget -->
                    <window-widget
                      :representation="representation"
                      :experiment-id="currentViewData.experimentId"
                    />
                    <!-- End Window Widget -->
                    <!-- ScanDecision -->
                    <v-row class="mx-0">
                      <v-col
                        cols="12"
                        class="grey lighten-4"
                        style="height: 100px; overflow:auto; margin: 15px 0px"
                      >
                        <ScanDecision
                          v-for="decision in currentViewData.scanDecisions"
                          :key="decision.id"
                          :decision="decision"
                        />
                        <div
                          v-if="!currentViewData.scanDecisions
                            || currentViewData.scanDecisions.length === 0"
                          class="grey--text"
                        >
                          This scan has no prior comments.
                        </div>
                      </v-col>
                    </v-row>
                    <!-- ScanDecision -->
                  </v-container>
                </v-col>
                <!-- End Center Pane (Scan/Frame) -->
                <!-- Right Pane (Decision) -->
                <v-col cols="6">
                  <DecisionButtons
                    :experiment-is-editable="experimentIsEditable"
                    :edit-rights="editRights"
                    :lock-owner="currentViewData.lockOwner"
                    :loading-lock="loadingLock"
                    @handleKeyPress="handleKeyPress"
                    @switchLock="switchLock"
                  />
                </v-col>
                <!-- End Right Pane (Decision) -->
              </v-row>
            </v-container>
          </v-card>
        </v-col>
        <!-- End Center/Right Panes (Scan/Frame/Decision) -->
      </v-row>
    </v-container>
  </v-flex>
</template>

<style lang="scss" scoped>
.transparent-btn.v-btn--disabled, .transparent-btn.v-btn--disabled::before,
.transparent-btn, .transparent-btn::before,
.theme--light.v-btn.v-btn--disabled:not(.v-btn--flat):not(.v-btn--text):not(.v-btn-outlined) {
  background-color: transparent !important;
}

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

.link {
  color: #1976d2;
  text-decoration: underline;
  cursor: pointer;
}

.current-info-container {
  display: flex;
  column-gap: 10px;
}
</style>
