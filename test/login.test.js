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

        var result;

        result = await server
            .get('/login')
            .expect(200);

        var pageParameters = JSON.parse(result.text);
        assert.equal(pageParameters.options.isLoggedIn, false, 'Wrong isLoggedIn');

        result = await server
            .post('/login')
            .send(`password=badpassword`)
            .expect(401);

        var pageParameters = JSON.parse(result.text);
        assert.equal(pageParameters.options.wrongPassword, true, 'Wrong wrongPassword');
        assert.equal(pageParameters.options.isLoggedIn, false, 'Wrong isLoggedIn');

        // Trying to access the dashboard before logging in should fail
        result = await server
            .get('/dashboard')
            .expect(401);

        async function testLogin(password) {

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
        }

        await testLogin(testSetup.passwordInfo.defaultPassword);

        await testSetup.logout();

        await z3.changePassword(testSetup.passwordInfo.password);

        await testLogin(testSetup.passwordInfo.password);
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
        await z3.updateConfig(config => {
            config.private = true;
        });

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

    it('Login with destination', async () => {
        await server
            .post('/login')
            .send(`password=${testSetup.passwordInfo.password}&destination=/newurl`)
            .expect(302)
            .expect('Location', '/newurl');

        // Trying to access the dashboard after logging out should succeed
        await server
            .get('/dashboard')
            .expect(200);
    });

    it('Login with destination, bad password', async () => {
        await server
            .post('/login')
            .send(`password=badpassword&destination=/newurl`)
            .expect(302)
            .expect('Location', '/newurl');

        // Trying to access the dashboard after logging out should fail
        await server
            .get('/dashboard')
            .expect(401);
    });
});