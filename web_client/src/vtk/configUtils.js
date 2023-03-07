/**
 * Creates a proxy definition
 *
 * Called by proxy.
 *
 * @param classFactory
 * @param ui
 * @param links
 * @param definitionOptions
 * @param props
 * @returns {{options: {ui: *[], links: *[]}, class, props: {}}}
 */
function createProxyDefinition(
  classFactory,
  ui = [],
  links = [],
  definitionOptions = {},
  props = {},
) {
  console.log('vtk/configUtils.js - createProxyDefinition: Running');
  // console.log('vtk/configUtils.js - createProxyDefinition: class, options, props', classFactory, { links, ui, ...definitionOptions }, props);
  return {
    class: classFactory,
    options: { links, ui, ...definitionOptions },
    props,
  };
}

/**
 *
 * @param def
 * @returns {*}
 */
function activateOnCreate(def) {
  console.log('vtk/configUtils.js - activateOnCreate: Running');
  /* eslint-disable no-param-reassign */
  def.options.activateOnCreate = true;
  return def;
}

export default {
  createProxyDefinition,
  activateOnCreate,
};
