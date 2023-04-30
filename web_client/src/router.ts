import Vue from 'vue';
import Router from 'vue-router';

import ProjectsView from './views/Projects.vue';
import ScanView from './views/Scan.vue';
import CompareScans from "./views/CompareScans.vue";

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
    // Order matters
    {
      path: '/:projectId?/complete',
      name: 'projectComplete',
      component: ProjectsView,
    },
    {
      path: '/:projectId?/:scanId?',
      name: 'scan',
      component: ScanView,
    },
    {
      path: '*',
      redirect: '/',
    },
  ],
});
