/**
 * Provides constants for Volume, Slice
 */

const Volume = [
  { link: 'Visibility', property: 'visibility', updateOnBind: true },
  { link: 'WW', property: 'windowWidth', updateOnBind: true },
  { link: 'WL', property: 'windowLevel', updateOnBind: true },
  { link: 'SliceX', property: 'xSlice', updateOnBind: true },
  { link: 'SliceY', property: 'ySlice', updateOnBind: true },
  { link: 'SliceZ', property: 'zSlice', updateOnBind: true },
];

const Slice = [
  { link: 'Visibility', property: 'visibility', updateOnBind: true },
  { link: 'WW', property: 'windowWidth', updateOnBind: true },
  { link: 'WL', property: 'windowLevel', updateOnBind: true },
];

export default {
  Volume,
  Slice,
};
