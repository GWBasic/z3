const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const db = require('../db');

const server = testSetup.server;

describe('Blog operations', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Verify blog entries shown', async() => {
        const rendered = await testSetup.verifyPostsShown('/blog?limit=999999', db.getPublishedPosts);

        assert.equal(rendered.fileName, 'blogindex.pogon.html');
    });

    it('Verify blog range', async () => {
        const rendered = await testSetup.verifyPostsShownInRange('blog');

        assert.equal(rendered.fileName, 'blogindex.pogon.html');
    });
});