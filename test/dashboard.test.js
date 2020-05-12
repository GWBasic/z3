const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const db = require('../db');

const server = testSetup.server;

describe('Dashboard operations', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Not authenticated', async() => {
        await server
            .get('/dashboard')
            .expect(401);
    });

    it('Verify drafts shown', async() => {
        const rendered = await testSetup.verifyPostsShown('/dashboard?limit=999999', db.getPosts);

        assert.equal(rendered.fileName, 'dashboard.pogon.html');
    });

    it('Verify drafts range', async () => {
        const rendered = await testSetup.verifyPostsShownInRange('dashboard');

        assert.equal(rendered.fileName, 'dashboard.pogon.html');
    });
});