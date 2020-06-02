const testSetup = require('./testSetup');
const cachedConfigurationValues = require('../cachedConfigurationValues');
const z3 = require('../z3');

const assert  = require('chai').assert;

describe('Login and session handling', () => {

    before(() => {});

    after(() => {});

    beforeEach(testSetup.beforeEach);

    afterEach(testSetup.afterEach);

    it('get login page', async () => {

        await testSetup.logout();

        var result;

        result = await testSetup.server
            .get('/login')
            .expect(200);

        var pageParameters = JSON.parse(result.text);
        assert.equal(pageParameters.options.isLoggedIn, false, 'Wrong isLoggedIn');

        result = await testSetup.server
            .post('/login')
            .send(`password=badpassword`)
            .expect(401);

        var pageParameters = JSON.parse(result.text);
        assert.equal(pageParameters.options.wrongPassword, true, 'Wrong wrongPassword');
        assert.equal(pageParameters.options.isLoggedIn, false, 'Wrong isLoggedIn');

        // Trying to access the dashboard before logging in should fail
        result = await testSetup.server
            .get('/dashboard')
            .expect(401);

        async function testLogin(password) {

            // Log in
            result = await testSetup.server
                .post('/login')
                .send(`password=${password}`)
                .expect(302)
                .expect('Location', '/dashboard');

            // Now the dashboard should work because the session is logged in
            result = await testSetup.server
                .get('/dashboard')
                .expect(200);

            var pageParameters = JSON.parse(result.text);
            assert.equal(pageParameters.options.isLoggedIn, true, 'Wrong isLoggedIn');
        }

        await z3.changePassword(testSetup.passwordInfo.password);

        await testLogin(testSetup.passwordInfo.password);
    });

    it('logout', async () => {
        await testSetup.login();

        const sessionConfig = await cachedConfigurationValues.getSession();

        // Log out
        await testSetup.server
            .post('/login/logout')
            .expect(302)
            .expect('set-cookie', `${sessionConfig.cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`)
            .expect('Location', '/login');

        // Trying to access the dashboard after logging out should fail
        await testSetup.server
            .get('/dashboard')
            .expect(401);
    });

    it('private mode', async () => {
        const config = await cachedConfigurationValues.getConfig();
        config.private = true;
        await cachedConfigurationValues.setConfig(config);

        await testSetup.server
            .get('/dashboard')
            .expect(302)
            .expect('Location', '/login');

        await testSetup.server
            .get('/')
            .expect(302)
            .expect('Location', '/login');

        await testSetup.server
            .get('/login')
            .expect(200);
    });

    it('Login with destination', async () => {
        await testSetup.server
            .post('/login')
            .send(`password=${testSetup.passwordInfo.password}&destination=/newurl`)
            .expect(302)
            .expect('Location', '/newurl');

        // Trying to access the dashboard after logging out should succeed
        await testSetup.server
            .get('/dashboard')
            .expect(200);
    });

    it('Login with destination, bad password', async () => {
        await testSetup.server
            .post('/login')
            .send(`password=badpassword&destination=/newurl`)
            .expect(302)
            .expect('Location', '/newurl');

        // Trying to access the dashboard after logging out should fail
        await testSetup.server
            .get('/dashboard')
            .expect(401);
    });
});