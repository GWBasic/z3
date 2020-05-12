const crypto = require('crypto');
const fsAsync = require('fs');

module.exports.loadSession = (sessionConfigFile, defaultSessionConfig) => {
    if (!fsAsync.existsSync(sessionConfigFile)) {
        const sessionToWrite = defaultSessionConfig;
    
        const buf = Buffer.alloc(256);
        crypto.randomFillSync(buf);
        sessionToWrite.secret = buf.toString('base64');
    
        sessionToWriteJSON = JSON.stringify(sessionToWrite, null, 5);
        fsAsync.writeFileSync(sessionConfigFile, sessionToWriteJSON);
    }
    
    const sessionJSON = fsAsync.readFileSync(sessionConfigFile);
    const session = JSON.parse(sessionJSON);
    
    return session;
};