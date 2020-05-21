const express = require('express');

const db = require('../db');
const z3 = require('../z3');
const SafeRouter = require('../SafeRouter');

const safeRouter = new SafeRouter(express);

async function renderUrl(req, res, next, url) {
	const post = await db.getPostFromUrlOrNull(url);

	// If there is no post at this url, check to see if this is realy an image
	if (post == null) {
		if (url == '') {
			res.render('index', {});
		} else {
			await renderImage(req, res, next, '', url);
		}
	} else {
		if (!(post.publishedAt)) {
			next();
			return;
		}

		const postModel = z3.constructPostModel(post);

		res.render('blog', postModel);
	}
};

async function renderImage(req, res, next, url, imageFilename, imageSize) {
	const post = await db.getPostFromUrl(url);

	if (!(post.publishedImages)) {
		next();
		return;
	}

	for (var publishedImage of post.publishedImages) {
		if (publishedImage.filename == imageFilename) {
			const imageId = publishedImage.imageId;

			const imageRecord = await db.getImage(imageId);
		
			if (imageSize == 'original') {
				res.writeHead(200, {
					'Content-Type': imageRecord.mimetype,
					'Content-Length': imageRecord.imageData.length});
					res.end(imageRecord.imageData);
			} else if (imageSize == 'thumbnail') {
				res.writeHead(200, {
					'Content-Type': 'image/jpeg',
					'Content-Length': imageRecord.thumbnailImageData.length});
					res.end(imageRecord.thumbnailImageData);
			} else {
				res.writeHead(200, {
					'Content-Type': 'image/jpeg',
					'Content-Length': imageRecord.normalSizeImageData.length});
					res.end(imageRecord.normalSizeImageData);
			}

			return;
		}
	}

	next();
}


safeRouter.get('/', async (req, res, next) => {
	await renderUrl(req, res, next, '');
});

safeRouter.get('/:url', async (req, res, next) => {	
	const url = req.params.url;
	const imageSize = req.query.size;

	if (imageSize) {
		const imageFilename = url;
		await renderImage(req, res, next, '', imageFilename, imageSize);
	} else {
		await renderUrl(req, res, next, url);
	}
});

safeRouter.get('/:url/:imageFilename', async (req, res, next) => {
	const url = req.params.url;
	const imageFilename = req.params.imageFilename;
	const imageSize = req.query.size;

	await renderImage(req, res, next, url, imageFilename, imageSize);
});

module.exports = safeRouter.router;
