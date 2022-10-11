import { VIEW_ORIENTATIONS, ANNOTATIONS } from './constants';

// ----------------------------------------------------------------------------
// Never used?
function getNumberOfVisibleViews(proxyManager) {
  let nbViews = 0;
  proxyManager.getViews().forEach((v) => {
    nbViews += v.getContainer() ? 1 : 0;
  });
  return nbViews;
}

// ----------------------------------------------------------------------------
// Never used?
function getViewActions(proxyManager) {
  const possibleActions = {
    crop: false,
  };

  // To crop we need at list an image data
  proxyManager.getSources().forEach((s) => {
    const ds = s.getFrame();
    if (ds && ds.isA && ds.isA('vtkImageData')) {
      possibleActions.crop = true;
    }
  });

  return possibleActions;
}

// ----------------------------------------------------------------------------
// Never used?
function getViewType(view) {
  return `${view.getProxyName()}:${view.getName()}`;
}

// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// Never used?
function updateViewsAnnotation(proxyManager) {
  const hasImageData = proxyManager
    .getSources()
    .find((s) => s.getFrame().isA && s.getFrame().isA('vtkImageData'));
  const views = proxyManager.getViews();

  for (let i = 0; i < views.length; i += 1) {
    const view = views[i];
    view.setCornerAnnotation('se', '');
    if (view.getProxyName().indexOf('2D') !== -1 && hasImageData) {
      view.setCornerAnnotations(ANNOTATIONS, true);
    } else {
      view.setCornerAnnotation('nw', '');
    }
  }
}

// ----------------------------------------------------------------------------
export default {
  getViewType,
  getView,
  getViewActions,
  getNumberOfVisibleViews,
  updateViewsAnnotation,
};

export {
  getViewType,
  getView,
  getViewActions,
  getNumberOfVisibleViews,
  updateViewsAnnotation,
};
