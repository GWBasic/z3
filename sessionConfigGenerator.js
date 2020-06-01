const crypto = require('crypto');

module.exports.generateSecret = () => {
    const buf = Buffer.alloc(256);
    crypto.randomFillSync(buf);
    return buf.toString('base64');
}