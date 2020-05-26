const router = require('express-promise-router')();

const runtimeOptions = require('../runtimeOptions');

const z3 = require('../z3');

router.get('/*', async (req, res, next) => {
    const host = req.headers.host;
    if ((z3.config.forceDomain.length > 0) && (host != z3.config.forceDomain)) {
        const scheme = `http${(req.secure || z3.config.forceHttps) ? 's' : ''}://`;
        res.redirect(`${scheme}${z3.config.forceDomain}${req.originalUrl}`);
    } else if (z3.config.forceHttps && (!req.secure)) {
        res.redirect(`https://${z3.config.forceDomain}${req.originalUrl}`);
    } else if (z3.config.redirects[req.url]) {
        res.redirect(z3.config.redirects[req.url]);
    } else {
        next();
    }
});

module.exports = router;
