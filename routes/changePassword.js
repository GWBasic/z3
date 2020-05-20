const runtimeOptions = require('../runtimeOptions');
const sessionConfig = require('../sessionConfig')
const z3 = require('../z3');

const express = require('express');
const fs = require('fs').promises;

const SafeRouter = require('../SafeRouter');

const safeRouter = new SafeRouter(express);

safeRouter.get('/', z3.checkIsAuthenticated(async (req, res) => {
    res.render('changePassword');
}));

safeRouter.post('/', z3.checkIsAuthenticated(async(req, res) => {
    const currentPassword = req.body.currentPassword;

    const correctPassword = await z3.checkPassword(currentPassword);

    if (correctPassword) {
        const newPassword = req.body.newPassword;
        const passwordAndHash = await z3.generatePasswordAndHash(newPassword);

        const passwordAndHashJSON = JSON.stringify(passwordAndHash);

        await fs.writeFile(runtimeOptions.authentication.passwordFile, passwordAndHashJSON);

        res.render('changePassword', {
            passwordUpdated: true
        });
    } else {
        res.status(401);
        res.render('changePassword', {
            wrongPassword: true
        });
    }
}));
    
module.exports = safeRouter.router;