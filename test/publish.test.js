const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const db = require('../db');
const z3 = require('../z3');

const server = testSetup.server;

describe('Publish operations', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Verify calls are authenticated', async () => {
        await testSetup.server
            .get('/publish/anid')
            .expect(401);

        await testSetup.server
            .post('/publish/anid')
            .expect(401);

        var { post, workingTitle, content } = await testSetup.preparePost();

        await testSetup.server
            .post(`/publish/${post._id}`)
            .expect(401);

        await testSetup.server
            .post(`/publish/unPublish/${post._id}`)
            .expect(401);

        await testSetup.server
            .post(`/publish/delete/${post._id}`)
            .expect(401);
    });

    it('Verify 404s', async () => {
        await testSetup.login();

        await testSetup.server
            .get('/publish/12345')
            .expect(404);

        await testSetup.server
            .post('/publish/12345')
            .expect(404);

        await testSetup.server
            .post('/publish/unPublish/12345')
            .expect(404);

        await testSetup.server
            .post('/publish/delete/12345')
            .expect(404);
    });

    it('View publish page', async () => {

        const publishedAt = new Date(1981, 3, 12);
        const republishedAt = new Date(1984, 5, 24);

        testSetup.setAutoIncrementDate();
        await testSetup.createStaticPages(21);
        const staticPages = await db.getAllStaticPages();
        const staticPageNames = z3.staticLocations;

        var unpublishedPost;
        for (const post of (await db.getPosts())) {
            if (!(post.url)) {
                unpublishedPost = post;
            }
        }

        const unpublishedPostAndDrafts = await db.getPostAndDrafts(unpublishedPost._id);
        unpublishedPost = unpublishedPostAndDrafts.post;
        const draft = unpublishedPostAndDrafts.drafts[0];

        await testSetup.login();

        async function checkPublishPage(isPublished, url) {
            var result = await testSetup.server
                .get(`/publish/${unpublishedPost._id}`)
                .expect(200);

            const editortestResult = JSON.parse(result.text);
            const options = editortestResult.options;

            for (var staticCtr = 0; staticCtr < staticPageNames.length; staticCtr++) {
                const staticGroup = staticPageNames[staticCtr];
                const actualStaticPages = options.staticPages[staticCtr];

                assert.equal(actualStaticPages.staticGroup, staticGroup, `staticGroup wrong for item ${staticCtr}`);
                assert.equal(actualStaticPages.toBlogValue, encodeURI(JSON.stringify({n: staticGroup})), `toBlogValue wrong for item ${staticCtr}`);
                assert.isUndefined(actualStaticPages.checked, `checked wrong for item ${staticCtr}`)

                // Check ID

                const pages = staticPages[staticGroup];
                for (var pageCtr = 0; pageCtr < pages.length; pageCtr++) {
                    const actualPage = actualStaticPages.pages[pageCtr];

                    assert.equal(actualPage._id, pages[pageCtr]._id, `Static page ${staticGroup} at ${pageCtr} is wrong`)
                    assert.equal(actualPage.toBlogValue, encodeURI(JSON.stringify({n: staticGroup, a: pages[pageCtr]._id})), `Static page ${staticGroup} at ${pageCtr} is wrong`)
                    assert.equal(actualPage.checked, actualPage._id == unpublishedPost._id, `Static page ${staticGroup} at ${pageCtr} is wrong for checked`)
                }
            }

            assert.equal(options.postId, unpublishedPost._id, 'Wrong postId');
            assert.equal(options.content, draft.content, 'Wrong content');
            assert.equal(options.title, draft.title, 'Wrong title');
            assert.equal(options.isBlog, !isPublished, 'By default, publishing as a blog post should be checked');
            assert.isFalse(options.isIndex, 'IsIndex should be false');
            assert.equal(options.isPublished, isPublished, 'Wrong isPublished');
            
            if (isPublished) {
                assert.equal(new Date(options.publishedAt).toString(), publishedAt.toString(), 'Wrong publishedAt');
                assert.equal(new Date(options.republishedAt).toString(), republishedAt.toString(), 'Wrong republishedAt');
            } else {
                assert.isNull(options.publishedAt, 'Wrong publishedAt');
                assert.isNull(options.republishedAt, 'Wrong republishedAt');
            }

            assert.equal(options.toBlogValue, encodeURI(JSON.stringify({})), 'Wrong toBlogValue');

            assert.equal(options.url, url);

            return options;
        }

        var options = await checkPublishPage(false);

        await db.publishPost(
            unpublishedPost._id,
            draft._id,
            publishedAt,
            republishedAt,
            draft.title,
            draft.content,
            'theurl',
            'thesummary',
            [],
            'header',
            options.staticPages[0].pages[1]._id);

        const publishedPage = await db.getPost(unpublishedPost._id);
        staticPages['header'].splice(2, 0, publishedPage);

        await checkPublishPage(true, 'theurl');
    });

    it('Publish, unpublish, delete a post', async () => {
        await testSetup.login();
        var { post, workingTitle, content } = await testSetup.preparePost();

        const imageRecord = await db.insertImage(
            post._id,
            'hash',
            'filename',
            'mimetype',
            Buffer.alloc(13),
            { width: 60, height: 120 },
            Buffer.alloc(0),
            { width: 30, height: 60 },
            Buffer.alloc(20),
            { width: 15, height: 30 });

        content += `<img src="/edit/image/${post._id}/${imageRecord._id}">`;

        await db.appendDraft(post._id, workingTitle, content);

        const whereParam = encodeURI(JSON.stringify({}));
        const publishedAt = new Date(1981, 3, 12);
        const republishedAt = new Date(1984, 5, 24);

        var response = await testSetup.server
            .post(`/publish/${post._id}`)
            .send(`where=${whereParam}&publishedAt=${encodeURI(publishedAt)}&republishedAt=${encodeURI(republishedAt)}`)
            .expect(302)
            .expect('Location', `/publish/${post._id}`);

        var url = response.headers.location.substring(1);

        post = await db.getPost(post._id);
        const publishedPost = await db.getPostFromUrl(post.url);

        assert.equal(publishedPost._id, post._id);
        assert.isDefined(publishedPost.url);
        assert.isDefined(publishedPost.title);
        assert.isDefined(publishedPost.content);
        assert.equal(publishedPost.publishedAt.toString(), publishedAt.toString(), 'Wrong publishedAt');
        assert.equal(publishedPost.republishedAt.toString(), republishedAt.toString(), 'Wrong republishedAt');
        assert.isTrue(publishedPost.content.endsWith('<a href="/title_for_test/filename?size=original" target="_blank"><img src="/title_for_test/filename" width="30px" height="60px"></a>'), 'Image link not updated');

        // unpublish
        response = await testSetup.server
            .post(`/publish/unPublish/${post._id}`)
            .expect(302)
            .expect('Location', `/publish/${post._id}`);

        await assert.throwsAsync(db.PostNotFoundError, async () => await db.getPostFromUrl(url), 'Post not un-published');

        // delete
        response = await testSetup.server
            .post(`/publish/delete/${post._id}`)
            .expect(302)
            .expect('Location', '/dashboard');

        await assert.throwsAsync(db.PostNotFoundError, async () => await db.getPost(post._id), 'Post not deleted');

        const imageRecords = await db.getImagesForPost(post._id);
        assert.equal(imageRecords.length, 0, 'Images not deleted');
    });

    it('suggestedLocation for unpublished pages', async () => {
        await testSetup.login();

        async function testPublishOptions(suggestedLocation, toCheck, publish = false) {
            const post = (await db.createPost(`Goes in ${suggestedLocation}`, suggestedLocation)).post;

            var result = await testSetup.server
                .get(`/publish/${post._id}`)
                .expect(200);

            const editortestResult = JSON.parse(result.text);
            const options = editortestResult.options;

            if (toCheck.blog) {
                assert.isTrue(options.isBlog);
            } else {
                assert.isFalse(options.isBlog);
            }

            if (toCheck.index) {
                assert.isTrue(options.isIndex);
            } else {
                assert.isFalse(options.isIndex);
            }

            if (toCheck.firstHeader) {
                assert.isTrue(options.staticPages[0].checked);
            } else {
                assert.isUndefined(options.staticPages[0].checked);
            }

            if (toCheck.secondHeader) {
                assert.isTrue(options.staticPages[0].pages[0].checked);
            } else {
                if (options.staticPages[0].pages.length > 0) {
                    assert.isFalse(options.staticPages[0].pages[0].checked);
                }
            }

            if (toCheck.firstFooter) {
                assert.isTrue(options.staticPages[1].checked);
            } else {
                assert.isUndefined(options.staticPages[1].checked);
            }

            if (toCheck.secondFooter) {
                assert.isTrue(options.staticPages[1].pages[0].checked);
            } else {
                if (options.staticPages[1].pages.length > 0) {
                    assert.isFalse(options.staticPages[1].pages[0].checked);
                }
            }

            if (publish) {
                const postAndDrafts = await db.getPostAndDrafts(post._id);
                const draft = postAndDrafts.drafts[0];

                await db.publishPost(
                    post._id,
                    draft._id,
                    new Date(),
                    null,
                    draft.workingTitle,
                    draft.content,
                    suggestedLocation,
                    'summary',
                    [],
                    suggestedLocation,
                    null);
            }
        }

        await testPublishOptions('blog', {blog: true});
        await testPublishOptions('index', {index: true});
        await testPublishOptions('header', {firstHeader: true}, true);
        await testPublishOptions('footer', {firstFooter: true}, true);

        await testPublishOptions('header', {secondHeader: true});
        await testPublishOptions('footer', {secondFooter: true});
    })
});