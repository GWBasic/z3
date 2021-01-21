const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const db = require('../db');
const z3 = require('../z3');

const server = testSetup.server;

describe('Preview post', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Permissions', async() => {
        await testSetup.createPostsAndPublishedPosts(1, 2);

        const post = (await db.getPosts())[0];

        await testSetup.server
            .get(`/preview/${post._id}`)
            .expect(404);
    });

    async function testLoginViaPassword(url, password) {
        const result = await testSetup.server
            .post(url)
            .send(`previewPassword=${password}`)
            .expect(302)
            .expect('Location', url);

        assert.isNotNull(result.text);
    }

    async function testPreviewPost(login) {
        const extractImages = z3.extractImages;

        try {
            await testSetup.createPostsAndPublishedPosts(1, 2);

            const post = (await db.getPosts())[0];
            const draft = await db.getNewestDraft(post._id);

            await login(post);

            var extractImagesCalled = false;

            z3.extractImages = (originalContent, url, postId) => {
                assert.equal(post._id, postId, 'Wront post ID', 'Wrong postId');
                assert.equal(`preview/image/${post._id}`, url, 'Wrong url');
                
                extractImagesCalled = true;

                return {
                    imageIdsToPublish: [],
                    content: originalContent
                };
            };
    
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

            assert.isTrue(extractImagesCalled, 'z3.extractImages not called');
        } finally {
            z3.extractImages = extractImages;
        }
    }

    it('Preview post', async () => {
        await testPreviewPost(async _ => await testSetup.login());
    });

    it ('Preview post via password', async () => {
        await testPreviewPost(async post => {
            await db.setPostPreviewPassword(post._id, 'thepassword');

            await testLoginViaPassword(`/preview/${post._id}`, 'thepassword');
        });
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

    async function testPreviewOldDraft(login) {
        await testSetup.createPostsAndPublishedPosts(1, 2);

        const post = (await db.getPosts())[0];

        await db.appendDraft(post._id, 'New draft', 'New content');

        const postAndDrafts = await db.getPostAndDrafts(post._id);

        const drafts = postAndDrafts.drafts;
        const draft = drafts[1];

        await login(post, draft);

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
    }

    it ('Preview old draft', async () => {
        await testPreviewOldDraft(async (_, __) => await testSetup.login());
    });

    it ('Preview draft via password', async () => {
        await testPreviewOldDraft(async (post, draft) => {
            await db.setPostPreviewPassword(post._id, 'thepasswordYYY');

            await testLoginViaPassword(`/preview/${post._id}/${draft._id}`, 'thepasswordYYY');
        });
    });

    async function testWrongPassword(generateUrl) {
        await testSetup.createPostsAndPublishedPosts(1, 2);

        const post = (await db.getPosts())[0];

        await db.appendDraft(post._id, 'New draft', 'New content');

        const postAndDrafts = await db.getPostAndDrafts(post._id);

        const drafts = postAndDrafts.drafts;
        const draft = drafts[1];

        await db.setPostPreviewPassword(post._id, 'thepassword');

        const url = generateUrl(post, draft);

        const result = await testSetup.server
            .post(url)
            .send(`previewPassword=bad`)
            .expect(401);

        assert.isNotNull(result.text);

        let contents = JSON.parse(result.text);
        assert.isTrue(contents.options.wrongPassword, "WrongPassword not set");

    }

    it ('Preview post wrong password', async () => {
        testWrongPassword((post, _) => `/preview/${post._id}`);
    });

    it ('Preview draft wrong password', async () => {
        testWrongPassword((post, draft) => `/preview/${post._id}/${draft._id}`);
    });

    it ('Redirected to enter password', async () => {
        assert.fail('incomplete');
    });

    it ('Redirected to enter password for draft', async () => {
        assert.fail('incomplete');
    });

    it ('Set password via preview', async () => {
        assert.fail('incomplete');
    });

    it ('Set password via draft', async () => {
        assert.fail('incomplete');
    });
});