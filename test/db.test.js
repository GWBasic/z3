const runtimeOptions = require('../runtimeOptions');
runtimeOptions.db.location = 'testdata'

const assert  = require('chai').assert;
const fs  = require('fs').promises;

const db = require('../db');
const testSetup = require('./testSetup');

describe('Database', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Verify PostNotFoundError', async () => {
        const badPostId = '6435r5gw4gs';

        const functionNames = [
            'getPost',
            'getNewestDraft',
            'getPostFromUrl',
            'appendDraft',
            'getPostAndDrafts',
            'publishPost',
            'unPublishPost',
            'deletePost'
        ]

        for (var functionName of functionNames) {
            await assert.throwsAsync(db.PostNotFoundError, () => db[functionName](badPostId), `Incorrect error thrown for db.${functionName}`)
        }
    });

    it ('Create and read back a post', async () => {
        const title = 'test post';
        const postAndDrafts = await db.createPost(title);

        var post = postAndDrafts.post;
        var drafts = postAndDrafts.drafts;

        function verifyPost() {
            assert.isDefined(post._id);
            assert.isNotNull(post._id);
            assert.equal(post.workingTitle, title, 'post.working title incorrect');

            assert.isUndefined(post.title);
            assert.isUndefined(post.content);
            assert.isUndefined(post.publishedAt);
        }

        verifyPost();

        assert.equal(drafts.length, 1);

        var draft = drafts[0];

        function verifyDraft() {
            assert.equal(draft.title, title, 'draft.title incorrect');
            assert.equal(draft.content, '');
        }

        verifyDraft();

        draft = await db.getNewestDraft(post._id);
        verifyDraft();

        post = await db.getPost(post._id);
        verifyPost();
    });

    it ('Verify appendDraft, restoreDraft, publish, getPostFromUrl, isUrlInUse', async () => {
        const postAndDrafts = await db.createPost('title 1');

        var post = postAndDrafts.post;
        var drafts = postAndDrafts.drafts;

        const firstDraft = drafts[0];

        const title2 = 'title 2';
        const content2 = 'content 2';

        var secondDraft;
        function verifySecondDraft() {
            assert.equal(firstDraft._id, secondDraft._id);
            assert.equal(title2, secondDraft.title);
            assert.equal(content2, secondDraft.content);
        }

        secondDraft = await db.appendDraft(post._id, title2, content2);
        verifySecondDraft();

        secondDraft = await db.getNewestDraft(post._id);
        verifySecondDraft();

        post = await db.getPost(post._id);

        assert.equal(title2, post.workingTitle);

        db.dep.newDate = () => (new Date(new Date().getTime() + 5 * 60000));

        const title3 = 'title 3';
        const content3 = 'content 3';

        var thirdDraft;
        function verifyThirdDraft() {
            assert.notEqual(firstDraft._id, thirdDraft._id);
            assert.equal(title3, thirdDraft.title);
            assert.equal(content3, thirdDraft.content);
        }

        thirdDraft = await db.appendDraft(post._id, title3, content3);
        verifyThirdDraft();

        thirdDraft = await db.getNewestDraft(post._id);
        verifyThirdDraft();

        post = await db.getPost(post._id);

        assert.equal(title3, post.workingTitle);

        drafts = (await db.getPostAndDrafts(post._id)).drafts;

        assert.equal(2, drafts.length);

        thirdDraft = drafts[0];
        secondDraft = drafts[1];

        verifySecondDraft();
        verifyThirdDraft();

        var restoredSecondDraft = await db.restoreDraft(firstDraft._id);
        const restoredDraftId = restoredSecondDraft._id;

        function verifyRestoredDraft() {
            assert.equal(restoredDraftId, restoredSecondDraft._id);
            assert.equal(title2, restoredSecondDraft.title);
            assert.equal(content2, restoredSecondDraft.content);
        }

        verifyRestoredDraft();

        drafts = (await db.getPostAndDrafts(post._id)).drafts;

        assert.equal(3, drafts.length);

        restoredSecondDraft = drafts[0];
        thirdDraft = drafts[1];
        secondDraft = drafts[2];

        verifyRestoredDraft();
        verifySecondDraft();
        verifyThirdDraft();

        // publish = async (postId, draftId, title, content, url, summary)
        const url = 'the_url';
        const summary = 'the_summary';
        const publishedAt = new Date(1981, 3, 12);
        const republishedAt = new Date(1984, 5, 24);

        await db.publishPost(
            post._id,
            restoredSecondDraft._id,
            publishedAt,
            republishedAt,
            restoredSecondDraft.title,
            restoredSecondDraft.content,
            url,
            summary,
            []);

        const publishedPost = await db.getPostFromUrl(url);
        assert.equal(post._id, publishedPost._id);
        assert.equal(restoredSecondDraft._id, publishedPost.draftId);
        assert.equal(restoredSecondDraft.title, publishedPost.title);
        assert.equal(restoredSecondDraft.content, publishedPost.content);
        assert.equal(url, publishedPost.url);
        assert.equal(summary, publishedPost.summary);
        assert.equal(publishedAt.toString(), publishedPost.publishedAt.toString());
        assert.equal(republishedAt.toString(), publishedPost.republishedAt.toString());

        // TODO: This doesn't belong here
        //assert.equal(publishedPost.publishedImages.length, 0, 'Incorrect published images');

        const publishedPostOrNull = await db.getPostFromUrlOrNull(url);
        assert.isNotNull(publishedPostOrNull);
        assert.deepEqual(publishedPostOrNull, publishedPost);
    });

    it('Do not overwrite a published draft from appendDraft', async () =>{
        const postAndDrafts = await db.createPost('title 1');

        var post = postAndDrafts.post;
        var drafts = postAndDrafts.drafts;

        const firstDraft = drafts[0];

        await db.publishPost(
            post._id,
            firstDraft._id,
            null,
            null,
            'Published title',
            'Published content',
            'theurl',
            'Published summary');

        await db.appendDraft(post._id, 'New draft title', 'New draft content');

        const updatedPostAndDrafts = await db.getPostAndDrafts(post._id);

        assert.equal(2, updatedPostAndDrafts.drafts.length, 'Draft not added in appendDraft');
        assert.equal(updatedPostAndDrafts.drafts[1]._id, updatedPostAndDrafts.post.draftId, 'Published draft should be the oldest draft');
    });

    it ('getPostFromUrlOrNull not found', async () => {
        const publishedPostOrNull = await db.getPostFromUrlOrNull('doesntexist');
        assert.isNull(publishedPostOrNull);
    });

    it ('getPosts, getPublishedPosts, countAllPosts, countPublishedPosts', async () => {
        const NUM_POSTS = 50;
        const SKIP_TO_PUBLISH = 3;

        const postIds = [];

        for (var postItr = 0; postItr < NUM_POSTS; postItr++) {
            const postAndDrafts = await db.createPost(`Post ${postItr}`);
            postIds.push(postAndDrafts.post._id);
        }

        const numPosts = await db.countAllPosts();
        assert.equal(NUM_POSTS, numPosts);

        const allPostsInOrder = await db.getPosts();

        const LIMIT = NUM_POSTS / 10;
        for (var start = 0; start < NUM_POSTS; start += LIMIT) {
            const postsSlice = await db.getPosts(start, LIMIT);

            assert.equal(LIMIT, postsSlice.length);

            for (var postCtr = 0; postCtr < LIMIT; postCtr++) {
                assert.equal(allPostsInOrder[postCtr + start]._id, postsSlice[postCtr]._id);
            }
        }

        var now = new Date();

        var expectedNumPublishedPosts = 0;
        var postItr = 0;
        db.dep.newDate = () => new Date(now.getTime() + postItr * 1000);

        for (; postItr < NUM_POSTS; postItr++) {
            if (postItr % SKIP_TO_PUBLISH == 0) {
                const post = allPostsInOrder[postItr];
                const draft = (await db.getPostAndDrafts(post._id)).drafts[0];

                await db.publishPost(
                    post._id,
                    draft._id,
                    null,
                    null,
                    `Title ${postItr}`,
                    `Content ${postItr}`,
                    `${postItr}`,
                    `${postItr}`);

                expectedNumPublishedPosts++;
            }
        }

        const actualNumPublishedPosts = await db.countPublishedPosts();
        assert.equal(expectedNumPublishedPosts, actualNumPublishedPosts);

        const allPublishedPosts = await db.getPublishedPosts();
        assert.equal(allPublishedPosts.length, actualNumPublishedPosts);

        for (var start = 0; start < expectedNumPublishedPosts; start += LIMIT) {
            const postsSlice = await db.getPublishedPosts(start, LIMIT);

            var expectedNumberOfPublishedPosts;
            if (start + LIMIT < expectedNumPublishedPosts) {
                expectedNumberOfPublishedPosts = LIMIT;
            } else {
                expectedNumberOfPublishedPosts = expectedNumPublishedPosts - start;
            }

            assert.equal(expectedNumberOfPublishedPosts, postsSlice.length);

            for (var postCtr = 0; postCtr < expectedNumberOfPublishedPosts; postCtr++) {
                assert.equal(allPublishedPosts[postCtr + start]._id, postsSlice[postCtr]._id);
            }
        }
    });

    it('Unpublish', async () => {
        await testSetup.createPostsAndPublishedPosts(4, 2);

        const publishedPosts = await db.getPublishedPosts();
        assert.equal(publishedPosts.length, 2, 'This test should start with 2 published posts');

        const publishedPost = publishedPosts[0];

        await db.unPublishPost(publishedPost._id);
        const actualPublishedPosts = await db.getPublishedPosts();

        assert.equal(actualPublishedPosts.length, 1, 'Post was not unpublished');
        assert.notEqual(actualPublishedPosts[0]._id, publishedPost._id, 'Wrong post unpublished');
    });

    it('Delete', async () => {
        await testSetup.createPosts(4);

        const post = (await db.getPosts())[2];
        
        const img1Data = await fs.readFile('test/data/img1.jpg');

        const imageRecord = await db.insertImage(
            post._id,
            'hteshtehes',
            'img1.jpg',
            'image/jpeg',
            img1Data,
            {},
            Buffer.alloc(10),
            {},
            Buffer.alloc(10),
            {});

        const imageRecordDuplicateName = await db.insertImage(
            post._id,
            'h4eh65h',
            'img1.jpg',
            'image/jpeg',
            img1Data,
            {},
            Buffer.alloc(10),
            {},
            Buffer.alloc(10),
            {});
        
        await db.deletePost(post._id);

        const remainingPosts = await db.getPosts();

        assert.equal(3, remainingPosts.length, 'Post not deleted');

        for (var remainingPost of remainingPosts) {
            assert.notEqual(remainingPost._id, post._id, 'Post not deleted');
        }

        await assert.throwsAsync(db.ImageNotFoundError, async () => await db.getImage(imageRecord._id), 'Images not deleted');
        assert.isNull(await db.getImageOrNull(imageRecordDuplicateName._id), 'Images not deleted');
    });

    it('Publish static pages', async () => {
        testSetup.setAutoIncrementDate();

        var expectedStaticPages = await testSetup.createStaticPages(21);

        const numPublishedPages = await db.countPublishedPosts();

        assert.equal(0, numPublishedPages, 'No pages should be published');

        var actualStaticPages = await db.getAllStaticPages();

        for (const staticPage of ['header', 'footer']) {
            const actualPages = actualStaticPages[staticPage];

            assert.equal(actualPages.length, expectedStaticPages[staticPage].length, 'Wrong number of static pages returned')

            for (var ctr = 0; ctr < actualPages.length; ctr++) {
                assert.equal(actualPages[ctr]._id, expectedStaticPages[staticPage][ctr], 'Wrong ID')
            }
        }

        var pageToMove;

        // Test moving a page to the front
        pageToMove = actualStaticPages.header[3];
        await db.publishPost(
            pageToMove._id,
            pageToMove.draftId,
            db.dep.newDate(),
            null,
            pageToMove.title,
            pageToMove.contenttent,
            pageToMove.url,
            pageToMove.summary,
            [],
            'header',
            null);

        actualStaticPages = await db.getAllStaticPages();
        assert.equal(actualStaticPages.header[0]._id, pageToMove._id, 'Page not moved to the front');

        // Test moving a page onto itself
        pageToMove = actualStaticPages.header[3];
        await db.publishPost(
            pageToMove._id,
            pageToMove.draftId,
            db.dep.newDate(),
            null,
            pageToMove.title,
            pageToMove.content,
            pageToMove.url,
            pageToMove.summary,
            [],
            'header',
            pageToMove._id);

        actualStaticPages = await db.getAllStaticPages();
        assert.equal(actualStaticPages.header[3]._id, pageToMove._id, 'Page not moved onto itself');

        // Test moving a page onto itself (by being after the page before)
        pageToMove = actualStaticPages.header[3];
        await db.publishPost(
            pageToMove._id,
            pageToMove.draftId,
            db.dep.newDate(),
            null,
            pageToMove.title,
            pageToMove.content,
            pageToMove.url,
            pageToMove.summary,
            [],
            'header',
            actualStaticPages.header[2]._id);

        actualStaticPages = await db.getAllStaticPages();
        assert.equal(actualStaticPages.header[3]._id, pageToMove._id, 'Page not moved');

        // Test moving a page before another
        pageToMove = actualStaticPages.header[3];
        await db.publishPost(
            pageToMove._id,
            pageToMove.draftId,
            db.dep.newDate(),
            null,
            pageToMove.title,
            pageToMove.content,
            pageToMove.url,
            pageToMove.summary,
            [],
            'header',
            actualStaticPages.header[1]._id);

        actualStaticPages = await db.getAllStaticPages();
        assert.equal(actualStaticPages.header[2]._id, pageToMove._id, 'Page not moved');

        // Test moving a page last
        pageToMove = actualStaticPages.header[3];
        await db.publishPost(
            pageToMove._id,
            pageToMove.draftId,
            db.dep.newDate(),
            null,
            pageToMove.title,
            pageToMove.content,
            pageToMove.url,
            pageToMove.summary,
            [],
            'header',
            actualStaticPages.header[6]._id);

        actualStaticPages = await db.getAllStaticPages();
        assert.equal(actualStaticPages.header[6]._id, pageToMove._id, 'Page not moved to the end');

    });

    it('Invalid move destinations', async () => {

        const postsAndDraft = (await testSetup.createPosts(1))[0];
        const page = postsAndDraft.post;
        const draft = postsAndDraft.drafts[0];

        // afterId isn't part of static pages
        await assert.throwsAsync(db.UnknownStaticGroupError, async () =>
            await db.publishPost(
                page._id,
                draft._id,
                new Date(),
                null,
                draft.title,
                draft.content,
                `theurl`,
                'summary',
                [],
                'badstaticgroup',
                null));

        // staticGroup not known (0 static pages)
        await assert.throwsAsync(db.UnknownAfterPageIdError, async () =>
            await db.publishPost(
                page._id,
                draft._id,
                new Date(),
                null,
                draft.title,
                draft.content,
                `theurl`,
                'summary',
                [], 
                'header',
                'htesy5e5'));

        // staticGroup not known (many static pages)
        const postsAndDraftToPublish = (await testSetup.createPosts(1))[0];
        const pageToPublish = postsAndDraftToPublish.post;
        const draftToPublish = postsAndDraftToPublish.drafts[0];

        await db.publishPost(
            pageToPublish._id,
            draftToPublish._id,
            new Date(),
            null,
            draftToPublish.title,
            draftToPublish.content,
            `theurl`,
            'summary',
            [],
            'footer',
            null);

        await assert.throwsAsync(db.UnknownAfterPageIdError, async () =>
            await db.publishPost(
                page._id,
                draft._id,
                new Date(),
                null,
                draft.title,
                draft.content,
                `theurl`,
                'summary',
                [],
                'footer',
                'htesy5e5'));
    });

    it('ImageNotFoundError', async () => {
        await assert.throwsAsync(db.ImageNotFoundError, async () => await db.getImage('anid'));
        assert.isNull(await db.getImageOrNull('anid'));
    });

    it('Insert, retrieve, and delete images', async () => {

        const expectedImageRecord = await db.insertImage(
            'postid',
            'thehash',
            'thefilename',
            'themimetype',
            Buffer.alloc(10, 15),
            {},
            Buffer.alloc(10),
            {},
            Buffer.alloc(10),
            {});

        function verifyImage(actualImageRecord) {
            assert.equal(actualImageRecord._id, expectedImageRecord._id, 'Wrong ID');
            assert.equal(actualImageRecord.postId, expectedImageRecord.postId, 'Wrong postId');
            assert.equal(actualImageRecord.hash, expectedImageRecord.hash, 'Wrong hash');
            assert.equal(actualImageRecord.filename, expectedImageRecord.filename, 'Wrong filename');
            assert.equal(actualImageRecord.mimetype, expectedImageRecord.mimetype, 'Wrong mimetype');
            assert.isTrue(expectedImageRecord.imageData.equals(actualImageRecord.imageData), 'Wrong data');
        }

        const actualImageRecord = await db.getImage(expectedImageRecord._id);
        verifyImage(actualImageRecord);

        const actualImageRecords = await db.getImagesForPost('postid');
        assert.equal(actualImageRecords.length, 1, 'Wrong number of images returned')
        verifyImage(actualImageRecords[0]);

        const deletedImageId = actualImageRecords[0]._id;
        await db.deleteImage(deletedImageId);
        assert.isNull(await db.getImageOrNull(deletedImageId));
    });

    it('Publishing a duplicate url unpublishes the previous post', async () => {
        await testSetup.createPostsAndPublishedPosts(2, 2);

        const posts = await db.getPosts();

        const publishedPost = posts[0];
        const unpublishedPost = posts[1];
        const unpublishedDraft = (await db.getPostAndDrafts(unpublishedPost._id)).drafts[0];

        assert.isUndefined(unpublishedPost.url);
        assert.isDefined(publishedPost.url);

        await db.publishPost(
            unpublishedPost._id,
            unpublishedDraft._id,
            new Date(),
            null,
            unpublishedDraft.title,
            unpublishedDraft.content,
            publishedPost.url,
            'the summary',
            [],
            null,
            null);

        const updated_publishedPost = await db.getPost(publishedPost._id);
        const updated_unpublishedPost = await db.getPost(unpublishedPost._id);

        assert.isUndefined(updated_publishedPost.url);
        assert.isDefined(updated_unpublishedPost.url);
    })
});
