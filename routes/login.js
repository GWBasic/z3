const runtimeOptions = require('../runtimeOptions');
const sessionConfig = require('../sessionConfig')
const router = require('express-promise-router')();
const z3 = require('../z3');

router.get('/', async (req, res) => {
    const isPasswordConfigured = await z3.isPasswordConfigured();

    res.render(
        'login', {
            isPasswordConfigured
        });
});

router.post('/', async (req, res, next) => {
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

router.post('/logout', async (req, res) => {
    res.clearCookie(sessionConfig.cookieName);
    res.redirect('/login');
});

router.post('/generatePassword', async (req, res) => {

    const password = req.body.password;

    const hashAndSalt = await z3.generatePasswordAndHash(password);

    res.attachment('password.json');
    res.json(hashAndSalt);
});
    
module.exports = router;
