const router = require('express-promise-router')();

const db = require('../db');
const z3 = require('../z3.js');

router.all('/*', z3.checkIsAuthenticated);

router.get('/:postId', async (req, res, next) => {
    	
	const postId = req.params.postId;

    const postAndDrafts = await db.getPostAndDrafts(postId);

    const post = postAndDrafts.post;
    const drafts = postAndDrafts.drafts;

    const publishedImages = [];
    const unpublishedImages = [];
    const postModel = {
        postId: post._id,
        title: post.title,
        workingTitle: post.workingTitle,
        drafts: [],
        url: post.url,
        publishedImages,
        unpublishedImages
    };

    for (var draftIndex in drafts) {
        const draft = drafts[draftIndex];

        postModel.drafts.push({
            draftId: draft._id,
            title: draft.title,
            content: draft.content,
            updated: draft.updatedAt
        });
    }

    const imageRecords = await db.getImagesForPost(postId);
    for (var imageRecord of imageRecords) {
        if (imageRecord.published) {
            imageRecord.url = `/${post.url}/${imageRecord.filename}?size=original`;
            publishedImages.push(imageRecord);
        } else {
            imageRecord.url = `/edit/image/${post._id}.${imageRecord._id}`;
            unpublishedImages.push(imageRecord);
        }
    }

    res.render('drafts', postModel);
});

router.post('/restore/:draftId', async (req, res) => {
    	
    const draftId = req.params.draftId;

    const draft = await db.restoreDraft(draftId);
    
    res.redirect(`/drafts/${draft.postId}`);
});

router.post('/deleteImage/:imageId', async (req, res) => {
    	
    const imageId = req.params.imageId;

    const imageRecord = await db.getImage(imageId);
    await db.deleteImage(imageId);

    res.redirect(`/drafts/${imageRecord.postId}`);
});


module.exports = router;