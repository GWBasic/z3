const testSetup = require('./testSetup');

const assert  = require('chai').assert;
const fs = require('fs').promises;

const db = require('../db');
const sessionConfigLoader = require('../sessionConfigLoader')

describe('session configuration handling', () => {

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('When there is no session configuration, create a new one', async () => {
        await db.setConfiguration(
            'session',
            _ => null,
            () => null);

        const defaultSessionValues = { cookieName: 'foo' };

        const createdSessionConfig = await sessionConfigLoader.loadSession(defaultSessionValues);

        assert.isDefined(createdSessionConfig.secret, 'Secret not created');
        assert.isNotNull(createdSessionConfig.secret, 'Secret not created');
        assert.equal(defaultSessionValues.cookieName, createdSessionConfig.cookieName);

        const writtenSessionConfig = await db.getConfiguration('session');

        assert.deepEqual(createdSessionConfig, writtenSessionConfig, 'Session config not reloaded correctly');
    });

    it('When there is a session configuration, do not overwrite it', async () => {
        const expectedSessionConfig = { cookieName: 'foo', secret: 'shh, do not tell anyone' };

        await db.setConfiguration(
            'session',
            _ => expectedSessionConfig,
            () => null);

        const actualSessionConfig = await sessionConfigLoader.loadSession({});
        assert.deepEqual(actualSessionConfig, expectedSessionConfig);
    });
});