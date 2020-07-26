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

        var result = await testSetup.server
            .get(`/preview/${post._id}`)
            .expect(200);

        const postTemplate = JSON.parse(result.text);

        assert.equal(postTemplate.options.postId, post._id, 'Wrong post id');
        assert.equal(postTemplate.options.title, draft.title, 'Wrong title');
        assert.equal(postTemplate.options.content, draft.content, 'Wrong content');
        assert.isUndefined(postTemplate.options.url, 'Wrong url');
        assert.isUndefined(postTemplate.options.summary, 'Wrong summary');
        assert.isTrue(postTemplate.options.isBlogPost, 'Wrong isBlogPost');
        assert.isTrue(postTemplate.options.isPreview, 'Wrong isPreview');
        assert.isUndefined(postTemplate.options.publishedAt, 'Wrong publishedAt');
    });
});