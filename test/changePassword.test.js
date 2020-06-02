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

describe('Change password', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Wrong password', async() => {
        await testSetup.login();

        const response = await testSetup.server
            .post('/changePassword')
            .send('currentPassword=bad&newPassword=secret')
            .expect(401)

        const result = JSON.parse(response.text);
        const options = result.options;
    
        assert.isTrue(options.wrongPassword, "wrongPassword not set");
        assert.isUndefined(options.passwordUpdated, "passwordUpdated should not be set");

        const oldPasswordWorks = await z3.checkPassword(testSetup.passwordInfo.password);
        assert.isTrue(oldPasswordWorks, 'The password was changed when it wasnt supposed to be');
    });

    it('Password is changed', async() => {
        const response = await testSetup.server
            .post('/changePassword')
            .send(`currentPassword=${testSetup.passwordInfo.password}&newPassword=secret`)
            .expect(200)

        const result = JSON.parse(response.text);
        const options = result.options;
    
        assert.isUndefined(options.wrongPassword, "wrongPassword should not set");
        assert.isTrue(options.passwordUpdated, "passwordUpdated should be set");

        const oldPasswordWorks = await z3.checkPassword(testSetup.passwordInfo.password);
        assert.isFalse(oldPasswordWorks, 'The password wasnt changed when it wasnt supposed to be');

        const newPasswordWorks = await z3.checkPassword('secret');
        assert.isTrue(newPasswordWorks, 'The new password doesnt work');
    });

    it('Redirect to changePassword when no password configured', async () => {
        assert.fail('incomplete');
    });

    it('Do not allow using the default password', async () => {
        assert.fail('incomplete');
    });

    it('Encouraged to change the default password', async () => {
        assert.fail();
    });
});