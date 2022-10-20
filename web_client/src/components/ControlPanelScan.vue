<script lang="ts">
import { mapGetters } from 'vuex';
import ScanDecision from './ScanDecision.vue';
import WindowWidget from './WindowWidget.vue';

export default {
  name: 'ControlPanelScan',
  components: { ScanDecision, WindowWidget },
  props: {
    representation: {},
  },
  computed: {
    ...mapGetters([
      'currentViewData',
      'nextFrame',
      'previousFrame',
    ]),
  },
  methods: {
    // Link is name of link file
    // TODO: This doesn't seem to open the correct link
    openScanLink() {
      window.open(this.currentViewData.scanLink, '_blank');
    },
    /**
     * Change current frame view
     *
     * @param framePosition
     */
    slideToFrame(framePosition) {
      this.setCurrentFrameId(this.currentViewData.scanFramesList[framePosition - 1]);
    },
  },
};
</script>

<template>
  <v-col
    cols="4"
    class="pa-2 pl-1"
  >
    <v-card
      height="100%"
      elevation="3"
    >
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
                @mousedown="$emit('handleKeyPress', 'previous')"
              >
                <v-icon>fa-caret-up</v-icon>
              </v-btn>
              <v-btn
                :disabled="!currentViewData.downTo"
                small
                depressed
                class="transparent-btn"
                @mousedown="$emit('handleKeyPress', 'next')"
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
                @mousedown="$emit('handleKeyPress', 'back')"
              >
                <v-icon>fa-caret-left</v-icon>
              </v-btn>
              <v-btn
                :disabled="!nextFrame"
                small
                depressed
                class="transparent-btn"
                @mousedown="$emit('handleKeyPress', 'forward')"
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
            style="height: 100px; overflow:auto; margin: 15px 0"
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
    </v-card>
  </v-col>
</template>

<style lang="scss" scoped>
.transparent-btn.v-btn--disabled, .transparent-btn.v-btn--disabled::before,
.transparent-btn, .transparent-btn::before,
.theme--light.v-btn.v-btn--disabled:not(.v-btn--flat):not(.v-btn--text):not(.v-btn-outlined) {
  background-color: transparent !important;
}

.link {
  color: #1976d2;
  text-decoration: underline;
  cursor: pointer;
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
