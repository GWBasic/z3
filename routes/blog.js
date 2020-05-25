const router = require('express-promise-router')();

const db = require('../db');
const z3 = require('../z3');

router.get('/', async (req, res, next) => {

    const { skip, limit } = z3.calculateSkipLimit(req);

    const posts = await db.getPublishedPosts(skip, limit);
    const numPosts = await db.countPublishedPosts();

    var { nextStart, nextStartMax, previousStart, previousStartMax } = z3.calculateNextSkipLimits(skip, posts, numPosts, limit);

    res.render('blogindex', {
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
