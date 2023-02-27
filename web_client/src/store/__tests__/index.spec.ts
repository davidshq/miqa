import { createLocalVue } from '@vue/test-utils';
import Vuex from 'vuex';
import cloneDeep from 'lodash/cloneDeep';
import storeConfig from "../../store";
import flatted from 'flatted';

describe('Vuex Mutations', () => {
  test('"SET_CURRENT_VTK_INDEX_SLICES should set the current vtk index slices"', () => {
    const localVue = createLocalVue();
    localVue.use(Vuex);
    console.log(storeConfig);
    const theStore = new Vuex.Store(Object.assign({}, storeConfig));
    // const theStore = cloneDeep(storeConfig);
    const flattedStore = flatted.stringify(storeConfig);
    const parsedStore = flatted.parse(flattedStore);
    const store = new Vuex.Store(theStore);
    //console.log(store);
    // @ts-ignore
    expect(store.state.iIndexSlice).toBe(0);
  });
});
