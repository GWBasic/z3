const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const db = require('../db');

const server = testSetup.server;

describe('Index operations', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('default /', async () => {
        var result = await server
            .get('/')
            .expect(200);

        const postTemplate = JSON.parse(result.text);

        assert.isUndefined(postTemplate.options.postId, 'Result should not be defined');
        assert.isUndefined(postTemplate.options.title, 'Result should not be defined');
        assert.isUndefined(postTemplate.options.content, 'Result should not be defined');

        assert.equal(postTemplate.fileName, 'index.pogon.html', 'Not serving the default index page');
    });

    it('get post', async () => {

        await testSetup.createPostsAndPublishedPosts(1, 2);

        const post = (await db.getPosts())[0];

        var result = await server
            .get(`/${post.url}`)
            .expect(200);

        const postTemplate = JSON.parse(result.text);

        assert.equal(postTemplate.options.postId, post._id, 'Wrong post id');
        assert.equal(postTemplate.options.title, post.title, 'Wrong title');
        assert.equal(postTemplate.options.content, post.content, 'Wrong content');
        assert.equal(postTemplate.options.url, post.url, 'Wrong url');
        assert.equal(postTemplate.options.summary, post.summary, 'Wrong summary');
        assert.isTrue(postTemplate.options.isBlogPost, 'Wrong isBlogPost');
        assert.equal(`"${postTemplate.options.publishedAt}"`, JSON.stringify(post.publishedAt), 'Wrong publishedAt');
    });

    it('post not found', async () => {
        await server
            .get('/doesntexist')
            .expect(404);
    });

    it('Get an image', async () => {
        await testSetup.createPostsAndPublishedPosts(1, 2);

        const post = (await db.getPosts())[0];

        assert.isTrue(post.publishedImages.length > 0, 'No published images');
        const publishedImage = post.publishedImages[0];
        const imageRecord = await db.getImage(publishedImage.imageId);

        var result = await server
            .get(`/${post.url}/${publishedImage.filename}`)
            .expect('Content-Type', publishedImage.mimetype)
            .expect('Content-Length', `${imageRecord.data.length}`)
            .expect(200);

        assert.isTrue(imageRecord.data.equals(result.body), 'Wrong contents sent');

        var result = await server
            .get(`/${post.url}/doesnotexist`)
            .expect(404);
    });

    it('Published /', async () => {
        const postAndDraft = await db.createPost('this is the index');
        const post = postAndDraft.post;
        const draft = postAndDraft.drafts[0];

        const imageRecord = await db.insertImage(post._id, 'hash', 'filename', 'image/jpeg', Buffer.alloc(20));

        const publishedImage = {
            filename: 'filename',
            imageId: imageRecord._id,
            mimetype: 'image/jpeg'
        };

        const publishedImages = [publishedImage];

        await db.publishPost(
            post._id,
            draft._id,
            new Date(),
            null,
            'this is the index',
            'Content',
            '',
            'summary',
            publishedImages);

        const publishedPost = await db.getPostFromUrl('');

        var result = await server
            .get('/')
            .expect(200);

        const postTemplate = JSON.parse(result.text);

        assert.equal(postTemplate.options.postId, publishedPost._id, 'Wrong post id');
        assert.equal(postTemplate.options.title, publishedPost.title, 'Wrong title');
        assert.equal(postTemplate.options.content, publishedPost.content, 'Wrong content');
        assert.equal(postTemplate.options.url, publishedPost.url, 'Wrong url');
        assert.equal(postTemplate.options.summary, publishedPost.summary, 'Wrong summary');
        assert.isFalse(postTemplate.options.isBlogPost, 'Wrong isBlogPost');
        assert.equal(`"${postTemplate.options.publishedAt}"`, JSON.stringify(publishedPost.publishedAt), 'Wrong publishedAt');
    
        var result = await server
            .get(`/${publishedImage.filename}`)
            .expect('Content-Type', publishedImage.mimetype)
            .expect('Content-Length', `${imageRecord.data.length}`)
            .expect(200);

        assert.isTrue(imageRecord.data.equals(result.body), 'Wrong contents sent');
    });
});