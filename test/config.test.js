const testSetup = require('./testSetup');

const chai = require('chai');
const chaiFiles = require('chai-files');
const fs = require('fs').promises;

const cachedConfigurationValues = require('../cachedConfigurationValues');
const db = require('../db');
const z3 = require('../z3');

const server = testSetup.server;
const assert = chai.assert;

chai.use(chaiFiles);

const expect = chai.expect;
const file = chaiFiles.file;

describe('Config', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Not authenticated', async() => {
        await testSetup.server
            .get('/config')
            .expect(401);

        await testSetup.server
            .post('/config')
            .expect(401);

        await testSetup.server
            .put('/config/avatar')
            .expect(401);

        await testSetup.server
            .get('/config/sometemplate.css')
            .expect(401);
    });

    it('Get config', async () => {
        await testSetup.login();

        const response = await testSetup.server
            .get('/config')
            .expect(200);

        const result = JSON.parse(response.text);
        const options = result.options;

        const config = await cachedConfigurationValues.getConfig();

        assert.equal(options.config.title, config.title, 'Wrong title');
        assert.equal(options.config.author, config.author, 'Wrong author');
        assert.equal(options.config.private, config.private, 'Wrong private');
        assert.equal(options.config.z3_cr_in_footer, config.z3_cr_in_footer, 'Wrong z3_cr_in_footer');
        assert.equal(options.config.headHtml, config.headHtml, 'Wrong headHtml');
        assert.equal(options.config.footerHtml, config.footerHtml, 'Wrong footerHtml');
        assert.equal(options.config.searchUrl, config.searchUrl, 'Wrong searchUrl');
        assert.equal(options.config.forceDomain, config.forceDomain, 'Wrong footerHtml');
        assert.equal(options.config.forceHttps, config.forceHttps, 'Wrong forceHttps');
        assert.deepEqual(options.config.redirects, config.redirects, 'Wrong redirects');
        assert.equal(options.redirects, JSON.stringify(config.redirects, null, 2), 'Wrong redirects');
        assert.isFalse(options.isAvatarConfigured, 'Wrong isAvatarConfigured');

        const templates = result.options.templates;
    
        assert.equal(templates.length, 4, 'Unexpected number of templates');

        function testTemplate(template, isBuiltIn, name) {
            assert.equal(template.isBuiltIn, isBuiltIn, 'Wrong isBuiltIn');
            assert.equal(template.shortName, name, 'Wrong shortName');
            assert.equal(template.linkPath, `templates/${isBuiltIn ? 'built-in' : 'custom'}/${name}.css`, 'Wrong linkPath');
        }

        testTemplate(templates[0], false, 'asphalt');
        testTemplate(templates[1], false, 'bricks');
        testTemplate(templates[2], true, 'brushstrokes');
        testTemplate(templates[3], true, 'cement');
    });

    it('Update config', async () => {
        await testSetup.login();

        await testSetup.server
            .post('/config')
            .send('title=new_title&author=new_author&private=checked&template=the_template&headHtml=hhh&footerHtml=fff&searchUrl=sss&forceDomain=foo&forceHttps=on&redirects={"/foo":"/bar"}')
            .expect(302)
            .expect('Location', `/config`);

        function checkConfig(config) {
            assert.equal(config.title, 'new_title', 'Wrong title');
            assert.equal(config.author, 'new_author', 'Wrong author');
            assert.equal(config.private, true, 'Wrong private');
            assert.equal(config.z3_cr_in_footer, false, 'Wrong z3_cr_in_footer');
            assert.equal(config.template, 'the_template');
            assert.equal(config.headHtml, 'hhh', 'Wrong headHtml');
            assert.equal(config.footerHtml, 'fff', 'Wrong footerHtml');
            assert.equal(config.searchUrl, 'sss', 'Wrong searchUrl');
            assert.equal(config.forceDomain, 'foo', 'Wrong forceDomain');
            assert.isTrue(config.forceHttps, 'Wrong forceHttps');
            assert.deepEqual(config.redirects, {'/foo':'/bar'});
        }

        checkConfig(await cachedConfigurationValues.getConfig());
    });

    it('Upload avatar', async () => {
        const img1Data = await fs.readFile('test/data/avatar.png');
        await testSetup.login();

        await testSetup.server
            .put('/config/avatar')
            .set('Content-type', 'image/png')
            .send(img1Data)
            .expect(201);

        const avatarValues = await cachedConfigurationValues.getAvatar();

        assert.isNotNull(avatarValues, 'Avatar not saved');
        assert.isDefined(avatarValues.avatar, 'avatar not defined');
        assert.isDefined(avatarValues.avatarWebp, 'avatarWebp not defined');
        assert.isDefined(avatarValues.avatarPng, 'avatarPng not defined');
        assert.isDefined(avatarValues.androidChrome192, 'androidChrome192 not defined');
        assert.isDefined(avatarValues.androidChrome512, 'androidChrome512 not defined');
        assert.isDefined(avatarValues.appleTouchIcon, 'appleTouchIcon not defined');
        assert.isDefined(avatarValues.favicon16, 'favicon16 not defined');
        assert.isDefined(avatarValues.favicon32, 'favicon32 not defined');
        assert.isDefined(avatarValues.favicon, 'favicon not defined');


        const response = await testSetup.server
            .get('/config')
            .expect(200);

        const result = JSON.parse(response.text);
        const options = result.options;
        assert.isTrue(options.isAvatarConfigured, 'Wrong isAvatarConfigured');
    });

    it('Preview template', async () => {
        await testSetup.login();

        const response = await testSetup.server
            .get('/config/sometemplate.css')
            .expect(200);

        const result = JSON.parse(response.text);
        const options = result.options;

        assert.equal(options.linkPath, '/sometemplate.css')
    });

});