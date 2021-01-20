const cheerio = require('cheerio');
const createError = require('http-errors');
const fsSync = require('fs');
const fs = require('fs').promises;
const fsConstants = require('fs').constants;
const he = require('he');
const passwordHashAndSalt = require('password-hash-and-salt');
const promisify = require('util').promisify;
const striptags = require('striptags');

const db = require('./db');
const cachedConfigurationValues = require('./cachedConfigurationValues');
const { imageSize } = require('image-size');

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 25;

const MAX_SUMMARY_LENGTH = 200;

const MAX_IMAGE_WIDTH = 725;
const MAX_IMAGE_WIDTH_HD = MAX_IMAGE_WIDTH * 2;

const MAX_THUMBNAIL_HEIGHT = 150;
const MAX_THUMBNAIL_HEIGHT_HD = MAX_THUMBNAIL_HEIGHT * 2;

exports.MAX_IMAGE_WIDTH = MAX_IMAGE_WIDTH;
exports.MAX_IMAGE_WIDTH_HD = MAX_IMAGE_WIDTH_HD;

exports.MAX_THUMBNAIL_HEIGHT = MAX_THUMBNAIL_HEIGHT;
exports.MAX_THUMBNAIL_HEIGHT_HD = MAX_THUMBNAIL_HEIGHT_HD;

const DEFAULT_SEARCH_URL = 'https://www.startpage.com/do/search?q=%query%+site%3A%host%';
exports.DEFAULT_SEARCH_URL = DEFAULT_SEARCH_URL;

exports.checkPassword = async password => {

    const passwordRecord = await cachedConfigurationValues.getPassword();

    if (passwordRecord != null) {
        if (passwordRecord.hashAndSalt) {
            const hashAndSalt = passwordRecord.hashAndSalt;
            const verified = await promisify(callback => passwordHashAndSalt(password).verifyAgainst(hashAndSalt, callback))();
            return verified;
        }
    }

    return false;
};

exports.changePassword = async newPassword => {
    const hashAndSalt = await promisify(callback => passwordHashAndSalt(newPassword).hash(callback))();

    await cachedConfigurationValues.setPassword({ hashAndSalt });
};

exports.checkIsAuthenticated = (req, res, next) => {
    if (req.session) {
        if (req.session.isLoggedIn) {
            next();
            return;
        }
    }

    next(createError(401));
};

exports.isLoggedIn = req => {
    if (req.session) {
        if (req.session.isLoggedIn) {
            return true;
        }
    }

    return false;
}

exports.calculateSkipLimit = req => {
    const skip = (('start' in req.query) ? Math.max(0, Number(req.query.start) - 1) : 0) || 0;
    const limit = (('limit' in req.query) ? Math.max(1, Math.min(MAX_LIMIT, Number(req.query.limit))) : DEFAULT_LIMIT) || DEFAULT_LIMIT;
    
    return { skip, limit };
};

exports.calculateNextSkipLimits = (skip, posts, numPosts, limit) => {

    const highestIndex = skip + posts.length;
    
    var nextStart = null;
    var nextStartMax = null;

    if (highestIndex < numPosts) {
        nextStart = highestIndex + 1;
        nextStartMax = Math.min(numPosts, nextStart + limit - 1);
    }

    var previousStart = null;
    var previousStartMax = null;

    if (skip > 0) {
        previousStart = Math.max(1, skip - limit);
        previousStartMax = Math.min(numPosts, previousStart + limit - 1);
    }

    return { nextStart, nextStartMax, previousStart, previousStartMax };
}


exports.constructPostModels = posts => {
	const postsModel = [];
	for (const post of posts) {
		postsModel.push(exports.constructPostModel(post));
	}
}

exports.constructPostModel = post => {

    var isBlogPost;
    if (post.staticGroup) {
        isBlogPost = false;
    } else {
        isBlogPost = post.url != '';
    }

	return {
		postId: post._id,
		url: post.url,
		title: post.title,
		content: post.content,
		summary: post.summary,
        publishedAt: post.publishedAt,
        republishedAt: post.republishedAt,
        staticGroup: post.staticGroup,
        previewPassword: post.previewPassword,
        isBlogPost
    };
}

