const createError = require('http-errors');
const express = require('express');

const db = require('../db');
const SafeRouter = require('../SafeRouter');
const z3 = require('../z3.js');

const safeRouter = new SafeRouter(express);

// All calls on the publish route must be authenticated
safeRouter.router.all('/*', z3.checkIsAuthenticated);

safeRouter.param('postId', async (req, res, next, postId) => {

    const draft = await db.getNewestDraft(postId);
    req.draft = draft;

    const post = await db.getPost(postId);
    req.post = post;
});

safeRouter.get('/:postId', async (req, res) => {
	
    const draft = req.draft;
    const post = req.post;

    const staticPages = await db.getAllStaticPages();

    const staticPagesModel = [];
    for (const staticGroup in staticPages) {
        const pages = staticPages[staticGroup];

        const pagesModel = {
            staticGroup: staticGroup,
            toBlogValue: encodeURI(JSON.stringify({n: staticGroup})),
            pages,
        };

        for (const page of pages) {
            page.toBlogValue = encodeURI(JSON.stringify({n: staticGroup, a: page._id}));
            page.checked = post._id == page._id;
        }

        if (!post.publishedAt) {
            if (post.suggestedLocation == staticGroup) {
                if (pages.length > 0) {
                    pages[pages.length - 1].checked = true;
                } else {
                    pagesModel.checked = true;
                }
            }
        }

        staticPagesModel.push(pagesModel);
    }

    var isBlog;
    if (post.publishedAt) {
        isBlog = post.staticGroup ? false : true;
    } else {
        isBlog = post.suggestedLocation == 'blog';
    }

    var isIndex;
    if (post.publishedAt) {
        isIndex = post.url == '';
    } else {
        isIndex = post.suggestedLocation == 'index';
    }

    var willOverwriteIndex = false;
    const currentIndexPage = await db.getPostFromUrlOrNull('');
    if (currentIndexPage) {
        if (currentIndexPage._id != post._id) {
            willOverwriteIndex = true;
        }
    }

    res.render('publish', {
        postId: draft.postId,
        title: draft.title,
        content: draft.content,
        isPublished: (post.url ? true : false),
        publishedAt: post.publishedAt || null,
        republishedAt: post.republishedAt || null,
        url: post.url,
        toBlogValue: encodeURI(JSON.stringify({})),
        toIndexValue: encodeURI(JSON.stringify({i:true})),
        staticPages: staticPagesModel,
        isBlog,
        isIndex,
        willOverwriteIndex});
});

safeRouter.post('/:postId', async (req, res) => {
	
    const draft = req.draft;
    const whereJSON = decodeURI(req.body.where);
    const where = JSON.parse(whereJSON);

    var staticGroup = null;
    var afterPageId = null;

    var isIndex = false;
    if (where.n) {
        staticGroup = where.n;

        if (where.a) {
            afterPageId = where.a;
        }
    } else if (where.i) {
        isIndex = true;
    }

    var publishedAt = new Date(req.body.publishedAt);
    if (isNaN(publishedAt)) {
        // TODO: Log invalid date
        publishedAt = new Date();
    }

    var republishedAt = new Date(req.body.republishedAt);
    if (isNaN(republishedAt)) {
        // TODO: Log invalid date

        if (req.post.url) {
            republishedAt = new Date();
        } else {
            republishedAt = null;
        }
    }

    const { url, summary } = await z3.constructUrlAndSummary(draft, isIndex);
    const { publishedImages, content } = await z3.extractImages(draft.content, url, draft.postId);

    await db.publishPost(
        draft.postId,
        draft._id,
        publishedAt,
        republishedAt,
        draft.title,
        content,
        url,
        summary,
        publishedImages,
        staticGroup,
        afterPageId);

    res.redirect(`/publish/${draft.postId}`);
});

safeRouter.post('/unPublish/:postId', async (req, res) => {
	
    const post = req.post;

    await db.unPublishPost(post._id);
    res.redirect(`/publish/${post._id}`);
});

safeRouter.post('/delete/:postId', async (req, res) => {
	
    const post = req.post;

    await db.deletePost(post._id);
    res.redirect(`/dashboard`);
});


module.exports = safeRouter.router;
