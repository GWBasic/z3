const router = require('express-promise-router')();

const runtimeOptions = require('../runtimeOptions');

const cachedConfigurationValues = require('../cachedConfigurationValues');
const z3 = require('../z3');

router.get('/*', async (req, res, next) => {
    const host = req.headers.host;
    const config = await cachedConfigurationValues.getConfig();

    if ((config.forceDomain.length > 0) && (host != config.forceDomain)) {
        const scheme = `http${(req.secure || config.forceHttps) ? 's' : ''}://`;
        res.redirect(`${scheme}${config.forceDomain}${req.originalUrl}`);
    } else if (config.forceHttps && (!req.secure)) {
        res.redirect(`https://${config.forceDomain}${req.originalUrl}`);
    } else if (config.redirects[req.url]) {
        res.redirect(config.redirects[req.url]);
    } else {
        next();
    }
});

module.exports = router;
