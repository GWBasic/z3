const crypto = require('crypto');
const fsAsync = require('fs');

const db = require('./db');

module.exports.loadSession = async defaultSessionConfig => {
    var session = await db.getConfiguration('session');

    if (session == null) {

        session = JSON.parse(JSON.stringify(defaultSessionConfig));

        const buf = Buffer.alloc(256);
        crypto.randomFillSync(buf);
        session.secret = buf.toString('base64');

        await db.setConfiguration('session', () => session, () => null);
    }
    
    return session;
};