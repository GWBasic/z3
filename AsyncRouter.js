'use strict';

// Inspired by https://github.com/express-promise-router/express-promise-router/blob/master/lib/express-promise-router.js

const Router = require('express').Router;
const isPromise = require('is-promise');
const httpMethods = require('methods');

function wrap(toWrap) {
    return (req, res, next, ...args) => {
        const resultOrPromise = toWrap(req, res, next, ...args);

        if (isPromise(resultOrPromise)) {

            // Function returned a promise
            // The function must either call next itself, or return the result
            // Next is automatically called for unhandled errors
            resultOrPromise.then(_ => {}, next);

        } else if (typeof resultOrPromise !== 'undefined') {

            // Function didn't return promise, but return the value back in case express uses it
            return resultOrPromise;
        }
    };
}

function wrapMethods(instanceToWrap, isRoute) {
    var toConcat = isRoute ? ['all'] : ['use', 'all', 'param'];

    var methods = httpMethods.concat(toConcat);

    for (var method of methods) {
        const original = '__' + method;
        const originalFunction = instanceToWrap[method];
        instanceToWrap[original] = originalFunction;

        instanceToWrap[method] = (...args) => {

            for (var argCtr = 0; argCtr < args.length; argCtr++) {
                const argument = args[argCtr];

                if (typeof argument === 'function') {
                    args[argCtr] = wrap(argument);
                }
            }

            return instanceToWrap[original](...args);
        };
    };

    return instanceToWrap;
};

const AsyncRouter = function(path) {
    const me = wrapMethods(new Router(path));

    me.__route = me.route;
    me.route = function(path) {
        return wrapMethods(me.__route(path), true);
    };

    return me;
};

AsyncRouter.default = AsyncRouter;
module.exports = AsyncRouter;