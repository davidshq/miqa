import { createLocalVue } from '@vue/test-utils';
import Vuex from 'vuex';
import cloneDeep from 'lodash/cloneDeep';
import { storeConfig } from '@/store';

describe('Vuex Mutations', () => {
  /**
  test('SET_CURRENT_VTK_INDEX_SLICES should set the current vtk index slices', () => {
    const localVue = createLocalVue();
    localVue.use(Vuex);
    const theStore = cloneDeep(storeConfig);
    const store = new Vuex.Store(theStore);
    expect(store.state.iIndexSlice).toBe(0);
    store.commit('SET_CURRENT_VTK_INDEX_SLICES', { indexAxis: 'i', value: 1});
    expect(store.state.iIndexSlice).toBe(1);
    expect(store.state.jIndexSlice).toBe(0);
    store.commit('SET_CURRENT_VTK_INDEX_SLICES', { indexAxis: 'j', value: 1});
    expect(store.state.jIndexSlice).toBe(1);
    expect(store.state.kIndexSlice).toBe(0);
    store.commit('SET_CURRENT_VTK_INDEX_SLICES', { indexAxis: 'k', value: 1});
    expect(store.state.kIndexSlice).toBe(1);
  });
  */

  test('SET_CURRENT_VTK_INDEX_SLICES should support multiple proxies', () => {
    const localVue = createLocalVue();
    localVue.use(Vuex);
    const theStore = cloneDeep(storeConfig);
    const store = new Vuex.Store(theStore);
    expect(store.state.iIndexSlice[0]).toBe(0);
    store.commit('SET_CURRENT_VTK_INDEX_SLICES', { indexAxis: 'i', value: 1, whichProxy: 0 });
    expect(store.state.iIndexSlice[0]).toBe(1);

    expect(store.state.jIndexSlice[1]).toBe(0);
    store.commit('SET_CURRENT_VTK_INDEX_SLICES', { indexAxis: 'j', value: 1, whichProxy: 1 });
    expect(store.state.jIndexSlice[1]).toBe(1);

    expect(store.state.kIndexSlice[2]).toBe(0);
    store.commit('SET_CURRENT_VTK_INDEX_SLICES', { indexAxis: 'k', value: 1, whichProxy: 2 });
    expect(store.state.kIndexSlice[2]).toBe(1);

    expect(store.state.iIndexSlice[3]).toBe(0);
    store.commit('SET_CURRENT_VTK_INDEX_SLICES', { indexAxis: 'i', value: 1, whichProxy: 3 });
    expect(store.state.iIndexSlice[3]).toBe(1);
  });
});
