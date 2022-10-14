<script lang="ts">
import {
  mapActions,
  mapState,
} from 'vuex';

// import Navbar from '@/components/Navbar.vue';
// import VtkViewer from '@/components/VtkViewer.vue';
export default {
  name: 'CompareScans',
  components: {
    // Navbar,
  },
  inject: ['user'],
  data: () => ({
    allProjects: [],
    selectedProject: '',
    projectExperiments: [],
  }),
  computed: {
    ...mapState([
      'projects',
    ]),
  },
  watch: {
    async projects(projects) {
      console.log('watched projects');
      this.allProjects = projects;
      console.log(projects);
    },
  },
  methods: {
    ...mapActions([
      'loadProjects',
      'loadProject',
    ]),
  },
  mounted() {
    this.loadProjects();
    console.log('this is CompareScans');
    console.log(this.projects);
  },
};
</script>

<template>
  <div>
    <!--<Navbar />-->
    <v-select
      v-model="selectedProject"
      label="Project"
      :items="allProjects"
      item-text="name"
      item-value="id"
    >
    </v-select>
    <v-select
      label="Experiment"
    />
  </div>
</template>

<style lang="scss" scoped>
</style>
