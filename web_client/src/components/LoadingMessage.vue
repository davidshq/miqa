<script lang="ts">
import { mapState } from 'vuex';
import formatSize from '@/utils/calculateDownloadSize';

export default {
  name: 'LoadingMessage',
  props: {
    downloadLoaded: {},
    downloadTotal: {},
  },
  computed: {
    ...mapState([
      'loadingFrame',
    ]),
    // Calculate percentage of requested images downloaded
    downloadProgressPercent() {
      return 100 * (this.downloadLoaded / this.downloadTotal);
    },

    // Show downloading message with percent complete, once downloaded,
    // show loading image viewer message
    loadProgressMessage() {
      if (this.downloadTotal && this.downloadLoaded === this.downloadTotal) {
        return 'Loading image viewer...';
      }
      return `Downloading image ${formatSize(this.downloadLoaded)} / ${formatSize(this.downloadTotal)}`;
    },
  },
};
</script>

<template>
  <v-row
    v-if="loadingFrame"
    class="loading-indicator-container fill-height"
    align="center"
    justify="center"
  >
    <v-col>
      <v-row justify="center">
        <v-progress-circular
          :width="4"
          :size="56"
          :rotate="-90"
          :value="downloadProgressPercent"
          :indeterminate="downloadTotal === 0 || downloadTotal === downloadLoaded"
          color="primary"
        >
          {{ Math.round(downloadProgressPercent || 0) }}%
        </v-progress-circular>
      </v-row>
      <v-row
        justify="center"
        class="mt-2"
      >
        <div class="text-center">
          {{ loadProgressMessage }}
        </div>
      </v-row>
    </v-col>
  </v-row>
</template>
