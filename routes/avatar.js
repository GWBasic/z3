const router = require('express-promise-router')();

const cachedConfigurationValues = require('../cachedConfigurationValues');

async function serveImage(imageValue, mimeType, res, next) {
    const avatarValues = await cachedConfigurationValues.getAvatar();

    if (!avatarValues) {
        next();
        return;
    }

    const imageBase64 = avatarValues[imageValue];
    if (!imageBase64) {
        next();
        return;
    }

    const buffer = Buffer.from(imageBase64, 'base64');
    res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=300'
    });

    res.end(buffer);
}

router.get('/favicon.ico', async (req, res, next) => {
    await serveImage('favicon', 'image/x-icon', res, next);
});

router.get('/images/avatar.webp', async (req, res, next) => {
    await serveImage('avatarWebp', 'image/webp', res, next);
});

router.get('/images/avatar.png', async (req, res, next) => {
    await serveImage('avatarPng', 'image/png', res, next);
});

router.get('/android-chrome-192x192.png', async (req, res, next) => {
    await serveImage('androidChrome192', 'image/png', res, next);
});

router.get('/android-chrome-512x512.png', async (req, res, next) => {
    await serveImage('androidChrome512', 'image/png', res, next);
});

router.get('/apple-touch-icon.png', async (req, res, next) => {
    await serveImage('appleTouchIcon', 'image/png', res, next);
});

router.get('/favicon-16x16.png', async (req, res, next) => {
    await serveImage('favicon16', 'image/png', res, next);
});

router.get('/favicon-32x32.png', async (req, res, next) => {
    await serveImage('favicon32', 'image/png', res, next);
});

module.exports = router;
