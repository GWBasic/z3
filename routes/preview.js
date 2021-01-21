const createError = require('http-errors');
const router = require('express-promise-router')();

const db = require('../db');
const z3 = require('../z3');

// All calls on the edit route must be authenticated
//router.all('/*', z3.checkIsAuthenticated);

router.param('postId', async (req, res, next, postId) => {

    const post = await db.getPost(postId);
    req.post = post;

    if (!z3.isLoggedIn(req)) {
        if (post.previewPassword === null) {
            next(createError(401));
        } else if (post.previewPassword.length == 0) {
            next(createError(401));
        }
    }

    const currentDraft = await db.getNewestDraft(req.post._id);
    req.currentDraft = currentDraft;

    next();
});

router.param('draftId', async (req, res, next, draftId) => {

    const draft = await db.getDraft(draftId);
    req.draft = draft;

    if (req.draft.postId != req.post._id) {
        next(createError(400, 'The draft is not part of the post'));
    }

    next();
});

router.param('imageFilename', async (req, res, next, imageFilename) => {
    const imageRecord = await db.getImageForPostByFilename(req.post._id, imageFilename);
    req.imageRecord = imageRecord;

    next();
});

async function renderDraft(draft, req, res) {
    const postModel = z3.constructPostModel(draft);

    postModel.postId = req.post._id;
    postModel.isPreview = true;
    postModel.updated = draft.updatedAt;
    postModel.isCurrent = req.currentDraft._id == draft._id;
    postModel.previewPassword = req.post.previewPassword;

    // Update image tags to resize
    const extractedImages = await z3.extractImages(postModel.content, `preview/image/${postModel.postId}`, postModel.postId);
    postModel.content = extractedImages.content;

    res.render('blog', postModel);
}

async function handlePassword(req, res) {
    const previewPassword = req.body.previewPassword;

    if (z3.isLoggedIn(req)) {
        // Update the password
        if (req.body.setPassword) {
            if (req.body.setPassword == 'true') {
                await db.setPostPreviewPassword(req.post._id, previewPassword);
            }
        }
    } else {
        // Compare the password and authorize
        if (req.post.previewPassword == previewPassword) {
            req.session[`post_${req.post._id}`] = previewPassword;
        } else {
            res.render('previewPassword', {
                wrongPassword: true
            });

            return;
        }
    }

    res.redirect(req.originalUrl);
}

function canViewPost(req) {
    if (z3.isLoggedIn(req)) {
        return true;
    }
    
    if (`post_${req.post._id}` in req.session) {
        return req.session[`post_${req.post._id}`] == req.post.previewPassword;
    }

    return false;
}

router.get('/:postId', async (req, res) => {
    if (canViewPost(req)) {
        await renderDraft(req.currentDraft, req, res, true);
    } else {
        res.render('previewPassword');
    }
});

router.post('/:postId', async (req, res) => {
    await handlePassword(req, res);
    /*// TODO: Avoid copy & paste

    const previewPassword = req.body.previewPassword;

    if (z3.isLoggedIn(req)) {
        // TODO: Check for setPassword == true
        await db.setPostPreviewPassword(req.post._id, previewPassword);
        res.redirect(`/preview/${req.post._id}`);
    } else {
        // TODO: Compare password and render
    }*/
});

router.get('/:postId/:draftId', async (req, res) => {

    if (canViewPost(req)) {
        await renderDraft(req.draft, req, res);
    } else {
        res.render('previewPassword');
    }
});

router.post('/:postId/:draftId', async (req, res) => {
    await handlePassword(req, res);

/*    // TODO: Eliminate copy & paste
    const previewPassword = req.body.previewPassword;

    if (z3.isLoggedIn(req)) {
        await db.setPostPreviewPassword(req.post._id, previewPassword);
        res.redirect(`/preview/${req.post._id}/${req.draft._id}`);
    } else {
        // TODO: Compare password and render
    }*/
});

router.get('/image/:postId/:imageFilename', async (req, res) => {
    if (canViewPost(req)) {
        const imageSize = req.query.size;
        z3.returnImageResult(res, req.imageRecord, imageSize);
    } else {
        throw new createError(401);
    }
});

module.exports = router;

