const createError = require('http-errors');
const router = require('express-promise-router')();

const db = require('../db');
const z3 = require('../z3');

// All calls on the edit route must be authenticated
router.all('/*', z3.checkIsAuthenticated);

router.param('postId', async (req, res, next, postId) => {

    const post = await db.getPost(postId);
    req.post = post;

    const currentDraft = await db.getNewestDraft(req.post._id);
    req.currentDraft = currentDraft;

    next();
});

router.param('draftId', async (req, res, next, draftId) => {

    const draft = await db.getDraft(draftId);
    req.draft = draft;

    next();
});

function renderDraft(draft, req, res) {
    const postModel = z3.constructPostModel(draft);

    postModel.postId = req.post._id;
    postModel.isPreview = true;
    postModel.updated = draft.updatedAt;
    postModel.isCurrent = req.currentDraft._id == draft._id;

    res.render('blog', postModel);
}

router.get('/:postId', async (req, res) => {
    renderDraft(req.currentDraft, req, res, true);
});

router.get('/:postId/:draftId', async (req, res) => {

    if (req.draft.postId != req.post._id) {
        throw createError(400, 'The draft is not part of the post');
    }

    renderDraft(req.draft, req, res);
});

module.exports = router;

