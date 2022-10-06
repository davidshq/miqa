import vtkProxySource from 'vtk.js/Sources/Proxy/Core/SourceProxy';
import vtkImageMarchingCubes from 'vtk.js/Sources/Filters/General/ImageMarchingCubes';

/**
 * Used by proxy.js
 *
 * @type { {
 *          options: {
 *            autoUpdate: boolean,
 *            ui: [
 *            {
 *              widget: string, size: number,
 *              domain: {min: number, max: number, step: number},
 *              name: string, doc: string, label: string, propType: string, type: string
 *            },
 *            {
 *              widget: string, size: number, advanced: number,
 *              name: string, doc: string, label: string, type: string
 *            },
 *            {
 *              widget: string, size: number, advanced: number,
 *              name: string, doc: string, label: string, type: string
 *            },
 *            {
 *              size: number, name: string, label: string, propType: string
 *            }
 *            ],
 *            algoFactory: {
 *              extend: function(*, *, *=): void, newInstance: any
 *            },
 *            proxyPropertyMapping: {
 *              mergePoints: {property: string, modelKey: string},
 *              computeNormals: {property: string, modelKey: string},
 *              contourValue: {property: string, modelKey: string}}, updateDomain(*, *): void
 *           },
 *           class: {
 *            extend: function(*, *, *=): void, newInstance: any
 *           }
 *       } }
 */
const Contour = {
  class: vtkProxySource,
  options: {
    autoUpdate: false, // For now...
    algoFactory: vtkImageMarchingCubes,
    proxyPropertyMapping: {
      contourValue: { modelKey: 'algo', property: 'contourValue' },
      computeNormals: { modelKey: 'algo', property: 'computeNormals' },
      mergePoints: { modelKey: 'algo', property: 'mergePoints' },
    },
    updateDomain(self, frame) {
      const arrayToProcess = frame.getPointData().getScalars();
      frame.getPointData().getArrayByIndex(0);
      if (!arrayToProcess) {
        return;
      }
      const [min, max] = arrayToProcess.getRange();
      const step = Math.min(1, (max - min) / 500);
      self.updateProxyProperty('contourValue', {
        domain: { min, max, step },
      });
    },
    ui: [
      {
        label: 'Contour Value',
        name: 'contourValue',
        widget: 'slider',
        propType: 'slider',
        type: 'double',
        size: 1,
        domain: { min: 0, max: 1000, step: 1 },
        doc: 'Adjust contour value',
      },
      {
        label: 'Compute Normals',
        name: 'computeNormals',
        widget: 'checkbox',
        type: 'boolean',
        advanced: 0,
        size: 1,
        doc: 'Compute normal to enable smooth surface',
      },
      {
        label: 'Merge points',
        name: 'mergePoints',
        widget: 'checkbox',
        type: 'boolean',
        advanced: 0,
        size: 1,
        doc: 'Prevent point duplication by merging them',
      },
      {
        label: 'Update',
        name: 'update',
        propType: 'ExecuteProperty',
        size: 1,
      },
    ],
  },
};

export default {
  Contour,
};
