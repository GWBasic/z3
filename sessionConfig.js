const crypto = require('crypto');
const fsAsync = require('fs');

const runtimeOptions = require('./runtimeOptions');
const sessionConfigLoader = require('./sessionConfigLoader');

module.exports = sessionConfigLoader.loadSession(runtimeOptions.authentication.sessionConfigFile, runtimeOptions.authentication.defaultSessionConfig);