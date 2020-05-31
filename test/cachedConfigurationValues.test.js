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
        var value;

        // No value should be configured
        value = await cachedConfigurationValues.get(name);
        assert.isNull(value, 'Value should not be configured');

        // Wait until the event comes before re-reading the value
        var waitForEvent;
        waitForEvent = new Promise((resolve, reject) => {
            cachedConfigurationValues.callOnEvent = () => {
                resolve();
                cachedConfigurationValues.callOnEvent = null;
            }
        });

        await cachedConfigurationValues.set(name, expectedValue);
        await waitForEvent;

        value = await cachedConfigurationValues.get(name);
        assert.deepEqual(value, expectedValue, 'Value not updated via an event')

        waitForEvent = new Promise((resolve, reject) => {
            cachedConfigurationValues.callOnEvent = () => {
                resolve();
                cachedConfigurationValues.callOnEvent = null;
            }
        });

        dbConnector.end();
        await waitForEvent;

        value = await cachedConfigurationValues.get(name);
        assert.deepEqual(value, expectedValue, 'Value not updated via reconnect')
    });
});