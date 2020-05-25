const createError = require('http-errors');
const express = require('express');
const hasha = require('hasha');
const imageSize = require('image-size');;
const multer  = require('multer')
const sharp = require('sharp');

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

// All calls on the edit route must be authenticated
safeRouter.router.all('/*', z3.checkIsAuthenticated);

safeRouter.post('/', async (req, res) => {
    const title = req.body.title;
    const suggestedLocation = req.body.suggestedLocation;

    const postAndDrafts = await db.createPost(title, suggestedLocation);
    res.redirect(`/edit/${postAndDrafts.post._id}`);
});

safeRouter.param('postId', async (req, res, next, postId) => {

    const draft = await db.getNewestDraft(postId);
    req.draft = draft;

    const post = await db.getPost(postId);
    req.post = post;
});

safeRouter.param('imageId', async (req, res, next, imageId) => {
    const imageRecord = await db.getImage(imageId);

    if (imageRecord.postId != req.post._id) {
        throw createError(404);
    }

    req.imageRecord = imageRecord;
});

safeRouter.get('/:postId', async (req, res) => {
	
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
});

safeRouter.put('/:postId', async (req, res) => {
	
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
});

safeRouter.get('/image/:postId.:imageId', async (req, res) => {
    const imageRecord = req.imageRecord;

    res.writeHead(200, {
        'Content-Type': imageRecord.mimetype,
        'Content-Length': imageRecord.imageData.length
      });
      res.end(imageRecord.imageData); 
});

safeRouter.post('/image/:postId', upload.single('upload'), async (req, res) => {
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

    const originalDimensions = imageSize(uploadedImage.buffer);

    var normalSizeBuffer = uploadedImage.buffer;
    if (originalDimensions.width > z3.MAX_IMAGE_WIDTH_HD) {
        normalSizeBuffer = await sharp(uploadedImage.buffer)
            .resize(z3.MAX_IMAGE_WIDTH_HD)
            .jpeg()
            .toBuffer();
    } else if (uploadedImage.mimetype != 'image/jpeg') {
        normalSizeBuffer = await sharp(uploadedImage.buffer)
            .jpeg()
            .toBuffer();
    }

    const normalDimensions = imageSize(normalSizeBuffer);

    var thumbnailBuffer = uploadedImage.buffer;
    if (originalDimensions.height > z3.MAX_THUMBNAIL_HEIGHT_HD) {
        thumbnailBuffer = await sharp(uploadedImage.buffer)
            .resize(null, z3.MAX_THUMBNAIL_HEIGHT_HD)
            .jpeg()
            .toBuffer();
    } else if (uploadedImage.mimetype != 'image/jpeg') {
        thumbnailBuffer = await sharp(uploadedImage.buffer)
            .jpeg()
            .toBuffer();
    }
    
    const thumbnailDimensions = imageSize(thumbnailBuffer);

    const imageRecord = await db.insertImage(
        post._id,
        hash,
        uploadedImage.originalname,
        uploadedImage.mimetype,
        uploadedImage.buffer,
        originalDimensions,
        normalSizeBuffer,
        normalDimensions,
        thumbnailBuffer,
        thumbnailDimensions);

    res.status(200);
    res.json({
        uploaded: true,
        url: `/edit/image/${post._id}.${imageRecord._id}`
    });
});

module.exports = safeRouter.router;

