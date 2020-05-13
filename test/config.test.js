const testSetup = require('./testSetup');

const assert  = require('chai').assert;

const z3 = require('../z3');

const server = testSetup.server;

describe('Config test', () => {

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
    });

    it('Update config', async () => {
        await testSetup.login();

        const response = await server
            .post('/config')
            .send('title=new_title&author=new_author&private=checked')
            .expect(302)
            .expect('Location', `/config`);

        assert.equal(z3.config.title, 'new_title', 'Wrong title');
        assert.equal(z3.config.author, 'new_author', 'Wrong author');
        assert.equal(z3.config.private, true, 'Wrong private');
        assert.equal(z3.config.z3_cr_in_footer, false, 'Wrong z3_cr_in_footer');
    });
});