const runtimeOptions = require('../runtimeOptions');
runtimeOptions.db.location = 'testdata'

const assert  = require('chai').assert;
const Enumerable = require('linq-es2015');
const fs  = require('fs').promises;

const db = require('../db');
const testSetup = require('./testSetup');

describe('Database', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Verify PostNotFoundError', async () => {
        const badPostId = 123456789;

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
            await assert.throwsAsync(db.PostNotFoundError, async () => await db[functionName](badPostId), `Incorrect error thrown for db.${functionName}`)
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
            new Date(),
            null,
            'Published title',
            'Published content',
            'theurl',
            'Published summary',
            [],
            null,
            null);

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
                    new Date(),
                    null,
                    `Title ${postItr}`,
                    `Content ${postItr}`,
                    `${postItr}`,
                    `${postItr}`,
                    [],
                    null,
                    null);

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
        await testSetup.createPostsAndPublishedPosts(4, 2);

        const posts = await db.getPosts();
        var remainingPostsCount = posts.length;

        assert.isTrue(Enumerable.asEnumerable(posts).Any(p => p.url != null), 'At least one post must be published');
        
        for (var post of posts) {
            const img1Data = await fs.readFile('test/data/img1.jpg');

            const imageRecord = await db.insertImage(
                post._id,
                'hteshtehes',
                'img1.jpg',
                'image/jpeg',
                img1Data,
                {width: 20, height: 20},
                Buffer.alloc(10),
                {width: 10, height: 10},
                Buffer.alloc(10),
                {width: 5, height: 5});

            const imageRecordDuplicateName = await db.insertImage(
                post._id,
                'h4eh65h',
                'img2.jpg',
                'image/jpeg',
                img1Data,
                {width: 20, height: 20},
                Buffer.alloc(10),
                {width: 10, height: 10},
                Buffer.alloc(10),
                {width: 5, height: 5});
            
            await db.deletePost(post._id);

            const remainingPosts = await db.getPosts();

            remainingPostsCount--;
            assert.equal(remainingPostsCount, remainingPosts.length, 'Post not deleted');

            for (var remainingPost of remainingPosts) {
                assert.notEqual(remainingPost._id, post._id, 'Post not deleted');
            }

            await assert.throwsAsync(db.ImageNotFoundError, async () => await db.getImage(imageRecord._id), 'Images not deleted');
            assert.isNull(await db.getImageOrNull(imageRecordDuplicateName._id), 'Images not deleted');
        }
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
        await assert.throwsAsync(db.ImageNotFoundError, async () => await db.getImage(8888));
        assert.isNull(await db.getImageOrNull(9999));
    });

    it('Insert, retrieve, and delete images', async () => {

        const postsAndDrafts = await testSetup.createPosts(1);
        const postAndDrafts = postsAndDrafts[0];
        const post = postAndDrafts.post;

        const expectedImageRecord = await db.insertImage(
            post._id,
            'thehash',
            'thefilename',
            'themimetype',
            Buffer.alloc(10, 15),
            {width: 4, height: 8},
            Buffer.alloc(10),
            {width: 3, height: 7},
            Buffer.alloc(10),
            {width: 2, height: 6});

        function verifyImage(actualImageRecord) {
            assert.deepEqual(actualImageRecord, expectedImageRecord);
        }

        const actualImageRecord = await db.getImage(expectedImageRecord._id);
        verifyImage(actualImageRecord);

        const actualImageRecords = await db.getImagesForPost(post._id);
        assert.equal(actualImageRecords.length, 1, 'Wrong number of images returned')
        verifyImage(actualImageRecords[0]);

        const deletedImageId = actualImageRecords[0]._id;
        await db.deleteImage(deletedImageId);
        assert.isNull(await db.getImageOrNull(deletedImageId));
    });

    it('Publishing a duplicate url unpublishes the previous post', async () => {
        await testSetup.createPostsAndPublishedPosts(2, 2);

        const posts = await db.getPosts();
        const enumerablePosts = Enumerable.asEnumerable(posts);

        const publishedPost = enumerablePosts.First(p => p.url);
        const unpublishedPost = enumerablePosts.First(p => !(p.url));
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
    });

    it('Publishing a post sets published=true for images, getImageOrNullByUrlAndFilename', async () => {

        const postsAndDrafts = await testSetup.createPosts(1);
        const postAndDrafts = postsAndDrafts[0];
        const post = postAndDrafts.post;
        const draft = postAndDrafts.drafts[0];

        const images = [];
        for (var imageCtr = 0; imageCtr < 6; imageCtr++) {
            const newImage = await db.insertImage(
                post._id,
                `hash${imageCtr}`,
                `filename${imageCtr}`,
                'themimetype',
                Buffer.alloc(10, 15),
                {width: 4, height: 8},
                Buffer.alloc(10),
                {width: 3, height: 7},
                Buffer.alloc(10),
                {width: 2, height: 6});

            images.push(newImage);
        }

        await db.publishPost(
            post._id,
            draft._id,
            new Date(),
            null,
            'title',
            'content',
            'url',
            'the summary',
            [images[0]._id, images[1]._id, images[2]._id],
            null,
            null);

        const imagesFromDatabase = await db.getImagesForPost(post._id);

        const expectedPublished = {};
        expectedPublished[images[0]._id] = true;
        expectedPublished[images[1]._id] = true;
        expectedPublished[images[2]._id] = true;
        expectedPublished[images[3]._id] = false;
        expectedPublished[images[4]._id] = false;
        expectedPublished[images[5]._id] = false;

        for (var imageFromDatabase of imagesFromDatabase) {
            assert.equal(imageFromDatabase.published, expectedPublished[imageFromDatabase._id], 'Wrong published');

            const reloadedImage = await db.getImageOrNullByUrlAndFilename('url', imageFromDatabase.filename);
            assert.deepEqual(reloadedImage, imageFromDatabase);
        }
    });

    it ('verify index, header, and footer pages do not show in scans of blog posts', async () => {
        const postsAndDrafts = await testSetup.createPosts(3);

        const indexPost = postsAndDrafts[0].post;
        const indexDraft = postsAndDrafts[0].drafts[0];

        await db.publishPost(
            indexPost._id,
            indexDraft._id,
            new Date(),
            null,
            'index post',
            'index content',
            '',
            'summary',
            [],
            null,
            null);

        const headerPost = postsAndDrafts[1].post;
        const headerDraft = postsAndDrafts[1].drafts[0];

        await db.publishPost(
            headerPost._id,
            headerDraft._id,
            new Date(),
            null,
            'header post',
            'header content',
            'h',
            'summary',
            [],
            'header',
            null);

        const footerPost = postsAndDrafts[2].post;
        const footerDraft = postsAndDrafts[2].drafts[0];

        await db.publishPost(
            footerPost._id,
            footerDraft._id,
            new Date(),
            null,
            'footer post',
            'footer content',
            'h',
            'summary',
            [],
            'footer',
            null);
    
        const publishedPosts = await db.getPublishedPosts();
        assert.equal(publishedPosts.length, 0, 'There should be no published posts')
    
        const numPublishedPosts = await db.countPublishedPosts();
        assert.equal(numPublishedPosts, 0, 'There should be no published posts')
    });
});
