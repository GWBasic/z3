const router = require('express-promise-router')();

const db = require('../db');
const z3 = require('../z3.js');

router.all('/*', z3.checkIsAuthenticated);

router.get('/', async (req, res) => {

    const { skip, limit } = z3.calculateSkipLimit(req);

    const posts = await db.getPosts(skip, limit);
    const numPosts = await db.countAllPosts();

    var { nextStart, nextStartMax, previousStart, previousStartMax } = z3.calculateNextSkipLimits(skip, posts, numPosts, limit);

    const staticPages = Object.keys(await db.getAllStaticPages());

    res.render('dashboard', {
        staticPages,
        posts,
        start: skip + 1,
        end: skip + posts.length,
        nextStart,
        nextStartMax,
        previousStart,
        previousStartMax,
        limit
    });
});

module.exports = router;

