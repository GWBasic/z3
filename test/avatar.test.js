const testSetup = require('./testSetup');

const chai = require('chai');
const chaiFiles = require('chai-files');
const fs = require('fs').promises;

const cachedConfigurationValues = require('../cachedConfigurationValues');
const db = require('../db');
const z3 = require('../z3');

const server = testSetup.server;
const assert = chai.assert;

chai.use(chaiFiles);

const expect = chai.expect;
const file = chaiFiles.file;

describe('Avatars', () => {

    before(() => {});

    after(() => {});

    beforeEach(async () => {
        await testSetup.beforeEach();

        const img1Data = await fs.readFile('test/data/avatar.png');
        await testSetup.login();

        await testSetup.server
            .put('/config/avatar')
            .set('Content-type', 'image/png')
            .send(img1Data)
            .expect(201);
    });

    afterEach(testSetup.afterEach);

    async function testAvatar(url, imageValue, mimeType) {
        const expectedImageBase64 = (await cachedConfigurationValues.getAvatar())[imageValue];
        const expectedImage = Buffer.from(expectedImageBase64, 'base64');

        const response = await testSetup.server
            .get(url)
            .expect(200)
            .set('Content-type', mimeType);

        assert.isTrue(expectedImage.equals(response.body), 'Wrong contents sent');
    }

    it('favicon', async () => {
        await testAvatar('/favicon.ico', 'favicon', 'image/x-icon');
    });

    it('avatarWebp', async () => {
        await testAvatar('/images/avatar.webp', 'avatarWebp', 'image/webp');
    });

    it('avatarPng', async () => {
        await testAvatar('/images/avatar.png', 'avatarPng', 'image/png');
    });

    it('androidChrome192', async () => {
        await testAvatar('/android-chrome-192x192.png', 'androidChrome192', 'image/png');
    });

    it('androidChrome512', async () => {
        await testAvatar('/android-chrome-512x512.png', 'androidChrome512', 'image/png');
    });

    it('appleTouchIcon', async () => {
        await testAvatar('/apple-touch-icon.png', 'appleTouchIcon', 'image/png');
    });

    it('favicon16', async () => {
        await testAvatar('/favicon-16x16.png', 'favicon16', 'image/png');
    });

    it('favicon32', async () => {
        await testAvatar('/favicon-32x32.png', 'favicon32', 'image/png');
    });
});