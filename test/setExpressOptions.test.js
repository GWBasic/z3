"use strict";

const assert  = require('chai').assert;

const setExpressOptions = require('../setExpressOptions');

describe('Set Express Options from environment variables', () => {

    beforeEach(() => {
        delete process.env.EXPRESS_ENABLE;
        delete process.env.EXPRESS_DISABLE;
    });

    afterEach(() => {
        delete process.env.EXPRESS_ENABLE;
        delete process.env.EXPRESS_DISABLE;
    });
    
    it('No options configured', () => {
        setExpressOptions({});
    });
    
    it('Empty options configured', () => {
        process.env.EXPRESS_ENABLE = '';
        process.env.EXPRESS_DISABLE = '';

        setExpressOptions({});
    });
    
    it('Options configured', () => {
        process.env.EXPRESS_ENABLE = 'e1, e2 , e3   ';
        process.env.EXPRESS_DISABLE = 'd1,d2 , d3 , d4';

        const enabled = [];
        const disabled = [];

        const app = {
            enable: o => enabled.push(o),
            disable: o => disabled.push(o)
        }

        setExpressOptions(app);

        assert.deepEqual(enabled, ['e1', 'e2', 'e3'], 'Wrong values enabled');
        assert.deepEqual(disabled, ['d1', 'd2', 'd3', 'd4'], 'Wrong values enabled');
    });
});