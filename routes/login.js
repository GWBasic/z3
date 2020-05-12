const runtimeOptions = require('../runtimeOptions');
const sessionConfig = require('../sessionConfig')

const express = require('express');
const fs = require('fs').promises;
const fsConstants = require('fs').constants;
const passwordHashAndSalt = require('password-hash-and-salt');
const promisify = require('util').promisify;

const SafeRouter = require('../SafeRouter');

const safeRouter = new SafeRouter(express);

safeRouter.get('/', async (req, res) => {
    var isPasswordConfigured;

    try {
        await fs.access(runtimeOptions.authentication.passwordFile, fsConstants.R_OK);
        isPasswordConfigured = true;
    } catch (ex) {
        isPasswordConfigured = false;
    }

    res.render(
        'login', {
            isPasswordConfigured: isPasswordConfigured
        });
});

async function verifyAgainst(password, hashAndSalt) {
    const verified = await promisify(callback => passwordHashAndSalt(password).verifyAgainst(hashAndSalt, callback))();
    return verified;
}

safeRouter.post('/', async (req, res, next) => {

    var hashAndSaltData;

    try {
        hashAndSaltData = await fs.readFile(runtimeOptions.authentication.passwordFile);
    } catch {
        res.status(401);
        res.render('login', {
            isPasswordConfigured: false
            });
    }

    const password = req.body.password;
    const hashAndSalt = JSON.parse(hashAndSaltData);

    const verified = await verifyAgainst(password, hashAndSalt);

    if (verified) {
        req.session.isLoggedIn = true;
        res.redirect('/dashboard');
    } else {
        res.clearCookie(runtimeOptions.authentication.cookieName);

        res.status(401);
        res.render('login', {
            isPasswordConfigured: true,
            wrongPassword: true
        });
    }
});

safeRouter.post('/logout', async (req, res) => {
    res.clearCookie(sessionConfig.cookieName);
    res.redirect('/login');
});

async function hash(password) {
    const hashAndSalt = await promisify(callback => passwordHashAndSalt(password).hash(callback))();
    return hashAndSalt;
}

safeRouter.post('/generatePassword', async (req, res) => {

    const password = req.body.password;

    const hashAndSalt = await hash(password);

    res.attachment('password.json');
    res.json(hashAndSalt);
});
    
module.exports = safeRouter.router;
