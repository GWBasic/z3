const createError = require('http-errors');
const express = require('express');
const hasha = require('hasha');
const multer  = require('multer')

const db = require('../db');
const SafeRouter = require('../SafeRouter');
const z3 = require('../z3.js');

const storage = multer.memoryStorage()
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 20, // Max file size is 20MB, TODO: Make this configurable
        files: 1
    }});

const safeRouter = new SafeRouter(express);

safeRouter.post('/', z3.checkIsAuthenticated(async (req, res) => {
    const title = req.body.title;
    const suggestedLocation = req.body.suggestedLocation;

    const postAndDrafts = await db.createPost(title, suggestedLocation);
    res.redirect(`/edit/${postAndDrafts.post._id}`);
}));

safeRouter.param('postId', z3.checkIsAuthenticated(async (req, res, next, postId) => {

    const draft = await db.getNewestDraft(postId);
    req.draft = draft;

    const post = await db.getPost(postId);
    req.post = post;
}))

safeRouter.param('imageId', z3.checkIsAuthenticated(async (req, res, next, imageId) => {
    const imageRecord = await db.getImage(imageId);

    if (imageRecord.postId != req.post._id) {
        throw createError(404);
    }

    req.imageRecord = imageRecord;
}));

safeRouter.get('/:postId', z3.checkIsAuthenticated(async (req, res) => {
	
    const draft = req.draft;
    const post = req.post;

    const isPublished = (post.url ? true : false);
    const draftIsOutdated = isPublished && (post.draftId != draft._id);

    const staticPages = Object.keys(await db.getAllStaticPages());

    res.render('edit', {
        staticPages,
        suggestedLocation: post.suggestedLocation,
        postId: draft.postId,
        title: draft.title,
        content: draft.content,
        isPublished,
        draftIsOutdated,
        url: post.url});
}));

safeRouter.put('/:postId', z3.checkIsAuthenticated(async (req, res) => {
	
    const draft = req.draft;
    const post = req.post;
	const postId = draft.postId;

    const newDraft = await db.appendDraft(postId, req.body.title, req.body.content, req.body.suggestedLocation);

    const isPublished = (post.url ? true : false);
    const draftIsOutdated = isPublished && (post.draftId != newDraft._id);

    const response = {
        draft: newDraft,
        draftIsOutdated
    };

    res.status(201);
    res.json(response);
}));

safeRouter.get('/image/:postId.:imageId', z3.checkIsAuthenticated(async (req, res) => {
    const imageRecord = req.imageRecord;

    res.writeHead(200, {
        'Content-Type': imageRecord.mimetype,
        'Content-Length': imageRecord.data.length
      });
      res.end(imageRecord.data); 
}));

safeRouter.post('/image/:postId', upload.single('upload'), z3.checkIsAuthenticated(async (req, res) => {
    // See 
    // - https://www.npmjs.com/package/multer
    // - https://stackoverflow.com/questions/49385792/how-to-do-ckeditor-5-image-uploading/49833278#49833278
    // for instructions on how to handle an upload
    const post = req.post;

    const uploadedImage = req.file;

    const hash = await hasha.async(uploadedImage.buffer, {
        encoding: 'base64',
        algorithm: 'sha256'
    });

    const imageRecord = await db.insertImage(post._id, hash, uploadedImage.originalname, uploadedImage.mimetype, uploadedImage.buffer);

    res.status(200);
    res.json({
        uploaded: true,
        url: `/edit/image/${post._id}.${imageRecord._id}`
    });
}));

module.exports = safeRouter.router;

