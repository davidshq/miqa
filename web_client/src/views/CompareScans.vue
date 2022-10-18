<script lang="ts">
import {
  mapActions,
  mapState,
} from 'vuex';

export default {
  name: 'CompareScans',
  components: {
  },
  inject: ['user'],
  data: () => ({
    allProjects: [],
    selectedProject: '',
    selectExperiments: [],
    selectedExperiment: '',
  }),
  computed: {
    ...mapState([
      'projects',
      'experiments',
    ]),
  },
  watch: {
    // Keeps the list of projects updated
    async projects(projects) {
      this.allProjects = projects;
    },
    // Selects a specific project, loads list of it's experiments
    async selectedProject(projectId) {
      // Pass the object, not an array with the object
      const thisProject = this.allProjects.filter((project) => project.id === projectId)[0];
      await this.loadProject(thisProject);
      this.selectExperiments = [];
      const keys = Object.keys(this.experiments);
      keys.forEach((key) => {
        const { name } = this.experiments[key];
        const { id } = this.experiments[key];
        this.selectExperiments.push({ name, id });
      });
    },
    // Selects a specific experiment, loads list of it's scans
    async selectedExperiment(experiment) {
      console.log('watched experiments');
      this.selectedExperiment = experiment;
      console.log(experiment);
    },
  },
  mounted() {
    this.loadProjects();
    console.log('this is CompareScans');
    console.log(this.projects);
  },
  methods: {
    ...mapActions([
      'loadProjects',
      'loadProject',
    ]),
  },
};
</script>

<template>
  <div>
    <v-select
      v-model="selectedProject"
      label="Project"
      :items="allProjects"
      item-text="name"
      item-value="id"
    />
    <v-select
      v-model="selectedExperiment"
      label="Experiment"
      :items="selectExperiments"
      item-text="name"
      item-value="id"
    />
    <table>
      <tr>
        <td><v-select label="Select Scan" /></td>
        <td><v-select label="Select Scan" /></td>
        <td><v-select label="Select Scan" /></td>
      </tr>
      <tr>
        <td>View 1</td>
        <td>View 2</td>
        <td>View 3</td>
      </tr>
      <tr>
        <td>Select View to Edit</td>
      </tr>
      <tr>
        <td>Control Panel</td>
      </tr>
    </table>
  </div>
</template>

<style lang="scss" scoped>
</style>
