const createError = require('http-errors');
const router = require('express-promise-router')();

const db = require('../db');
const z3 = require('../z3');

z3.config.defaultSearchUrl = 'https://www.google.com/search?q=%query%&as_sitesearch=%host%';

router.get('/', async (req, res, next) => {
    if (!(req.query.q)) {
        throw createError(400, 'Query unspecified');
    }

    const encodedQuery = encodeURIComponent(req.query.q);

    var host = req.headers.host;
    host = host.split(':')[0];

    const encodedHost = encodeURIComponent(host);

    var searchUrl;
    if (z3.config.searchUrl.length > 0) {
        searchUrl = z3.config.searchUrl;
    } else {
        searchUrl = z3.config.defaultSearchUrl;
    }

    searchUrl = searchUrl.replace('%query%', encodedQuery);
    searchUrl = searchUrl.replace('%host%', encodedHost);

    res.redirect(searchUrl);
});

module.exports = router;