import Vue from 'vue';
import { createApp } from 'vue';
import App from './App.vue';
import store from './store';
import vuetify from './plugins/vuetify'
import { loadFonts } from './plugins/webfontloader'
import VueCompositionAPI from '@vue/composition-api';
import 'polyfill-object.fromentries';

import AsyncComputed from 'vue-async-computed';
import config from 'itk/itkConfig';
import router from './router';

import { STATIC_PATH } from './constants';

import './vtk/ColorMaps';
import vMousetrap from './vue-utilities/v-mousetrap';
import snackbarService from './vue-utilities/snackbar-service';
import promptService from './vue-utilities/prompt-service';

import djangoRest, { oauthClient } from './django';
import { setupHeartbeat } from './heartbeat';

Vue.use(VueCompositionAPI);
Vue.use(AsyncComputed);
Vue.use(vMousetrap);

Vue.use(snackbarService(vuetify));
Vue.use(promptService(vuetify));

config.itkModulesPath = STATIC_PATH + config.itkModulesPath;

Vue.config.productionTip = true;

(async () => {
  // If user closes the tab, we want them to be logged out if they return to the page
  await setupHeartbeat('miqa_logout_heartbeat', async () => { oauthClient.logout(); });
  await djangoRest.restoreLogin(store);
  await Promise.all([
    store.dispatch.reset(),
    store.dispatch.loadMe(),
    store.dispatch.loadConfiguration(),
  ]);

  new Vue({
    vuetify,
    router,
    store: store.original,
    provide: {
      user: store.state.me,
      MIQAConfig: store.state.MIQAConfig,
    },
    render: (h) => h(App),
  })
    .$mount('#app')
    // @ts-ignore
    .$snackbarAttach()
    .$promptAttach();
})();
