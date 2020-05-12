const createError = require('http-errors');

const methods = require('methods');

module.exports = class SafeRouter {
    constructor(express) {
        this.router = express.Router();

        function filter(callback) {
            return async (req, res, next, ...args) => {
                try {
                    await callback(req, res, next, ...args);
                } catch (err) {
                    next(err);
                }
            };
        }
    
        for (const method of methods) {
            this[method] = (path, ...callbacks) => {

                for (var ctr = 0; ctr < callbacks.length; ctr++) {
                    callbacks[ctr] = filter(callbacks[ctr]);
                }

                return this.router[method](path, callbacks);
            };
        }    
    }

    param(name, callback) {
        function filterParam(callback) {
            return async (req, res, next, ...args) => {
                try {
                    await callback(req, res, next, ...args);
                    next();
                } catch (err) {
                    next(err);
                }
            };
        }

        return this.router.param(name, filterParam(callback));
    }
}