const testSetup = require('./testSetup');
const sessionConfig = require('../sessionConfig');
const z3 = require('../z3');

const assert  = require('chai').assert;
const fs = require('fs').promises;

const server = testSetup.server;


describe('Login and session handling', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('get login page', async () => {

        await testSetup.logout();
        await testSetup.deletePassword();

        const password = 'sgrgsfdgsfdgfsd';

        var result;

        async function verifyLogin(isPasswordConfigured) {
            result = await server
                .get('/login')
                .expect(200);

            var pageParameters = JSON.parse(result.text);
            assert.equal(pageParameters.options.isPasswordConfigured, isPasswordConfigured, 'Wrong isPasswordConfigured');
            assert.equal(pageParameters.options.isLoggedIn, false, 'Wrong isLoggedIn');
        }

        await verifyLogin(false);

        result = await server
            .post('/login/generatePassword')
            .send(`password=${password}`)
            .expect('Content-Type', /json/)
            .expect('Content-Disposition', 'attachment; filename="password.json"')
            .expect(200);

        var hashAndSaltText = result.text;
        var hashAndSalt = JSON.parse(hashAndSaltText);

        assert.isTrue(hashAndSalt.startsWith('pbkdf2'));

        await fs.writeFile(testSetup.runtimeOptions.authentication.passwordFile, hashAndSaltText);

        await verifyLogin(true);

        result = await server
            .post('/login')
            .send(`password=badpassword`)
            .expect(401);

        var pageParameters = JSON.parse(result.text);
        assert.equal(pageParameters.options.isPasswordConfigured, true, 'Wrong isPasswordConfigured');
        assert.equal(pageParameters.options.wrongPassword, true, 'Wrong wrongPassword');
        assert.equal(pageParameters.options.isLoggedIn, false, 'Wrong isLoggedIn');

        // Trying to access the dashboard before logging in should fail
        result = await server
            .get('/dashboard')
            .expect(401);

        // Log in
        result = await server
            .post('/login')
            .send(`password=${password}`)
            .expect(302)
            .expect('Location', '/dashboard');

        // Now the dashboard should work because the session is logged in
        result = await server
            .get('/dashboard')
            .expect(200);

        var pageParameters = JSON.parse(result.text);
        assert.equal(pageParameters.options.isLoggedIn, true, 'Wrong isLoggedIn');
    });

    it('logout', async () => {
        await testSetup.login();

        // Log out
        await server
            .post('/login/logout')
            .expect(302)
            .expect('set-cookie', `${sessionConfig.cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`)
            .expect('Location', '/login');

        // Trying to access the dashboard after logging out should fail
        await server
            .get('/dashboard')
            .expect(401);
    });

    it('private mode', async () => {
        z3.config.private = true;

        await server
            .get('/dashboard')
            .expect(302)
            .expect('Location', '/login');

        await server
            .get('/')
            .expect(302)
            .expect('Location', '/login');

        await server
            .get('/login')
            .expect(200);
    });
});