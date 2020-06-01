const runtimeOptions = require('../runtimeOptions');
const sessionConfigPromise = require('../sessionConfig')
const router = require('express-promise-router')();
const z3 = require('../z3');

router.get('/', async (req, res) => {
    res.render('login');
});

router.post('/', async (req, res, next) => {
    const password = req.body.password;
    const verified = await z3.checkPassword(password);

    if (verified) {
        req.session.isLoggedIn = true;

        const destination = req.body.destination || '/dashboard';

        res.redirect(destination);
    } else {
        res.clearCookie(runtimeOptions.authentication.cookieName);

        if (req.body.destination) {
            res.redirect(req.body.destination);
        } else {
            res.status(401);

            res.render('login', {
                wrongPassword: true
            });
        }
    }
});

router.post('/logout', async (req, res) => {
    const sessionConfig = await sessionConfigPromise;

    res.clearCookie(sessionConfig.cookieName);
    res.redirect('/login');
});
    
module.exports = router;
