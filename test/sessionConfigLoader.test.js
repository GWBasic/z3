const assert  = require('chai').assert;
const fs = require('fs').promises;

const sessionConfigLoader = require('../sessionConfigLoader')

const FILENAME = 'sessionConfigLoader.test.json';

describe('session configuration handling', () => {

    afterEach(async () => {
        try {
            fs.access(FILENAME);
            fs.unlink(FILENAME);
        } catch {}
    });

    it('When there is no session configuration, create a new one', async () => {
        const defaultSessionValues = { cookieName: 'foo' };

        const createdSessionConfig = sessionConfigLoader.loadSession(FILENAME, defaultSessionValues);

        assert.isDefined(createdSessionConfig.secret, 'Secret not created');
        assert.isNotNull(createdSessionConfig.secret, 'Secret not created');
        assert.equal(defaultSessionValues.cookieName, createdSessionConfig.cookieName);

        const writtenSessionConfigJSON = await fs.readFile(FILENAME);
        const writtenSessionConfig = JSON.parse(writtenSessionConfigJSON);

        assert.deepEqual(createdSessionConfig, writtenSessionConfig, 'Session config not reloaded correctly');
    });

    it('When there is a session configuration, do not overwrite it', async () => {
        const expectedSessionConfig = { cookieName: 'foo', secret: 'shh, do not tell anyone' };
        const expectedSessionConfigJSON = JSON.stringify(expectedSessionConfig);
        await fs.writeFile(FILENAME, expectedSessionConfigJSON);

        const actualSessionConfig = sessionConfigLoader.loadSession(FILENAME, {});
        assert.deepEqual(actualSessionConfig, expectedSessionConfig);
    });
});