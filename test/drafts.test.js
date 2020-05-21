const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const fs  = require('fs').promises;

const db = require('../db');

const server = testSetup.server;

describe('Drafts operations', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Not authenticated', async() => {
        await testSetup.logout();

        await server
            .get('/drafts/g53etg5w')
            .expect(401);

        await server
            .post('/drafts/restore/g53etg5w')
            .expect(401);

        await server
            .post('/drafts/deleteImage/g53etg5w')
            .expect(401);
    });

    it('View all drafts', async() => {
        await testSetup.login();
        var { post, drafts } = await createPostAndDrafts();

        const img1Data = await fs.readFile('test/data/img1.jpg');

        const imageRecord = await db.insertImage(
            post._id,
            'hteshtehes',
            'img1.jpg',
            'image/jpeg',
            img1Data,
            {},
            Buffer.alloc(0),
            {},
            Buffer.alloc(20),
            {},
            Buffer.alloc(5),
            {});
        
        const imageRecordDuplicateName = await db.insertImage(
            post._id,
            'h4eh65h',
            'img1.jpg',
            'image/jpeg',
            img1Data,
            {},
            Buffer.alloc(0),
            {},
            Buffer.alloc(20),
            {},
            Buffer.alloc(5),
            {});

        async function verifyDrafts(isPublished) {
            const response = await server
                .get(`/drafts/${post._id}`)
                .expect(200);

            const result = JSON.parse(response.text);
            const draftsModel = result.options;

            assert.equal(draftsModel.postId, post._id, 'Wrong postId');
            assert.equal(draftsModel.workingTitle, 'title 4', 'Wrong workingTitle');

            for (var draftItr = 0; draftItr < 5; draftItr++) {
                const draft = drafts[draftItr];
                const returnedDraft = draftsModel.drafts[4 - draftItr];

                assert.equal(returnedDraft.draftId, draft._id, 'Wrong ID');
                assert.equal(returnedDraft.title, draft.title, 'Wrong ID');
                assert.equal(returnedDraft.content, draft.content, 'Wrong ID');
            }

            assert.equal(draftsModel.publishedImages.length, isPublished ? 1 : 0, 'There should be no published images');
            assert.equal(draftsModel.unpublishedImages.length, isPublished ? 1 : 2, 'There should be 2 unpublished images');

            const images = {};
            for (var image of draftsModel.publishedImages) {
                images[image._id] = image;
            }
            for (var image of draftsModel.unpublishedImages) {
                images[image._id] = image;
            }

            assert.isDefined(images[imageRecord._id]);
            assert.equal(images[imageRecord._id].filename, 'img1.jpg');
            assert.isDefined(images[imageRecordDuplicateName._id]);
            assert.equal(images[imageRecordDuplicateName._id].filename, 'img1.jpg');
        }

        await verifyDrafts(false);

        const publishedImages = [{
            imageId: imageRecord._id,
            filename: imageRecord.filename,
            mimetype: imageRecord.mimetype
        }];

        await db.publishPost(
            post._id,
            drafts[0]._id,
            new Date(),
            null,
            'title',
            'content',
            'url',
            'summary',
            publishedImages);

        await verifyDrafts(true);
    });

    it('Restore a draft', async () => {
        await testSetup.login();
        var { post, drafts } = await createPostAndDrafts();

        const draftToRestore = drafts[4];

        await server
            .post(`/drafts/restore/${draftToRestore._id}`)
            .expect(302)
            .expect('Location', `/drafts/${post._id}`);

        const updatedDrafts = (await db.getPostAndDrafts(post._id)).drafts;
        const restoredDraft = updatedDrafts[0];

        assert.equal(updatedDrafts.length, 6, 'Draft not restored');
        assert.equal(restoredDraft.title, draftToRestore.title, 'Title not restored');
        assert.equal(restoredDraft.content, draftToRestore.content, 'Content not restored');
        assert.isTrue(restoredDraft.createdAt > draftToRestore.createdAt, 'Time not updated when restoring a draft');
    });

    it('Restore a draft with an invalid id', async () => {
        await testSetup.login();

        await server
            .post('/drafts/restore/75rfutjde57')
            .expect(404)
    });

    it('Delete an image with an invalid id', async () => {
        await testSetup.login();

        await server
            .post('/drafts/deleteImage/75rfutjde57')
            .expect(404)
    });

    it('Delete an image', async () => {
        const img1Data = await fs.readFile('test/data/img1.jpg');
        const imageRecord = await db.insertImage(
            '6edhy6ehfdh',
            'hteshtehes',
            'img1.jpg',
            'image/jpeg',
            img1Data,
            {},
            Buffer.alloc(0),
            {},
            Buffer.alloc(20),
            {},
            Buffer.alloc(5),
            {});

        await testSetup.login();

        await server
            .post(`/drafts/deleteImage/${imageRecord._id}`)
            .expect(302)
            .expect('Location', `/drafts/${imageRecord.postId}`);

        assert.isNull(await db.getImageOrNull(imageRecord._id), 'Image not deleted');
    });
});

async function createPostAndDrafts() {
    const postsAndDraft = (await testSetup.createPosts(1))[0];
    const post = postsAndDraft.post;

    var draftItr = 0;
    db.dep.newDate = () => (new Date(new Date().getTime() + 5 * draftItr * 60000));
    const drafts = [];
    
    for (draftItr = 0; draftItr < 5; draftItr++) {
        drafts.push(await db.appendDraft(post._id, `title ${draftItr}`, `content ${draftItr}`));
    }
    return { post, drafts };
}
