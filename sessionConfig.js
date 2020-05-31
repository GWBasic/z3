const runtimeOptions = require('./runtimeOptions');
const sessionConfigLoader = require('./sessionConfigLoader');

module.exports = sessionConfigLoader.loadSession(runtimeOptions.authentication.defaultSessionConfig);