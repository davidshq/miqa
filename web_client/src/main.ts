import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import vuetify from './plugins/vuetify';
import { loadFonts } from './plugins/webfontloader';
import 'polyfill-object.fromentries';

import AsyncComputed from 'vue-async-computed';
import config from 'itk/itkConfig';

import { STATIC_PATH } from './constants';

import './vtk/ColorMaps';
import vMousetrap from './vue-utilities/v-mousetrap';
import snackbarService from './vue-utilities/snackbar-service';
import promptService from './vue-utilities/prompt-service';

import djangoRest, { oauthClient } from './django';
import { setupHeartbeat } from './heartbeat';

Vue.use(AsyncComputed);
Vue.use(vMousetrap);

Vue.use(vuetify);

Vue.use(snackbarService(vuetify));
Vue.use(promptService(vuetify));

config.itkModulesPath = STATIC_PATH + config.itkModulesPath;

Vue.config.productionTip = true;

loadFonts();
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
    router,
    store: store.original,
    vuetify,
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
