import { VIEW_ORIENTATIONS } from './constants';

/**
 * Gets views from proxyManager
 *
 * Used in Vuex Store
 *
 * @param proxyManager
 * @param viewType  e.g., View2D_Z:z, View2D_X:x, View2D_Y:y
 * @returns {null}
 */
function getView(proxyManager, viewType) {
  console.log('Running getView');
  const [type, name] = viewType.split(':');
  let view = null;
  const views = proxyManager.getViews();
  for (let i = 0; i < views.length; i += 1) {
    // If the view is of the type, e.g. View2D_Z, View2D_X, View2D_Y
    // console.log('getProxyName:');
    // console.log(views[i].getProxyName());
    // console.log('Type:');
    // console.log(type);
    // TODO: It looks like this code is never triggered.
    if (views[i].getProxyName() === type) {
      // If the view has a name, e.g. z, x, y
      // console.log('Name:');
      // console.log(name);
      if (name) {
        // If VTK view equals name, get the view
        // console.log('getName:');
        // console.log(views[i].getName());
        if (views[i].getName() === name) {
          view = views[i];
        }
      } else {
        // This actually seems to be what is triggered.
        view = views[i];
      }
    }
  }

  if (!view) {
    // Get a new proxy of Views
    view = proxyManager.createProxy('Views', type, { name });

    // Make sure representation is created for new view
    proxyManager
      .getSources()
      .forEach((source) => proxyManager.getRepresentation(source, view));

    // Update orientation
    //   LPS is the default of the view constructor
    //   Camera initialization when the view is rendered will override this
    //   with the project's preferred orientation
    const { axis, directionOfProjection, viewUp } = VIEW_ORIENTATIONS.LPS[name];
    view.updateOrientation(axis, directionOfProjection, viewUp);

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
