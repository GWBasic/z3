const fs = require('fs-extra');

const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const db = require('../db');
const Enumerable = require('linq-es2015');

const server = testSetup.server;

describe('Editor operations', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Verify calls are authenticated', async () => {
        await testSetup.server
            .post('/edit')
            .expect(401);

        var { post, workingTitle, content } = await testSetup.preparePost();

        await testSetup.server
            .get(`/edit/${post._id}`)
            .expect(401);

        await testSetup.server
            .put(`/edit/${post._id}`)
            .expect(401);

        await testSetup.server
            .post(`/edit/image/${post._id}`)
            .expect(401);

        var imageRecord = await db.insertImage(
            post._id,
            'gssaadsfa',
            'egregerafe',
            'greareaa',
            Buffer.alloc(0),
            {width: 50, height: 100},
            Buffer.alloc(20),
            {width: 25, height: 50},
            Buffer.alloc(5),
            {width: 12, height: 25});

        await testSetup.server
            .get(`/edit/${post._id}.${imageRecord._id}`)
            .expect(401);
    });

    it('Verify 404s', async () => {
        await testSetup.login();

        await testSetup.server
            .get('/edit/76543')
            .expect(404);

        var { post, workingTitle, content } = await testSetup.preparePost();

        await testSetup.server
            .get(`/edit/${post._id}/457754`)
            .expect(404);
    });

    it('Verify creating a post', async () => {

        await testSetup.login();

        const title = 'the first title';

        var response = await testSetup.server
            .post('/edit')
            .send(`title=${title}`)
            .expect(302)
            .expect('Location', /\/edit\/*/);

        var postId = response.headers.location.substring(6);

        var post = await db.getPost(postId);

        assert.equal(post.workingTitle, title);
    });

    it('Load a post in the editor', async () => {

        await testSetup.login();
        var { post, workingTitle, content } = await testSetup.preparePost();

        async function verifyEditor(isPublished, draftIsOutdated) {
            var result = await testSetup.server
                .get(`/edit/${post._id}`)
                .expect(200);

            const editor = JSON.parse(result.text);

            assert.equal(editor.options.postId, post._id, 'Wrong post id');
            assert.equal(editor.options.title, workingTitle, 'Wrong title');
            assert.equal(editor.options.content, content, 'Wrong content');
            assert.equal(editor.options.isPublished, isPublished, 'Wrong isPublished');
            assert.equal(editor.options.draftIsOutdated, draftIsOutdated, 'Wrong draftIsOutdated');
        }

        await verifyEditor(false, false);

        const whereParam = encodeURI(JSON.stringify({}));

        await testSetup.server
            .post(`/publish/${post._id}`)
            .send(`where=${whereParam}`)
            .expect(302);

        await verifyEditor(true, false);

        workingTitle = 'A new title';
        content = 'Updated content!!!';
        await db.appendDraft(post._id, workingTitle, content);

        await verifyEditor(true, true);
    });

    it('Put a new version of a post', async () => {

        await testSetup.login();
        var { post, workingTitle, content } = await testSetup.preparePost();

        var draft = null;

        const suggestedLocationQueue = ['index', 'footer'];

        async function verifySendNewEdit(draftIsOutdated) {
            const suggestedLocation = suggestedLocationQueue.pop();

            const result = await testSetup.server
                .put(`/edit/${post._id}`)
                .send({title: workingTitle, content: content, suggestedLocation})
                .expect(201);

            const response = JSON.parse(result.text);
            assert.equal(response.draftIsOutdated, draftIsOutdated, 'Wrong draftIsOutdated');
            assert.equal(response.draft.content, content, 'Wrong content');
            assert.equal(response.draft.title, workingTitle, 'Wrong title');

            const postAndDraft = await db.getPostAndDrafts(post._id);
            post = postAndDraft.post;
            draft = postAndDraft.drafts[0];

            assert.equal(post.workingTitle, workingTitle, 'Post has wrong working title');
            assert.equal(post.suggestedLocation, suggestedLocation, 'Post has wrong suggested location');
            assert.equal(draft.title, workingTitle, 'Draft has wrong title');
            assert.equal(draft.content, content, 'Draft has wrong content');
        }

        await verifySendNewEdit(false);

        content = 'new content';
        await db.publishPost(
            post._id,
            draft._id,
            new Date(),
            null,
            draft.title,
            content,
            'theurl',
            'the summary',
            []);

        await verifySendNewEdit(true);
    });

    it('Upload and retrieve an image', async () => {
        await testSetup.login();
        var { post, workingTitle, content } = await testSetup.preparePost();

        const imageStats = await fs.stat('test/data/img1.jpg');

        var result = await testSetup.server
            .post(`/edit/image/${post._id}`)
            .attach('upload', 'test/data/img1.jpg')
            .expect(200);

        const imageRecords = await db.getImagesForPost(post._id);
        assert.equal(imageRecords.length, 1, "Unexpected number of images");

        const imageRecord = imageRecords[0];
        assert.equal(imageRecord.filename, 'img1.jpg');
        assert.equal(imageRecord.mimetype, 'image/jpeg');
        assert.isNotNull(imageRecord.hash, 'Hash not specified');
        assert.isNotNull(imageRecord.data, 'Data not specified');

        const response = JSON.parse(result.text);
        assert.isTrue(response.uploaded, 'Uploaded not true');
        assert.equal(response.url, `/edit/image/${post._id}/${imageRecord._id}`);

        var result = await testSetup.server
            .get(`/edit/image/${post._id}/${imageRecord._id}`)
            .expect('Content-Type', 'image/jpeg')
            .expect('Content-Length', `${imageStats.size}`)
            .expect(200);

        const expectedBody = await fs.readFile('test/data/img1.jpg');
        assert.isTrue(expectedBody.equals(result.body), 'Wrong contents sent');
    });

    it('Upload and retrieve an image, 401', async () => {
        var { post } = await testSetup.preparePost();

        await testSetup.server
            .post(`/edit/image/${post._id}`)
            .attach('upload', 'test/data/img1.jpg')
            .expect(401);
    });

    it('Upload an image and make sure the filename is unique', async () => {
        var { post } = await testSetup.preparePost();
        await testSetup.login();

        await fs.copyFile('test/data/img1.jpg', 'test/data/img.jpg');
        try {
            const result = await testSetup.server
                .post(`/edit/image/${post._id}`)
                .attach('upload', 'test/data/img.jpg')
                .expect(200);

            const response = JSON.parse(result.text);
            assert.isTrue(response.uploaded, 'Uploaded not true');
        } finally {
            await fs.unlink('test/data/img.jpg');
        }

        await fs.copyFile('test/data/img2.jpg', 'test/data/img.jpg');
        try {
            const result = await testSetup.server
                .post(`/edit/image/${post._id}`)
                .attach('upload', 'test/data/img.jpg')
                .expect(200);

            const response = JSON.parse(result.text);
            assert.isTrue(response.uploaded, 'Uploaded not true');
        } finally {
            await fs.unlink('test/data/img.jpg');
        }

        const images = Enumerable.asEnumerable(await db.getImagesForPost(post._id));
        const image1 = images.First(i => i.originalDimensions.height == 270);
        const image2 = images.First(i => i.originalDimensions.height == 215);

        assert.equal(image1.filename, 'img.jpg');
        assert.equal(image2.filename, '1-img.jpg', 'Duplicate name not adjusted');
    })
});

