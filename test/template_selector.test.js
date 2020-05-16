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

describe('Template selector', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Not authenticated', async () => {
        await server
            .get('/template_selector')
            .expect(401);

        await server
            .post('/template_selector')
            .expect(401);

        await server
            .get('/template_selector/sometemplate.css')
            .expect(401);
    });

    it('Get list of templates', async () => {
        await testSetup.login();

        const response = await server
            .get('/template_selector')
            .expect(200);

        const result = JSON.parse(response.text);
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

    it('Preview template', async () => {
        await testSetup.login();

        const response = await server
            .get('/template_selector/sometemplate.css')
            .expect(200);

        const result = JSON.parse(response.text);
        const options = result.options;

        assert.equal(options.linkPath, '/sometemplate.css')
    });

    it('Set template', async () => {
        await testSetup.login();

        const response = await server
            .post('/template_selector')
            .send('template=the_template')
            .expect(302)
            .expect('Location', `/config`);

        assert.equal(z3.config.template, 'the_template');

    });
});