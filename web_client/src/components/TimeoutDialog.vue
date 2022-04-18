<script lang="ts">
import IdleJS from 'idle-js';
import {
  computed, defineComponent, ref,
} from '@vue/composition-api';
import djangoRest from '@/django';
import store from '@/store';

const warningDuration = 2 * 60 * 1000; // the warning box will pop up for 2 minutes
// The server-side session token lasts 30 minutes
const sessionTimeout = 30 * 60 * 1000;
// Log out after 15 minutes if the user is away from keyboard
const idleTimeout = 15 * 60 * 1000;

export default defineComponent({
  name: 'TimeoutDialog',
  setup() {
    const show = ref(false);
    const idleWarningTriggered = ref(false);
    const idleStartTime = ref(0);
    const timeRemaining = ref(0);
    const timeRemainingStr = computed(() => {
      const secondsRemaining = Math.floor(timeRemaining.value / 1000);
      const minutes = Math.floor(secondsRemaining / 60);
      const seconds = String(Math.floor(secondsRemaining % 60)).padStart(2, '0');
      return `${minutes}:${seconds}`;
    });

    const lastApiRequestTime = computed(() => store.state.lastApiRequestTime);

    const reset = () => {
      // Send a request to refresh the server token
      // Not awaited since we don't actually care about the result
      djangoRest.projects();

      // reset dialog
      show.value = false;
      idleWarningTriggered.value = false;
    };
    const logout = async () => {
      try {
        // This may fail with a 401 if the user has already been logged out
        await djangoRest.logout();
      } finally {
        // This will redirect to the login page
        await djangoRest.login();
      }
    };

    // Watch for an absence of user interaction
    const idle = new IdleJS({
      idle: idleTimeout - warningDuration,
      onIdle() {
        if (!show.value) {
          idleWarningTriggered.value = true;
          idleStartTime.value = Date.now();
        }
      },
    });
    idle.start();

    // This function calls itself after 1 second to check if the session has expired and to keep
    // the countdown timer up to date.
    const updateCountdown = () => {
      const now = Date.now();
      const sessionTimeRemaining = lastApiRequestTime.value + sessionTimeout - now;
      if (idleWarningTriggered.value) {
        // If the user is idle, we also need to consider the idle warning
        const idleTimeRemaining = idleStartTime.value + warningDuration - now;
        timeRemaining.value = Math.min(sessionTimeRemaining, idleTimeRemaining);
      } else {
        timeRemaining.value = sessionTimeRemaining;
      }
      // The timer has expired, log out
      if (timeRemaining.value <= 0) {
        logout();
      }
      // Show the warning if the time remaining is getting close to 0
      show.value = timeRemaining.value < warningDuration;
      setTimeout(updateCountdown, 1000);
    };
    updateCountdown();
    // TODO when the webpack dev server reloads, it doesn't stop this setTimeout loop.
    // The component that the old loop was servicing no longer exists so it doesn't actually matter,
    // but it would be nice to garbage collect it.

    return {
      show,
      idleWarningTriggered,
      timeRemaining,
      timeRemainingStr,
      reset,
      logout,
      sessionTimeout,
      idleTimeout,
    };
  },
});
</script>

<template>
  <v-dialog
    v-model="show"
    width="500"
    persistent
  >
    <v-card>
      <v-card-title class="text-h5 grey lighten-2">
        Warning
      </v-card-title>

      <v-card-text class="py-4 px-6">
        <p v-if="idleWarningTriggered">
          You have been idle for almost {{ Math.floor(idleTimeout / (60 * 1000)) }} minutes.
        </p>
        <p v-else>
          You have not made any network requests in almost
          {{ Math.floor(sessionTimeout / (60 * 1000)) }} minutes.
        </p>
        <p>
          Your session will automatically terminate in {{ timeRemainingStr }}
        </p>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn
          color="primary"
          text
          @click="reset"
        >
          Continue Session
        </v-btn>
        <v-btn
          color="secondary"
          text
          @click="logout"
        >
          Logout
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>