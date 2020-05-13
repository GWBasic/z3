const cheerio = require('cheerio');
const createError = require('http-errors');
const fsSync = require('fs');
const fs = require('fs').promises;
const he = require('he');
const striptags = require('striptags');

const db = require('./db');
const runtimeOptions = require('./runtimeOptions');

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 25;

const MAX_SUMMARY_LENGTH = 200;

exports.checkIsAuthenticated = serviceCall => {
    return async (req, res, next, ...args) => {
        if (req.session) {
            if (req.session.isLoggedIn) {
                if (serviceCall) {
                    await serviceCall(req, res, next, ...args);
                } else {
                    next();
                }

                return;
            }
        }

        res.status(401);
		res.render('401', {});
    };
};

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

    const publishedImageNames = {};
    const imageNamesForId = {};
    const publishedImages = [];

    const filterPrefix = `/edit/image/${postId}.`;

    for (var imageElementCtr = 0; imageElementCtr < imageElements.length; imageElementCtr++) {
        const imageElement = imageElements[imageElementCtr];
        const originalSrc = imageElement.attribs.src;

        if (originalSrc.startsWith(filterPrefix)) {
            const imageId = originalSrc.substring(filterPrefix.length);

            const imageRecord = await db.getImageOrNull(imageId);

            if (imageRecord) {
                var filename;
                if (imageNamesForId[imageId]) {
                    filename = imageNamesForId[imageId];
                } else {
                    var filename = imageRecord.filename;

                    var duplicateCtr = 1;
                    while (publishedImageNames[filename]) {
                        filename = `${duplicateCtr}_${imageRecord.filename}`;
                        duplicateCtr++;
                    }
    
                    publishedImageNames[filename] = true;
                    imageNamesForId[imageId] = filename;
    
                    publishedImages.push({
                        filename,
                        imageId,
                        mimetype: imageRecord.mimetype
                    });
                }

                if (url.length > 0) {
                    imageElement.attribs.src = `/${url}/${filename}`;
                } else {
                    imageElement.attribs.src = `/${filename}`;
                }
            }
        }
    };

    const bodyText = $('body').html();

    return {
        publishedImages,
        content: bodyText
    };
};

function loadConfig() {
    try {
        const configBuffer = fsSync.readFileSync(runtimeOptions.configFile);
        module.exports.config = JSON.parse(configBuffer);
    } catch (err) {
        console.log(`Error loading config: ${err}`);
        module.exports.config = {
            title: '',
            author: '',
            private: true,
            z3_cr_in_footer: true,
        };
    }
}

loadConfig();

module.exports.loadConfig_BLOCKING_CALL_FOR_TESTS = loadConfig;

module.exports.saveConfig = async () => {
    const configJSON = JSON.stringify(module.exports.config);
    await fs.writeFile(runtimeOptions.configFile, configJSON);
}

