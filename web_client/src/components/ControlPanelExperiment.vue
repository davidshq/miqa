<script lang="ts">
import { mapGetters, mapMutations, mapState } from 'vuex';
import store from '@/store';
import djangoRest from '@/django';
import UserAvatar from './UserAvatar.vue';

export default {
  name: 'ControlPanelExperiment',
  components: { UserAvatar },
  data: () => ({
    newExperimentNote: '',
  }),
  computed: {
    ...mapState([
      'scanCachedPercentage',
      'showCrosshairs',
      'storeCrosshairs',
    ]),
    ...mapGetters([
      'currentView',
      'experimentIsEditable',
    ]),
  },
  methods: {
    ...mapMutations([
      'SET_SHOW_CROSSHAIRS',
      'SET_STORE_CROSSHAIRS',
    ]),
    /**
     * After every keystroke into experiment notes, this updates the local component state.
     *
     * TODO: Why are we keeping both Vuex state and local state, e.g., we update
     * this.currentView.experimentNote and the local this.newExperimentNote.
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
          const { UPDATE_EXPERIMENT } = store.commit;
          // Save note using API
          const newExpData = await djangoRest.setExperimentNote(
            this.currentView.experimentId, this.newExperimentNote,
          );
          this.$snackbar({
            text: 'Saved note successfully.',
            timeout: 6000,
          });
          // TODO: What happens to the old experiment notes?
          this.newExperimentNote = '';
          // TODO: This is where we actually commit the data...but this is already
          //  happening via bind?
          UPDATE_EXPERIMENT(newExpData);
        } catch (err) {
          this.$snackbar({
            text: `Save failed: ${err.response.data.detail || 'Server error'}`,
            timeout: 6000,
          });
        }
      }
    },
  },
};
</script>

<template>
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
              {{ currentView.projectName }}
            </div>
          </div>
          <div class="current-info-container">
            <div>
              Experiment:
            </div>
            <div>
              {{ currentView.experimentName }}
              <UserAvatar
                v-if="currentView.lockOwner"
                :target-user="currentView.lockOwner"
                as-editor
              />
            </div>
          </div>
          <div class="current-info-container">
            <div>
              Subject:
            </div>
            <div>
              <b>{{ currentView.scanSubject || 'None' }}</b>
            </div>
          </div>
          <div class="current-info-container">
            <div>
              Session:
            </div>
            <div>
              <b>{{ currentView.scanSession || 'None' }}</b>
            </div>
          </div>
        </div>
        <div
          v-if="scanCachedPercentage < 1 && scanCachedPercentage > 0"
          class="px-6 py-8 align-center"
        >
          <v-progress-circular
            :model-value="scanCachedPercentage * 100"
            color="blue"
          />
          <div> Loading...</div>
        </div>
      </div>
      <v-textarea
        v-model="currentView.experimentNote"
        variant="filled"
        :disabled="!experimentIsEditable"
        no-resize
        height="95px"
        hide-details
        name="input-experiment-notes"
        label="Experiment Notes"
        placeholder="There are no notes on this experiment."
        class="mx-3"
        @update:model-value="handleExperimentNoteChange"
      />
      <v-row no-gutters>
        <v-col
          :class="newExperimentNote.length > 0 ? 'blue--text' : 'grey--text'"
          class="px-3 text-right"
          @click="handleExperimentNoteSave"
        >
          Save Note
        </v-col>
      </v-row>
      <v-col
        class="d-flex ml-5"
        style="flex-direction:row"
      >
        <div style="flex-grow: 1">
          <v-switch
            :input-value="showCrosshairs"
            label="Display crosshairs"
            hide-details
            class="shrink pa-0 ml-n2"
            @update:model-value="SET_SHOW_CROSSHAIRS"
          />
        </div>
        <div style="flex-grow: 1">
          <v-switch
            :input-value="storeCrosshairs"
            label="Store crosshairs with decision"
            hide-details
            class="shrink pa-0 ml-n2"
            @update:model-value="SET_STORE_CROSSHAIRS"
          />
        </div>
      </v-col>
    </v-card>
  </v-col>
</template>

<style lang="scss" scoped>

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

.current-info-container {
  display: flex;
  column-gap: 10px;
}
</style>
