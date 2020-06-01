const createError = require('http-errors');
const router = require('express-promise-router')();

const cachedConfigurationValues = require('../cachedConfigurationValues');
const db = require('../db');
const z3 = require('../z3');

router.get('/', async (req, res, next) => {
    if (!(req.query.q)) {
        throw createError(400, 'Query unspecified');
    }

    const encodedQuery = encodeURIComponent(req.query.q);

    var host = req.headers.host;
    host = host.split(':')[0];

    const encodedHost = encodeURIComponent(host);

    const config = await cachedConfigurationValues.getConfig();

    var searchUrl;
    if (config.searchUrl.length > 0) {
        searchUrl = config.searchUrl;
    } else {
        searchUrl = z3.DEFAULT_SEARCH_URL;
    }

    searchUrl = searchUrl.replace('%query%', encodedQuery);
    searchUrl = searchUrl.replace('%host%', encodedHost);

    res.redirect(searchUrl);
});

module.exports = router;