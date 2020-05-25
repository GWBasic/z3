const createError = require('http-errors');
const express = require('express');

const db = require('../db');
const SafeRouter = require('../SafeRouter');
const z3 = require('../z3.js');

const safeRouter = new SafeRouter(express);

safeRouter.get('/:postId', z3.checkIsAuthenticated, async (req, res, next) => {
    	
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

    const publishedImageIds = {};
    if (post.publishedImages) {
        for (var publishedImage of post.publishedImages) {
            publishedImageIds[publishedImage.imageId] = `/${post.url}/${publishedImage.filename}`;
        }
    }

    const imageRecords = await db.getImagesForPost(postId);
    for (var imageRecord of imageRecords) {
        if (publishedImageIds[imageRecord._id]) {
            imageRecord.url = publishedImageIds[imageRecord._id];
            publishedImages.push(imageRecord);
        } else {
            imageRecord.url = `/edit/image/${post._id}.${imageRecord._id}`;
            unpublishedImages.push(imageRecord);
        }
    }

    res.render('drafts', postModel);
});

safeRouter.post('/restore/:draftId', z3.checkIsAuthenticated, async (req, res) => {
    	
    const draftId = req.params.draftId;

    const draft = await db.restoreDraft(draftId);
    
    res.redirect(`/drafts/${draft.postId}`);
});

safeRouter.post('/deleteImage/:imageId', z3.checkIsAuthenticated, async (req, res) => {
    	
    const imageId = req.params.imageId;

    const imageRecord = await db.getImage(imageId);
    await db.deleteImage(imageId);

    res.redirect(`/drafts/${imageRecord.postId}`);
});


module.exports = safeRouter.router;