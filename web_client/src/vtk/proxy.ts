import vtk2DView from 'vtk.js/Sources/Proxy/Core/View2DProxy';
import vtkLookupTableProxy from 'vtk.js/Sources/Proxy/Core/LookupTableProxy';
import vtkPiecewiseFunctionProxy from 'vtk.js/Sources/Proxy/Core/PiecewiseFunctionProxy';
import vtkProxySource from 'vtk.js/Sources/Proxy/Core/SourceProxy';
import vtkSliceRepresentationProxy from 'vtk.js/Sources/Proxy/Representations/SliceRepresentationProxy';
import vtkView from 'vtk.js/Sources/Proxy/Core/ViewProxy';
import vtkVolumeRepresentationProxy from 'vtk.js/Sources/Proxy/Representations/VolumeRepresentationProxy';
import vtkGeometryRepresentationProxy from 'vtk.js/Sources/Proxy/Representations/GeometryRepresentationProxy';
import 'vtk.js/Sources/Rendering/Profiles/All';

import ConfigUtils from './configUtils';

import proxyUI from './proxyUI';
import proxyLinks from './proxyLinks';
import proxyFilter from './proxyFilter';
import proxyViewRepresentationMapping from './proxyViewRepresentationMapping';

const { createProxyDefinition, activateOnCreate } = ConfigUtils;

/**
 * Sets up the default rendered volume view
 *
 * Note: The options set here include annotation opacity,
 * visibility of orientation axes, orientation axes preset,
 * and orientation axes type.
 *
 * @param classFactory  e.g., vtkView, vtk2DView
 * @param ui            e.g., proxyUI.View3D, proxyUI.View2D
 * @param options       e.g., { axis: 0 }, { axis: 1 }, ...
 * @param props         Never passed
 * @returns {*}
 */
function createDefaultView(classFactory, ui, options?, props?) {
  console.log('vtk/proxy.js - createDefaultView: Running');
  return activateOnCreate(
    createProxyDefinition(
      classFactory,
      ui,
      [
        {
          type: 'application',
          link: 'AnnotationOpacity',
          property: 'annotationOpacity',
          updateOnBind: true,
        },
        {
          type: 'application',
          link: 'OrientationAxesVisibility',
          property: 'orientationAxesVisibility',
          updateOnBind: true,
        },
        {
          type: 'application',
          link: 'OrientationAxesPreset',
          property: 'presetToOrientationAxes',
          updateOnBind: true,
        },
        {
          type: 'application',
          link: 'OrientationAxesType',
          property: 'orientationAxesType',
          updateOnBind: true,
        },
      ],
      options,
      props,
    ),
  );
}

export default {
  definitions: {
    Proxy: {
      LookupTable: createProxyDefinition(vtkLookupTableProxy, [], [], {
        presetName: 'Default (Cool to Warm)',
      }),
      // Controls the appearance of the volume.
      PiecewiseFunction: createProxyDefinition(vtkPiecewiseFunctionProxy),
    },
    Sources: {
      // For stand-alone data objects
      TrivialProducer: activateOnCreate(createProxyDefinition(vtkProxySource)),
      Contour: proxyFilter.Contour,
    },
    Representations: {
      Geometry: createProxyDefinition(
        vtkGeometryRepresentationProxy,
        proxyUI.Geometry,
        proxyLinks.Geometry,
      ),
      Slice: createProxyDefinition(
        vtkSliceRepresentationProxy,
        proxyUI.Slice,
        proxyLinks.Slice,
      ),
      SliceX: createProxyDefinition(
        vtkSliceRepresentationProxy,
        proxyUI.Slice,
        [{ link: 'SliceX', property: 'slice', updateOnBind: true }].concat(
          proxyLinks.Slice,
        ),
      ),
      SliceY: createProxyDefinition(
        vtkSliceRepresentationProxy,
        proxyUI.Slice,
        [{ link: 'SliceY', property: 'slice', updateOnBind: true }].concat(
          proxyLinks.Slice,
        ),
      ),
      SliceZ: createProxyDefinition(
        vtkSliceRepresentationProxy,
        proxyUI.Slice,
        [{ link: 'SliceZ', property: 'slice', updateOnBind: true }].concat(
          proxyLinks.Slice,
        ),
      ),
      Volume: createProxyDefinition(
        vtkVolumeRepresentationProxy,
        proxyUI.Volume,
        proxyLinks.Volume,
      ),
    },
    Views: {
      View3D: createDefaultView(vtkView, proxyUI.View3D),
      View2D: createDefaultView(vtk2DView, proxyUI.View2D),
      View2D_X: createDefaultView(vtk2DView, proxyUI.View2D, { axis: 0 }),
      View2D_Y: createDefaultView(vtk2DView, proxyUI.View2D, { axis: 1 }),
      View2D_Z: createDefaultView(vtk2DView, proxyUI.View2D, { axis: 2 }),
      ScreenshotView2D_x: createDefaultView(vtk2DView, proxyUI.View2D, { axis: 0 }),
      ScreenshotView2D_y: createDefaultView(vtk2DView, proxyUI.View2D, { axis: 1 }),
      ScreenshotView2D_z: createDefaultView(vtk2DView, proxyUI.View2D, { axis: 2 }),
    },
  },
  representations: {
    View3D: proxyViewRepresentationMapping.View3D,
    View2D: proxyViewRepresentationMapping.View2D,
    View2D_X: {
      ...proxyViewRepresentationMapping.View2D,
      vtkImageData: { name: 'SliceX' },
    },
    View2D_Y: {
      ...proxyViewRepresentationMapping.View2D,
      vtkImageData: { name: 'SliceY' },
    },
    View2D_Z: {
      ...proxyViewRepresentationMapping.View2D,
      vtkImageData: { name: 'SliceZ' },
    },
    ScreenshotView2D_x: {
      ...proxyViewRepresentationMapping.View2D,
      vtkImageData: { name: 'SliceX' },
    },
    ScreenshotView2D_y: {
      ...proxyViewRepresentationMapping.View2D,
      vtkImageData: { name: 'SliceY' },
    },
    ScreenshotView2D_z: {
      ...proxyViewRepresentationMapping.View2D,
      vtkImageData: { name: 'SliceZ' },
    },
  },
  filters: {
    vtkImageData: ['Contour'],
  },
};
