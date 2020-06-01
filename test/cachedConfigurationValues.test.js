const runtimeOptions = require('../runtimeOptions');

const assert  = require('chai').assert;
const Enumerable = require('linq-es2015');
const format = require('pg-format');

const dbConnector = require('../dbConnector');
const cachedConfigurationValues = require('../cachedConfigurationValues');
const testSetup = require('./testSetup');

describe('Cached configuration values', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('Test get and update', async () => {
        const name = 'yamo';
        const expectedValue = {a:1, b:2, c:3};

        var reject = () => {};
        const timeout = setTimeout(() => reject(), 5000);

        try {
            var value;

            // No value should be configured
            value = await cachedConfigurationValues.get(name);
            assert.isNull(value, 'Value should not be configured');

            // Wait until the event comes before re-reading the value
            var waitForEvent;
            waitForEvent = new Promise((resolve, j) => {
                cachedConfigurationValues.callOnEvent = resolve;
                reject = () => j(new Error("Callback didn't come"));
            });

            await cachedConfigurationValues.set(name, expectedValue);
            await waitForEvent;

            value = await cachedConfigurationValues.get(name);
            assert.deepEqual(value, expectedValue, 'Value not updated via an event')

            waitForEvent = new Promise((resolve, j) => {
                cachedConfigurationValues.callOnEvent = resolve();
                reject = () => j(new Error("Callback didn't come"));
            });

            dbConnector.end();
            await waitForEvent;

            value = await cachedConfigurationValues.get(name);
            assert.deepEqual(value, expectedValue, 'Value not updated via reconnect')
        } finally {
            cachedConfigurationValues.callOnEvent = null;
            clearTimeout(timeout);

            const client = await dbConnector.connectToPool();

            try {
                await client.query(
                    "DELETE FROM configurations WHERE name=$1",
                    [name]);
            } finally {
                client.release();
            }
        }
    });

    it('Test saving the configuration', async () => {
        const config = await cachedConfigurationValues.getConfig();
        config.title = 'Written title';
        config.author = 'Written author';
        await cachedConfigurationValues.setConfig(config);

        const client = await dbConnector.connectToPool();

        try {
            const selectConfigQuery = await client.query("SELECT * FROM configurations WHERE name='config'");
            const actualConfig = selectConfigQuery.rows[0].obj;
            assert.deepEqual(actualConfig, config, 'Configuration not saved correctly');
        } finally {
            client.release();
        }
    });
});