exports.constructUrlAndSummary = async (draft, isIndex) => {
    const postId = draft.postId;

    var url;

    if (isIndex) {
        url = '';
        var conflictingPost = await db.getPostFromUrlOrNull(url);

        if (conflictingPost) {
            await db.unPublishPost(conflictingPost._id);
        }

    } else {
        var initialUrlSuggestion = draft.title
            .normalize()
            .trim()
            .toLowerCase()
            .replace(/\s/g, '_')
            .replace(/\W/g, '');

        if (initialUrlSuggestion.length == 0) {
            initialUrlSuggestion = '_';
        }

        url = initialUrlSuggestion;

        var conflictingPost = await db.getPostFromUrlOrNull(url);

        if (conflictingPost != null) {
            if (conflictingPost._id == postId) {
                conflictingPost = null;
            }
        }

        var tries = 1;
        while (conflictingPost != null) {
            url = `${initialUrlSuggestion}_${tries}`;
            conflictingPost = await db.getPostFromUrlOrNull(url);

            if (conflictingPost != null) {
                if (conflictingPost._id == postId) {
                    conflictingPost = null;
                }
            }

            tries++;
        }
    }

    var summary = striptags(draft.content);
    summary = he.decode(summary);
    
    summary = summary.replace(/\s/g, ' ');
    while (summary.includes('  ')) {
        summary = summary.replace(/\s\s/g, ' ');
    }

    if (summary.length > MAX_SUMMARY_LENGTH) {
        summary = summary.substring(0, MAX_SUMMARY_LENGTH);
    }
    
    return { url, summary };
};

exports.staticLocations = ['header', 'footer'];

exports.extractImages = async (content, url, postId) => {
    const $ = cheerio.load(content);
    const imageElements = $('img');

    const imageIdsToPublish = [];

    const filterPrefix = `/edit/image/${postId}/`;

    for (var imageElementCtr = 0; imageElementCtr < imageElements.length; imageElementCtr++) {
        const imageElement = imageElements[imageElementCtr];
        const originalSrc = imageElement.attribs.src;

        if (originalSrc.startsWith(filterPrefix)) {
            const imageId = parseInt(originalSrc.substring(filterPrefix.length));

            if (!isNaN(imageId)) {
                const imageRecord = await db.getImageOrNull(imageId);

                if (imageRecord) {
                    const filename = imageRecord.filename;

                    if (!imageIdsToPublish.includes(imageRecord._id)) {
                        imageIdsToPublish.push(imageRecord._id);
                    }

                    if (url.length > 0) {
                        imageElement.attribs.src = `/${url}/${filename}`;
                    } else {
                        imageElement.attribs.src = `/${filename}`;
                    }

                    if (imageRecord.normalDimensions.width <= MAX_IMAGE_WIDTH) {
                        imageElement.attribs.width = `${imageRecord.normalDimensions.width}px`;
                        imageElement.attribs.height = `${imageRecord.normalDimensions.height}px`;
                    } else {
                        const ratio = imageRecord.normalDimensions.width / imageRecord.normalDimensions.height;
                        imageElement.attribs.width = `${MAX_IMAGE_WIDTH}px`;
                        const height = Math.round(MAX_IMAGE_WIDTH / ratio);
                        imageElement.attribs.height = `${height}px`;
                    }

                    const imageElement$ = $(imageElement);
                    imageElement$.wrap(`<a href="${imageElement.attribs.src}?size=original" target="_blank"></a>`);
                }
            }
        }
    };

    const bodyText = $.html();

    return {
        imageIdsToPublish,
        content: bodyText
    };
};

exports.constructDefaultConfig = () => {
    return {
        title: '',
        author: '',
        private: true,
        z3_cr_in_footer: true,
        template: null,
        overrideTemplate: null,
        headHtml: '',
        footerHtml: '',
        searchUrl: '',
        forceDomain: '',
        forceHttps: false,
        redirects: {}
    };
};

exports.returnImageResult = (res, imageRecord, imageSize) => {
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
};