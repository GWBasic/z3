const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const db = require('../db');

const server = testSetup.server;

describe('Preview post', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Permissions', async() => {
        await testSetup.createPostsAndPublishedPosts(1, 2);

        const post = (await db.getPosts())[0];

        var result = await testSetup.server
            .get(`/preview/${post._id}`)
            .expect(401);
    });

    it('Preview post', async () => {
        await testSetup.createPostsAndPublishedPosts(1, 2);
        await testSetup.login();

        const post = (await db.getPosts())[0];
        const draft = await db.getNewestDraft(post._id);

        function checkPost(postTemplate) {
            assert.equal(postTemplate.options.postId, post._id, 'Wrong post id');
            assert.equal(postTemplate.options.title, draft.title, 'Wrong title');
            assert.equal(postTemplate.options.content, draft.content, 'Wrong content');
            assert.isUndefined(postTemplate.options.url, 'Wrong url');
            assert.isUndefined(postTemplate.options.summary, 'Wrong summary');
            assert.isTrue(postTemplate.options.isBlogPost, 'Wrong isBlogPost');
            assert.isTrue(postTemplate.options.isPreview, 'Wrong isPreview');
            assert.isTrue(postTemplate.options.isCurrent, 'Wrong isCurrent');
            assert.isUndefined(postTemplate.options.publishedAt, 'Wrong publishedAt');
            assert.equal(`"${postTemplate.options.updated}"`, JSON.stringify(draft.updatedAt), 'Wrong updated');
        }

        var result = await testSetup.server
            .get(`/preview/${post._id}`)
            .expect(200);

        var postTemplate = JSON.parse(result.text);
        checkPost(postTemplate);

        result = await testSetup.server
            .get(`/preview/${post._id}/${draft._id}`)
            .expect(200);

        postTemplate = JSON.parse(result.text);
        checkPost(postTemplate);
    });

    it ('DraftId is not part of post', async () => {
        await testSetup.createPostsAndPublishedPosts(2, 2);
        await testSetup.login();

        const posts = await db.getPosts();
        const post1 = posts[0];
        const post2 = posts[1];

        const post1AndDrafts = await db.getPostAndDrafts(post1._id);

        const drafts = post1AndDrafts.drafts;
        const draft = drafts[0];

        await testSetup.server
            .get(`/preview/${post2._id}/${draft._id}`)
            .expect(400);
    });

    it ('Preview old draft', async () => {
        await testSetup.createPostsAndPublishedPosts(1, 2);
        await testSetup.login();

        const post = (await db.getPosts())[0];

        await db.appendDraft(post._id, 'New draft', 'New content');

        const postAndDrafts = await db.getPostAndDrafts(post._id);

        const drafts = postAndDrafts.drafts;
        const draft = drafts[1];

        var result = await testSetup.server
            .get(`/preview/${post._id}/${draft._id}`)
            .expect(200);

        var postTemplate = JSON.parse(result.text);

        assert.equal(postTemplate.options.postId, post._id, 'Wrong post id');
        assert.equal(postTemplate.options.title, draft.title, 'Wrong title');
        assert.equal(postTemplate.options.content, draft.content, 'Wrong content');
        assert.isUndefined(postTemplate.options.url, 'Wrong url');
        assert.isUndefined(postTemplate.options.summary, 'Wrong summary');
        assert.isTrue(postTemplate.options.isBlogPost, 'Wrong isBlogPost');
        assert.isTrue(postTemplate.options.isPreview, 'Wrong isPreview');
        assert.isFalse(postTemplate.options.isCurrent, 'Wrong isCurrent');
        assert.isUndefined(postTemplate.options.publishedAt, 'Wrong publishedAt');
        assert.equal(`"${postTemplate.options.updated}"`, JSON.stringify(draft.updatedAt), 'Wrong updated');
});
});