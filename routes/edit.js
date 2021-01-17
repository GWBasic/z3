const createError = require('http-errors');
const hasha = require('hasha');
const imageSize = require('image-size');
const isAnimated = require('is-animated')
const multer  = require('multer')
const router = require('express-promise-router')();
const sharp = require('sharp');

const db = require('../db');
const z3 = require('../z3.js');

const storage = multer.memoryStorage()
const upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 20, // Max file size is 20MB, TODO: Make this configurable
        files: 10
    }});

// All calls on the edit route must be authenticated
router.all('/*', z3.checkIsAuthenticated);

router.post('/', async (req, res) => {
    const title = req.body.title;
    const suggestedLocation = req.body.suggestedLocation;

    const postAndDrafts = await db.createPost(title, suggestedLocation);
    res.redirect(`/edit/${postAndDrafts.post._id}`);
});

router.param('postId', async (req, res, next, postId) => {

    const draft = await db.getNewestDraft(postId);
    req.draft = draft;

    const post = await db.getPost(postId);
    req.post = post;

    next();
});

router.param('imageId', async (req, res, next, imageId) => {
    const imageRecord = await db.getImage(imageId);

    if (imageRecord.postId != req.post._id) {
        throw createError(404);
    }

    req.imageRecord = imageRecord;

    next();
});

router.get('/:postId', async (req, res) => {
	
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

router.put('/:postId', async (req, res) => {
	
    const draft = req.draft;
    const post = req.post;
	const postId = req.params.postId;

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

router.get('/image/:postId/:imageId', async (req, res) => {
    const imageRecord = req.imageRecord;

    res.writeHead(200, {
        'Content-Type': imageRecord.mimetype,
        'Content-Length': imageRecord.normalSizeImageData.length
      });
      res.end(imageRecord.normalSizeImageData);
});

router.post('/image/:postId', upload.array('image'), async (req, res) => {
    // See 
    // - https://www.npmjs.com/package/multer
    // - https://stackoverflow.com/questions/49385792/how-to-do-ckeditor-5-image-uploading/49833278#49833278
    // for instructions on how to handle an upload
    const post = req.post;

    const urls = [];

    for (const uploadedImage of req.files) {
        const hash = await hasha.async(uploadedImage.buffer, {
            encoding: 'base64',
            algorithm: 'sha256'
        });

        const originalDimensions = imageSize(uploadedImage.buffer);

        var normalSizeBuffer = uploadedImage.buffer;
        if (!isAnimated(uploadedImage.buffer)) {
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

        urls.push(`/edit/image/${post._id}/${imageRecord._id}`);
    }

    res.status(200);
    res.json({
        msg: 'Upload successful',
        uploaded: true,
        urls
    });
});

module.exports = router;

