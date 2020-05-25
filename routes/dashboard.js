const router = require('express-promise-router')();

const db = require('../db');
const z3 = require('../z3.js');

router.get('/', z3.checkIsAuthenticated, async (req, res) => {

    const { skip, limit } = z3.calculateSkipLimit(req);

    const posts = await db.getPosts(skip, limit);
    const numPosts = await db.countAllPosts();

    var { nextStart, nextStartMax, previousStart, previousStartMax } = z3.calculateNextSkipLimits(skip, posts, numPosts, limit);

    res.render('dashboard', {
        posts: posts,
        start: skip + 1,
        end: skip + posts.length,
        nextStart: nextStart,
        nextStartMax: nextStartMax,
        previousStart: previousStart,
        previousStartMax: previousStartMax,
        limit: limit
    });
});

module.exports = router;

