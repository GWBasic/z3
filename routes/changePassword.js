const createError = require('http-errors');
const router = require('express-promise-router')();

const cachedConfigurationValues = require('../cachedConfigurationValues');
const z3 = require('../z3');

const fs = require('fs').promises;

router.get('/', async (req, res) => {
    const passwordRecord = await cachedConfigurationValues.getPassword();

    res.render('changePassword', {
        changeDefaultPassword: passwordRecord == null
    });
});

router.post('/', async(req, res) => {
    const currentPassword = req.body.currentPassword;
    const passwordRecord = await cachedConfigurationValues.getPassword();

    var correctPassword;
    if (passwordRecord == null) {
        if (process.env.DEFAULT_PASSWORD) {
            correctPassword = (currentPassword == process.env.DEFAULT_PASSWORD);
        } else {
            // process.env.DEFAULT_PASSWORD is undefined
            // This mitigates a potential situation where, if process.env.DEFAULT_PASSWORD isn't set,
            // The password could be changed by just posting without including currentPassword
            throw createError(500, 'Default password is not configured');
        }
    } else {
        correctPassword = await z3.checkPassword(currentPassword);
    }

    if (correctPassword) {
        const newPassword = req.body.newPassword;

        if (newPassword) {
            if (newPassword == process.env.DEFAULT_PASSWORD) {
                res.status(401);
                res.render('changePassword', {
                    defaultPassword: true
                });
            } else {
                await z3.changePassword(newPassword);
                req.session.isLoggedIn = true;

                res.render('changePassword', {
                    passwordUpdated: true
                });
            }
        } else {
            throw createError(400, 'New password unspecified');
        }
    } else {
        res.status(401);
        res.render('changePassword', {
            wrongPassword: true
        });
    }
});
    
module.exports = router;