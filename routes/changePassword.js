const runtimeOptions = require('../runtimeOptions');
const router = require('express-promise-router')();
const z3 = require('../z3');

const fs = require('fs').promises;

router.get('/', z3.checkIsAuthenticated, async (req, res) => {
    res.render('changePassword');
});

router.post('/', z3.checkIsAuthenticated, async(req, res) => {
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
});
    
module.exports = router;