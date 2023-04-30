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
  return {
    class: classFactory,
    options: { links, ui, ...definitionOptions },
    props,
  };
}

// ----------------------------------------------------------------------------

function activateOnCreate(def) {
  /* eslint-disable no-param-reassign */
  def.options.activateOnCreate = true;
  return def;
}

export default {
  createProxyDefinition,
  activateOnCreate,
};
