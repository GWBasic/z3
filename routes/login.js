const runtimeOptions = require('../runtimeOptions');
const sessionConfig = require('../sessionConfig')
const z3 = require('../z3');

const express = require('express');

const SafeRouter = require('../SafeRouter');

const safeRouter = new SafeRouter(express);

safeRouter.get('/', async (req, res) => {
    const isPasswordConfigured = await z3.isPasswordConfigured();

    res.render(
        'login', {
            isPasswordConfigured
        });
});


safeRouter.post('/', async (req, res, next) => {
    const password = req.body.password;
    const verified = await z3.checkPassword(password);

    if (verified) {
        req.session.isLoggedIn = true;

        const destination = req.body.destination || '/dashboard';

        res.redirect(destination);
    } else {
        const isPasswordConfigured = await z3.isPasswordConfigured();
        res.clearCookie(runtimeOptions.authentication.cookieName);

        if (req.body.destination) {
            res.redirect(req.body.destination);
        } else {
            res.status(401);

            res.render('login', {
                isPasswordConfigured,
                wrongPassword: true
            });
        }
    }
});

safeRouter.post('/logout', async (req, res) => {
    res.clearCookie(sessionConfig.cookieName);
    res.redirect('/login');
});

safeRouter.post('/generatePassword', async (req, res) => {

    const password = req.body.password;

    const hashAndSalt = await z3.generatePasswordAndHash(password);

    res.attachment('password.json');
    res.json(hashAndSalt);
});
    
module.exports = safeRouter.router;
