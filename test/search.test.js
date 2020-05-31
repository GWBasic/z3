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

describe('Search', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('q parameter missing', async () => {
        await testSetup.server
            .get('/search')
            .expect(400)
    });

    it('no search engine configured', async () => {
        await testSetup.server
            .get('/search?q=bloop')
            .expect(302)
            .expect('Location', 'https://www.google.com/search?q=bloop&as_sitesearch=127.0.0.1');
    });

    it('search engine configured', async () => {
        z3.updateConfig(config => {
            config.searchUrl = 'https://search?q=%query%&h=%host%';
        });

        await testSetup.server
            .get('/search?q=bloop+beep')
            .expect(302)
            .expect('Location', 'https://search?q=bloop%20beep&h=127.0.0.1');
    });
});