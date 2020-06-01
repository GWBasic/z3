const runtimeOptions = require('../runtimeOptions');

const assert  = require('chai').assert;
const Enumerable = require('linq-es2015');
const format = require('pg-format');

const dbConnector = require('../dbConnector');
const testSetup = require('./testSetup');

describe('Database Connector', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Test listening', async () => {

        const channel = 'testchannel';
        const expectedMessage = 'the me\'ssage';
        var resolve;
        var reject;

        var testPromise = new Promise((s, j) => {
            resolve = s;
            reject = j;
        });

        await dbConnector.listen(channel, message => {
            resolve(message)
        });

        const client = await dbConnector.connectToPool();

        try {
            await client.query(`NOTIFY ${format.ident(channel)}, ${format.literal(expectedMessage)}`);
        } catch (err) {
            reject(err);
        } finally {
            client.release();
        }

        const actualMessage = await testPromise;

        assert.equal(actualMessage, expectedMessage);
    });
});