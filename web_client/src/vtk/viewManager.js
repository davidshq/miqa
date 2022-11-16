import { VIEW_ORIENTATIONS } from './constants';

/**
 * Used in Vuex Store
 *
 * @param proxyManager
 * @param viewType  e.g., View2D_Z:z, View2D_X:x, View2D_Y:y
 * @returns {null}
 */
function getView(proxyManager, viewType) {
  const [type, name] = viewType.split(':');
  let view = null;
  const views = proxyManager.getViews();
  for (let i = 0; i < views.length; i += 1) {
    // If the view is of the type, e.g. View2D_Z, View2D_X, View2D_Y
    if (views[i].getProxyName() === type) {
      // If the view has a name, e.g. z, x, y
      if (name) {
        // If VTK view equals name, get the view
        if (views[i].getName() === name) {
          view = views[i];
        }
      } else {
        // TODO: This seems redundant?
        view = views[i];
      }
    }
  }

  if (!view) {
    view = proxyManager.createProxy('Views', type, { name });

    // Make sure representation is created for new view
    proxyManager
      .getSources()
      .forEach((s) => proxyManager.getRepresentation(s, view));

    // Update orientation
    //   LPS is the default of the view constructor
    //   Camera initialization when the view is rendered will override this
    //   with the project's preferred orientation
    const { axis, orientation, viewUp } = VIEW_ORIENTATIONS.LPS[name];
    view.updateOrientation(axis, orientation, viewUp);

    // set background to transparent
    view.setBackground(0, 0, 0, 0);

    // FIXME: Use storage to choose defaults
    view.setPresetToOrientationAxes('default');
  }

  return view;
}

export default {
  getView,
};

export {
  getView,
};
