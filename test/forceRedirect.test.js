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

describe('Force redirects', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    /*

    TODO: Currently disabled. I don't know how to determine the port number when running a test
    
    it('Force domain disabled', async () => {
        await server
            .get('http://localhost:3000/')
            .expect(200);

        await server
            .get('http://127.0.0.1:3000/')
            .expect(200);
    });

    it('Force domain enabled', async () => {
        assert.fail('incomplete');
    });

    it('Force https disabled', async () => {
        assert.fail('incomplete');
    });

    it('Force https enabled', async () => {
        assert.fail('incomplete');
    }); */

    it('Force redirects', async () => {
        await server
            .get('/dne')
            .expect(404);

        z3.config.redirects = {
            '/dne': '/exists'
        };

        await server
            .get('/dne')
            .expect(302)
            .expect('Location', '/exists');
    });
});
