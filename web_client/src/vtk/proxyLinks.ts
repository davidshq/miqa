const Volume = [
  { link: 'Visibility', property: 'visibility', updateOnBind: true },
  { link: 'WW', property: 'windowWidth', updateOnBind: true },
  { link: 'WL', property: 'windowLevel', updateOnBind: true },
  { link: 'SliceX', property: 'xSlice', updateOnBind: true },
  { link: 'SliceY', property: 'ySlice', updateOnBind: true },
  { link: 'SliceZ', property: 'zSlice', updateOnBind: true },
];

const Geometry = [
  { link: 'GeometryColorBy', property: 'colorBy', updateOnBind: true },
  { link: 'Representation', property: 'representation', updateOnBind: true },
  { link: 'Opacity', property: 'opacity', updateOnBind: true },
  {
    link: 'InterpolateScalarsBeforeMapping',
    property: 'interpolateScalarsBeforeMapping',
    updateOnBind: true,
  },
  { link: 'Visibility', property: 'visibility', updateOnBind: true },
  { link: 'PointSize', property: 'pointSize', updateOnBind: true },
];

const Slice = [
  { link: 'Visibility', property: 'visibility', updateOnBind: true },
  { link: 'WW', property: 'windowWidth', updateOnBind: true },
  { link: 'WL', property: 'windowLevel', updateOnBind: true },
];

export default {
  Volume,
  Geometry,
  Slice,
};
