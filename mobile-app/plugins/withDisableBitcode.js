const { withXcodeProject } = require('@expo/config-plugins');

const withDisableBitcode = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;

    // Deshabilitar bitcode en todas las configuraciones
    xcodeProject.addBuildProperty('ENABLE_BITCODE', 'NO');

    // También deshabilitar para frameworks
    xcodeProject.addBuildProperty('ENABLE_BITCODE', 'NO', 'Debug');
    xcodeProject.addBuildProperty('ENABLE_BITCODE', 'NO', 'Release');

    return config;
  });
};

module.exports = withDisableBitcode;
