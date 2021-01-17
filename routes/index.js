const router = require('express-promise-router')();

const db = require('../db');
const z3 = require('../z3');

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

	const imageRecord = await db.getImageOrNullByUrlAndFilename(url, imageFilename);

	if (imageRecord == null) {
		next();
		return;
	}

	if (!imageRecord.published) {
		next();
		return;
	}

	z3.returnImageResult(res, imageRecord, imageSize);
}


router.get('/', async (req, res, next) => {
	await renderUrl(req, res, next, '');
});

router.get('/:url', async (req, res, next) => {	
	const url = req.params.url;
	const imageSize = req.query.size;

	if (imageSize) {
		const imageFilename = url;
		await renderImage(req, res, next, '', imageFilename, imageSize);
	} else {
		await renderUrl(req, res, next, url);
	}
});

router.get('/:url/:imageFilename', async (req, res, next) => {
	const url = req.params.url;
	const imageFilename = req.params.imageFilename;
	const imageSize = req.query.size;

	await renderImage(req, res, next, url, imageFilename, imageSize);
});

module.exports = router;
