import Vue from 'vue';
import Router from 'vue-router';

import ProjectsView from './views/Projects.vue';
import Scan from './views/Scan.vue';
import CompareScans from "./views/CompareScans.vue";
import SoloScan from './views/SoloScan.vue';

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: '/',
      name: 'projects',
      component: ProjectsView,
    },
    {
      path: '/comparescans',
      name: 'comparescans',
      component: CompareScans,
    },
    {
      path: '/soloscan',
      name: 'soloscan',
      component: SoloScan,
    },
    // Order matters
    {
      path: '/:projectId?/complete',
      name: 'projectComplete',
      component: ProjectsView,
    },
    {
      path: '/:projectId?/:scanId?',
      name: 'scan',
      component: Scan,
    },
    {
      path: '*',
      redirect: '/',
    },
  ],
});
