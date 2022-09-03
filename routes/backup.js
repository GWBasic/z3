const router = require('express-promise-router')();

const db = require('../db');
const z3 = require('../z3.js');

router.all('/*', z3.checkIsAuthenticated);

router.get('/', async (req, res) => {
    res.render('backup', {
    });
});

router.get('/articles', async (req, res) => {
    let allPosts = await db.getPosts(0);

    for (var post of allPosts) {
        let images = await db.getImagesForPost(post._id);

        for (var image of images) {
            image.imageData = image.imageData.toString('base64');
            image.normalSizeImageData = image.normalSizeImageData.toString('base64');
        }

        post.images = images;
    }

    res.status(200);
    res.json(allPosts);
});

module.exports = router;
