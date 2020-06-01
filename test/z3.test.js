const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const fs  = require('fs').promises;

const cachedConfigurationValues = require('../cachedConfigurationValues');
const db = require('../db');
const z3 = require('../z3');
const runtimeOptions = require('../runtimeOptions');

describe('z3 module test', () => {

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Check verifying the password', async () => {

        assert.isFalse(await z3.checkPassword('bad password'), 'Incorrect password accepted');
        assert.isTrue(await z3.checkPassword(testSetup.passwordInfo.password), 'Correct password rejected');
        assert.isFalse(await z3.checkPassword(testSetup.passwordInfo.defaultPassword), 'Default password accepted');

        await testSetup.deletePassword();

        assert.isTrue(await z3.checkPassword(testSetup.passwordInfo.defaultPassword), 'Default password rejected');
    });

    it('Check changing the password', async () => {

        const newPassword = 'newpassword';
        const checkedBeforeChange = await z3.checkPassword(newPassword);

        assert.isFalse(checkedBeforeChange, 'The password should not be changed');

        await z3.changePassword(newPassword);
        const checkedAfterChange = await z3.checkPassword(newPassword);

        assert.isTrue(checkedAfterChange, 'The password should be changed');

        const passwordRecord = await db.getConfiguration('password');
        assert.isTrue(passwordRecord.hashAndSalt.startsWith('pbkdf2$10000$'), 'Incorrect hash and salt generated');
    });

    it('Check getting start and limit', async () => {

        function checkSkipLimit(query, expectedStart, expectedLimit) {
            const req = { query };

            const { skip: actualStart, limit: actualLimit } = z3.calculateSkipLimit(req);

            assert.equal(actualStart, expectedStart, 'Wrong start');
            assert.equal(actualLimit, expectedLimit, 'Wrong limit');
        }

        checkSkipLimit({}, 0, 25);
        checkSkipLimit({limit: 50}, 0, 50);
        checkSkipLimit({limit: 999999}, 0, 200);
        checkSkipLimit({limit: 0}, 0, 1);
        checkSkipLimit({limit: -1}, 0, 1);
        checkSkipLimit({limit: 'foo'}, 0, 25);

        checkSkipLimit({start: 3, limit: 5}, 2, 5);

        checkSkipLimit({start: -1}, 0, 25);
        checkSkipLimit({start: 'foo'}, 0, 25);
    });

    it('Check paging with start and limit', async() => {

        var { nextStart, nextStartMax, previousStart, previousStartMax } = z3.calculateNextSkipLimits(0, Array(5).fill({}), 50, 5);
        assert.equal(nextStart, 6, 'Wrong nextStart');
        assert.equal(nextStartMax, 10, 'Wrong nextStartMax');
        assert.equal(previousStart, null, 'Wrong previousStart');
        assert.equal(previousStartMax, null, 'Wrong previousStartMax');

        var { nextStart, nextStartMax, previousStart, previousStartMax } = z3.calculateNextSkipLimits(5, Array(5).fill({}), 50, 5);
        assert.equal(nextStart, 11, 'Wrong nextStart');
        assert.equal(nextStartMax, 15, 'Wrong nextStartMax');
        assert.equal(previousStart, 1, 'Wrong previousStart');
        assert.equal(previousStartMax, 5, 'Wrong previousStartMax');

        var { nextStart, nextStartMax, previousStart, previousStartMax } = z3.calculateNextSkipLimits(45, Array(5).fill({}), 50, 5);
        assert.equal(nextStart, null, 'Wrong nextStart');
        assert.equal(nextStartMax, null, 'Wrong nextStartMax');
        assert.equal(previousStart, 40, 'Wrong previousStart');
        assert.equal(previousStartMax, 44, 'Wrong previousStartMax');

        var { nextStart, nextStartMax, previousStart, previousStartMax } = z3.calculateNextSkipLimits(48, Array(5).fill({}), 50, 5);
        assert.equal(nextStart, null, 'Wrong nextStart');
        assert.equal(nextStartMax, null, 'Wrong nextStartMax');
        assert.equal(previousStart, 43, 'Wrong previousStart');
        assert.equal(previousStartMax, 47, 'Wrong previousStartMax');
    });

    async function verifyCheckIsAuthenticated401(req) {
        var err = null;
        const next = errCallback => err = errCallback;
        await z3.checkIsAuthenticated(req, {}, next);

        assert.isNotNull(err, 'Err not set');
        assert.equal(err.status, 401, 'Status not set to 401');
    }

    it('checkIsAuthenticated, no session', async () => {
        verifyCheckIsAuthenticated401({});
    });

    it('checkIsAuthenticated, no isLoggedIn', async () => {
        verifyCheckIsAuthenticated401({session:{}});
    });

    it('checkIsAuthenticated, isLoggedIn = false', async () => {
        verifyCheckIsAuthenticated401({session:{isLoggedIn: false}});
    });

    it('checkIsAuthenticated', async () => {
        var called = false;
        const next = err => {
            assert.isUndefined(err, 'Next called with an error');
            called = true;
        };

        await z3.checkIsAuthenticated({session:{isLoggedIn: true}}, {}, next);

        assert.isTrue(called, 'next not called');
    });

    it('constructUrlAndSummary', async () => {

        await testSetup.createPostsAndPublishedPosts(2, 2);

        const posts = await db.getPosts();

        var unpublishedPost = null;
        var publishedPost = null;
        for (var post of posts) {
            if (post.url) {
                publishedPost = post;
            } else {
                unpublishedPost = post;
            }
        }

        const draft = await db.getNewestDraft(unpublishedPost._id);

        draft.title = publishedPost.title;
        draft.content = '<h1>gsgjnreilugkhnesilghuilgrjegilnsrelgndk</h1>ghreskugbehruygkersbkg&nbsp;&nbsp;&nbsp;&nbsp;\n\nbhureskbghjksdbhjke                     behrubgersub<br />'
            + 'segsegsergregerageragre sdgdsgsgaergaergera agsgreagarga aergergeragagae ergsezgreera<br />'
            + 'segsegsergregerageragre sdgdsgsgaergaergera agsgreagarga aergergeragagae ergsezgreera<br />'
            + 'segsegsergregerageragre sdgdsgsgaergaergera agsgreagarga aergergeragagae ergsezgreera<br />'
            + 'segsegsergregerageragre sdgdsgsgaergaergera agsgreagarga aergergeragagae ergsezgreera<br />'
            + 'segsegsergregerageragre sdgdsgsgaergaergera agsgreagarga aergergeragagae ergsezgreera<br />'
            + 'segsegsergregerageragre sdgdsgsgaergaergera agsgreagarga aergergeragagae ergsezgreera<br />'
            + 'segsegsergregerageragre sdgdsgsgaergaergera agsgreagarga aergergeragagae ergsezgreera<br />'
            + 'segsegsergregerageragre sdgdsgsgaergaergera agsgreagarga aergergeragagae ergsezgreera<br />'


        var { url, summary } = await z3.constructUrlAndSummary(draft);

        assert.equal(url, `${publishedPost.url}_1`, 'Wrong conflicting url');
        assert.equal(
            summary,
            'gsgjnreilugkhnesilghuilgrjegilnsrelgndkghreskugbehruygkersbkg bhureskbghjksdbhjke behrubgersubsegsegsergregerageragre sdgdsgsgaergaergera agsgreagarga aergergeragagae ergsezgreerasegsegsergregeragerag');
    });

    it('constructUrlAndSummary, 0-length title', async () => {
        var { url, summary } = await z3.constructUrlAndSummary({
            title: '',
            content: ''
        });

        assert.equal(url, '_')
    });

    async function verifyConvertImgTags(url, imgUrlPrefix) {

        const post = (await testSetup.createPosts(1))[0].post;

        const postId = post._id;

        const img1Data = await fs.readFile('test/data/img1.jpg');
        const imageRecord = await db.insertImage(
            postId,
            'hteshtehes',
            'img1.jpg',
            'image/jpeg',
            img1Data,
            {height: 10, width: 10},
            Buffer.alloc(10),
            {height: 10, width: 10},
            Buffer.alloc(10),
            {height: 10, width: 10});

        const imageRecordDuplicateName = await db.insertImage(
            postId,
            'h4eh65h',
            'img1.jpg',
            'image/jpeg',
            img1Data,
            {height: 10, width: 10},
            Buffer.alloc(10),
            {height: 10, width: 10},
            Buffer.alloc(10),
            {height: 10, width: 10});

        const originalContent = `Image to update: <img src="/edit/image/${postId}/${imageRecord._id}">`
            + `Image to update: <img src="/edit/image/${postId}/${imageRecord._id}">`
            + `Image to update: <img src="/edit/image/${postId}/${imageRecordDuplicateName._id}">`
            + `Bad imageId: <img src="/edit/image/${postId}/dne">`
            + `Bad postId: <img src="/edit/image/dne/${imageRecord._id}">`
            + `Bad imageId: <img src="/edit/image/${postId}/9999999">`
            + `Bad postId: <img src="/edit/image/9999999/${imageRecord._id}">`;

        const { imageIdsToPublish, content } = await z3.extractImages(originalContent, url, postId);

        const expectedContent = `Image to update: <a href="${imgUrlPrefix}/img1.jpg?size=original" target="_blank"><img src="${imgUrlPrefix}/img1.jpg" width="10px" height="10px"></a>`
            + `Image to update: <a href="${imgUrlPrefix}/img1.jpg?size=original" target="_blank"><img src="${imgUrlPrefix}/img1.jpg" width="10px" height="10px"></a>`
            + `Image to update: <a href="${imgUrlPrefix}/1-img1.jpg?size=original" target="_blank"><img src="${imgUrlPrefix}/1-img1.jpg" width="10px" height="10px"></a>`
            + `Bad imageId: <img src="/edit/image/${postId}/dne">`
            + `Bad postId: <img src="/edit/image/dne/${imageRecord._id}">`
            + `Bad imageId: <img src="/edit/image/${postId}/9999999">`
            + `Bad postId: <img src="/edit/image/9999999/${imageRecord._id}">`;

        assert.equal(content, expectedContent, 'Img tags incorrectly filtered');
        assert.equal(imageIdsToPublish.length, 2, 'Wrong number of published images');

        const expectedImageIdsToPublish = [ imageRecord._id, imageRecordDuplicateName._id];

        assert.deepEqual(imageIdsToPublish, expectedImageIdsToPublish, 'Wrong published images');
    }
    
    it('Verify converting img tags on publish', async () => {
        await verifyConvertImgTags('the_url', '/the_url');
    });

    it('Verify converting img tags on publish, index page', async () => {
        await verifyConvertImgTags('', '');
    });

    it('Test loading the configuration', async () => {
        var expectedConfig;

        await db.setConfiguration('config', config => {
            config.title = 'load test title',
            config.author = 'load test author'

            expectedConfig = config;

            return config;
        }, () => {});

        const getNow = z3.getNow;
        z3.getNow = () => (new Date()).setMinutes(10);

        try {
            const actualConfig = await cachedConfigurationValues.getConfig();
            assert.deepEqual(actualConfig, expectedConfig, 'Wrong configuration loaded');
        } finally {
            z3.getNow = getNow;
        }
    });
});

