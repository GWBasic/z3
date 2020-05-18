const createError = require('http-errors');
const bodyParser = require('body-parser')
const express = require('express');
const fs = require('fs').promises;
const pngToIco = require('png-to-ico');
const sharp = require('sharp');

const runtimeOptions = require('../runtimeOptions');
const SafeRouter = require('../SafeRouter');

const safeRouter = new SafeRouter(express);

const db = require('../db');
const z3 = require('../z3');

safeRouter.get('/', z3.checkIsAuthenticated(async (req, res) => {
    res.render('config');
}));

safeRouter.post('/', z3.checkIsAuthenticated(async (req, res) => {
    z3.config.title = req.body.title;
    z3.config.author = req.body.author;
    z3.config.private = req.body.private ? true : false;
    
    z3.config.z3_cr_in_footer = req.body.z3_cr_in_footer ? true : false;

    await z3.saveConfig();

    res.redirect('/config');
}));

const rawParser = bodyParser.raw({
    type: 'image/png',
    limit: '300kb'
});

safeRouter.put('/avatar', z3.checkIsAuthenticated(), rawParser, async (req, res) => {
    const avatarImageBuffer = req.body;

    // Write the avatar
    await fs.writeFile(`./${runtimeOptions.publicFolder}/images/avatar.png`, avatarImageBuffer);

    await sharp(avatarImageBuffer)
        .toFile(`./${runtimeOptions.publicFolder}/images/avatar.webp`);

    await sharp(avatarImageBuffer)
        .resize({width: 192, height: 192})
        .toFile(`./${runtimeOptions.publicFolder}/android-chrome-192x192.png`);

    await sharp(avatarImageBuffer)
        .resize({width: 512, height: 512})
        .toFile(`./${runtimeOptions.publicFolder}/android-chrome-512x512.png`);

    await sharp(avatarImageBuffer)
        .resize({width: 180, height: 180})
        .toFile(`./${runtimeOptions.publicFolder}/apple-touch-icon.png`);

    await sharp(avatarImageBuffer)
        .resize({width: 16, height: 16})
        .toFile(`./${runtimeOptions.publicFolder}/favicon-16x16.png`);

    await sharp(avatarImageBuffer)
        .resize({width: 32, height: 32})
        .toFile(`./${runtimeOptions.publicFolder}/favicon-32x32.png`);

    const icoBuffer = await pngToIco(avatarImageBuffer);
    await fs.writeFile(`./${runtimeOptions.publicFolder}/favicon.ico`, icoBuffer);

    res.status(201);
    res.end();
});


module.exports = safeRouter.router;
