const runtimeOptions = require('./runtimeOptions');
const sessionConfigLoader = require('./sessionConfigLoader');

const sessionConfigPromise = sessionConfigLoader.loadSession(runtimeOptions.authentication.defaultSessionConfig);
module.exports = sessionConfigPromise;