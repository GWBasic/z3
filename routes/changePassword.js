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
        correctPassword = (currentPassword == process.env.DEFAULT_PASSWORD);
    } else {
        correctPassword = await z3.checkPassword(currentPassword);
    }

    if (correctPassword) {
        const newPassword = req.body.newPassword;

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
        res.status(401);
        res.render('changePassword', {
            wrongPassword: true
        });
    }
});
    
module.exports = router;