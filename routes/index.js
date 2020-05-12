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

async function renderImage(req, res, next, url, imageFilename) {
	const post = await db.getPostFromUrl(url);

	if (!(post.publishedImages)) {
		next();
		return;
	}

	for (var publishedImage of post.publishedImages) {
		if (publishedImage.filename == imageFilename) {
			const imageId = publishedImage.imageId;

			const imageRecord = await db.getImage(imageId);
		
			res.writeHead(200, {
				'Content-Type': imageRecord.mimetype,
				'Content-Length': imageRecord.data.length});
				res.end(imageRecord.data); 		
			
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
	await renderUrl(req, res, next, url);
});

safeRouter.get('/:url/:imageFilename', async (req, res, next) => {
	
	const url = req.params.url;
	const imageFilename = req.params.imageFilename;

	await renderImage(req, res, next, url, imageFilename);
});

module.exports = safeRouter.router;
