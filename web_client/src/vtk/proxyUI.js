/**
 * Constants for Volume, Geometry, Slice, Molecule, Glyph, View3D, View2D, and Skybox
 */

const Volume = [
  {
    name: 'colorBy',
    domain: {},
  },
  {
    name: 'volumeVisibility',
  },
  {
    name: 'useShadow',
  },
  {
    name: 'sampleDistance',
    domain: { min: 0, max: 1, step: 0.01 },
  },
  {
    name: 'edgeGradient',
    domain: { min: 0, max: 1, step: 0.01 },
  },
  {
    name: 'windowWidth',
    domain: { min: 0, max: 255, step: 0.01 },
  },
  {
    name: 'windowLevel',
    domain: { min: 0, max: 255, step: 0.01 },
  },
  {
    name: 'sliceVisibility',
  },
  {
    name: 'xSlice',
    domain: { min: 0, max: 255, step: 1 },
  },
  {
    name: 'ySlice',
    domain: { min: 0, max: 255, step: 1 },
  },
  {
    name: 'zSlice',
    domain: { min: 0, max: 255, step: 1 },
  },
];

const Slice = [
  {
    name: 'visibility',
  },
  {
    name: 'windowWidth',
    domain: { min: 0, max: 255, step: 0.01 },
  },
  {
    name: 'windowLevel',
    domain: { min: 0, max: 255, step: 0.01 },
  },
  {
    name: 'slice',
    domain: { min: 0, max: 255, step: 1 },
  },
];

const View3D = [
  { name: 'name' },
  {
    name: 'background',
    domain: {
      palette: [],
    },
  },
  {
    name: 'orientationAxesVisibility',
  },
  {
    name: 'presetToOrientationAxes',
    domain: {
      items: [
        { text: 'XYZ', value: 'default' },
        { text: 'LPS', value: 'lps' },
      ],
    },
  },
];

const View2D = [
  { name: 'name' },
  {
    name: 'background',
    domain: {
      palette: [],
    },
  },
  {
    name: 'orientationAxesVisibility',
  },
  {
    name: 'presetToOrientationAxes',
    domain: {
      items: [
        { text: 'XYZ', value: 'default' },
        { text: 'LPS', value: 'lps' },
      ],
    },
  },
  {
    name: 'annotationOpacity',
    domain: { min: 0, max: 1, step: 0.01 },
  },
];

export default {
  Volume,
  Slice,
  View3D,
  View2D,
};
