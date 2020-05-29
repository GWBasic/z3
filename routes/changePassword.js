const runtimeOptions = require('../runtimeOptions');
const router = require('express-promise-router')();
const z3 = require('../z3');

const fs = require('fs').promises;

router.all('/*', z3.checkIsAuthenticated);

router.get('/', async (req, res) => {
    res.render('changePassword');
});

router.post('/', async(req, res) => {
    const currentPassword = req.body.currentPassword;

    const correctPassword = await z3.checkPassword(currentPassword);

    if (correctPassword) {
        const newPassword = req.body.newPassword;
        await z3.changePassword(newPassword);

        res.render('changePassword', {
            passwordUpdated: true
        });
    } else {
        res.status(401);
        res.render('changePassword', {
            wrongPassword: true
        });
    }
});
    
module.exports = router;