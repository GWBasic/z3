const testSetup = require('./testSetup');

const chai = require('chai');
const chaiFiles = require('chai-files');
const fs = require('fs').promises;

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
        await server
            .get('/config')
            .expect(401);

        await server
            .post('/config')
            .expect(401);

        await server
            .put('/config/avatar')
            .expect(401);

        await server
            .get('/config/sometemplate.css')
            .expect(401);
    });

    it('Get config', async () => {
        await testSetup.login();

        const response = await server
            .get('/config')
            .expect(200);

        const result = JSON.parse(response.text);
        const options = result.options;

        assert.equal(options.config.title, z3.config.title, 'Wrong title');
        assert.equal(options.config.author, z3.config.author, 'Wrong author');
        assert.equal(options.config.private, z3.config.private, 'Wrong private');
        assert.equal(options.config.z3_cr_in_footer, z3.config.z3_cr_in_footer, 'Wrong z3_cr_in_footer');
        assert.equal(options.config.headHtml, z3.config.headHtml, 'Wrong headHtml');
        assert.equal(options.config.footerHtml, z3.config.footerHtml, 'Wrong footerHtml');
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

        await server
            .post('/config')
            .send('title=new_title&author=new_author&private=checked&template=the_template&headHtml=hhh&footerHtml=fff')
            .expect(302)
            .expect('Location', `/config`);

        function checkConfig(config) {
            assert.equal(config.title, 'new_title', 'Wrong title');
            assert.equal(config.author, 'new_author', 'Wrong author');
            assert.equal(config.private, true, 'Wrong private');
            assert.equal(config.z3_cr_in_footer, false, 'Wrong z3_cr_in_footer');
            assert.equal(config.template, 'the_template');
            assert.equal(config.headHtml, 'hhh', 'Wrong headHtml');
            assert.equal(config.footerHtml, 'fff');
        }

        checkConfig(z3.config);

        const configFileJSON = await fs.readFile(testSetup.runtimeOptions.configFile);
        const configFile = JSON.parse(configFileJSON);
        checkConfig(configFile);
    });

    it('Upload avatar', async () => {
        const img1Data = await fs.readFile('test/data/avatar.png');
        await testSetup.login();

        await server
            .put('/config/avatar')
            .set('Content-type', 'image/png')
            .send(img1Data)
            .expect(201);

        expect(file(`./${testSetup.runtimeOptions.publicFolder}/images/avatar.png`)).to.exist;
        expect(file(`./${testSetup.runtimeOptions.publicFolder}/images/avatar.webp`)).to.exist;
        expect(file(`./${testSetup.runtimeOptions.publicFolder}/android-chrome-192x192.png`)).to.exist;
        expect(file(`./${testSetup.runtimeOptions.publicFolder}/android-chrome-512x512.png`)).to.exist;
        expect(file(`./${testSetup.runtimeOptions.publicFolder}/apple-touch-icon.png`)).to.exist;
        expect(file(`./${testSetup.runtimeOptions.publicFolder}/favicon-16x16.png`)).to.exist;
        expect(file(`./${testSetup.runtimeOptions.publicFolder}/favicon-32x32.png`)).to.exist;
        expect(file(`./${testSetup.runtimeOptions.publicFolder}/favicon.ico`)).to.exist;

        const response = await server
            .get('/config')
            .expect(200);

        const result = JSON.parse(response.text);
        const options = result.options;
        assert.isTrue(options.isAvatarConfigured, 'Wrong isAvatarConfigured');
    });

    it('Preview template', async () => {
        await testSetup.login();

        const response = await server
            .get('/config/sometemplate.css')
            .expect(200);

        const result = JSON.parse(response.text);
        const options = result.options;

        assert.equal(options.linkPath, '/sometemplate.css')
    });

});