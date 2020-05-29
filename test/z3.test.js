const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const fs  = require('fs').promises;

const db = require('../db');
const z3 = require('../z3');
const runtimeOptions = require('../runtimeOptions');

describe('z3 module test', () => {

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Check if the password is configured', async () => {
        await fs.writeFile(runtimeOptions.authentication.passwordFile, JSON.stringify(testSetup.passwordInfo.hashAndSalt));

        assert.isTrue(await z3.isPasswordConfigured(), "Password is not configured");

        await testSetup.deletePassword();

        assert.isFalse(await z3.isPasswordConfigured(), "Password is not configured");
    });

    it('Check verifying the password', async () => {
        await fs.writeFile(runtimeOptions.authentication.passwordFile, JSON.stringify(testSetup.passwordInfo.hashAndSalt));

        assert.isTrue(await z3.checkPassword(testSetup.passwordInfo.password), "Could not verify the password")
        assert.isFalse(await z3.checkPassword('badpassword'), "Incorrect password")
    });

    it('Check generating the password file', async () => {

        const hashAndSaltJSON = await z3.generatePasswordAndHash('password');

        assert.isTrue(hashAndSaltJSON.startsWith('pbkdf2$10000$'), 'Incorrect hash and salt generated');
    });

    it('Check changing the password', async () => {
        assert.fail('Incomplete');
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
        const postId = 'gregreeragea';

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

        const originalContent = +`Image to update: <img src="/edit/image/${postId}.${imageRecord._id}">`
            + `Image to update: <img src="/edit/image/${postId}.${imageRecord._id}">`
            + `Image to update: <img src="/edit/image/${postId}.${imageRecordDuplicateName._id}">`
            + `Bad imageId: <img src="/edit/image/${postId}.dne">`
            + `Bad postId: <img src="/edit/image/dne.${imageRecord._id}">`;

        const { publishedImages, content } = await z3.extractImages(originalContent, url, postId);

        const expectedContent = +`Image to update: <img src="${imgUrlPrefix}/img1.jpg">`
            + `Image to update: <a href="${imgUrlPrefix}/img1.jpg?size=original" target="_blank"><img src="${imgUrlPrefix}/img1.jpg" width="10px" height="10px"></a>`
            + `Image to update: <a href="${imgUrlPrefix}/1_img1.jpg?size=original" target="_blank"><img src="${imgUrlPrefix}/1_img1.jpg" width="10px" height="10px"></a>`
            + `Bad imageId: <img src="/edit/image/${postId}.dne">`
            + `Bad postId: <img src="/edit/image/dne.${imageRecord._id}">`;

        assert.equal(content, expectedContent, 'Img tags incorrectly filtered');
        assert.equal(publishedImages.length, 2, 'Wrong number of published images');

        const expectedPublishedImages = [{
            filename: 'img1.jpg',
            imageId: imageRecord._id,
            mimetype: 'image/jpeg'
        }, {
            filename: '1_img1.jpg',
            imageId: imageRecordDuplicateName._id,
            mimetype: 'image/jpeg'
        }];

        assert.deepEqual(publishedImages, expectedPublishedImages, 'Wrong published images');
    }
    
    it('Verify converting img tags on publish', async () => {
        await verifyConvertImgTags('the_url', '/the_url');
    });

    it('Verify converting img tags on publish, index page', async () => {
        await verifyConvertImgTags('', '');
    });

    it('Test loading the configuration', async () => {
        /*const expectedConfig = {
            title: 'load test title',
            author: 'load test author'
        };

        const configJSON = JSON.stringify(expectedConfig);
        await fs.writeFile(runtimeOptions.configFile, configJSON);

        z3.loadConfig_BLOCKING_CALL_FOR_TESTS();

        assert.deepEqual(await z3.getCachedConfig(), expectedConfig, 'Wrong config saved');*/

        assert.fail('incomplete');
    });

    it('Test saving the configuration', async () => {

        /*z3.updateConfig(config => {
            config.title = 'Written title';
            config.author = 'Written author';
        });

        const configBuffer = await fs.readFile(runtimeOptions.configFile);
        const actualConfig = JSON.parse(configBuffer);

        assert.deepEqual(actualConfig, await z3.getCachedConfig(), 'Configuration not saved correctly'); */

        assert.fail('Incomplete');
    });

    it('Test configuration cache expiration', async () => {
        assert.fail('Incomplete');
    });
});

