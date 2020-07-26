const router = require('express-promise-router')();

const db = require('../db');
const z3 = require('../z3');

// All calls on the edit route must be authenticated
router.all('/*', z3.checkIsAuthenticated);

router.param('postId', async (req, res, next, postId) => {

    const draft = await db.getNewestDraft(postId);
    req.draft = draft;

    const post = await db.getPost(postId);
    req.post = post;

    next();
});

router.get('/:postId', async (req, res) => {
    const postModel = z3.constructPostModel(req.draft);

    postModel.postId = req.post._id;
    postModel.isPreview = true; 
    
    res.render('blog', postModel);
});

module.exports = router;
