const bodyParser = require('body-parser')
const fs = require('fs').promises;
const path = require('path');
const pogon = require('pogon.html');
const pngToIco = require('png-to-ico');
const router = require('express-promise-router')();
const sharp = require('sharp');

const runtimeOptions = require('../runtimeOptions');

const cachedConfigurationValues = require('../cachedConfigurationValues');
const z3 = require('../z3');

const dirname = path.dirname(__dirname);

router.all('/*', z3.checkIsAuthenticated);

router.get('/', async (req, res) => {
    const linkPathPrefix = path.join(dirname, runtimeOptions.publicFolder);

    const templates = [];

    async function scanFolder(folderToScan, templates, linkPathPrefix, isBuiltIn) {
        var exists;
        try {
            await fs.access(folderToScan);
            exists = true;
        } catch (error) {
            exists = false;
        }

        if (exists) {
            const files = await fs.readdir(folderToScan);
            for (var file of files) {
                if (path.extname(file) == '.css') {
                    const fullPath = path.join(folderToScan, file);
                    templates.push({
                        isBuiltIn,
                        fullPath,
                        shortName: path.basename(fullPath, '.css'),
                        linkPath: fullPath.substring(linkPathPrefix.length + 1)
                    });
                }
            }
        }
    }

    await scanFolder(path.join(dirname, runtimeOptions.publicFolder, 'templates', 'custom'), templates, linkPathPrefix, false);
    await scanFolder(path.join(dirname, runtimeOptions.publicFolder, 'templates', 'built-in'), templates, linkPathPrefix, true);

    const isAvatarConfigured = (await cachedConfigurationValues.getAvatar()) != null;

    const config = await cachedConfigurationValues.getConfig();

    res.render('config', {
        isAvatarConfigured,
        templates,
        configuredTemplate: config.template,
        redirects: JSON.stringify(config.redirects, null, 2),
        defaultSearchUrl: z3.DEFAULT_SEARCH_URL
    });
});

router.get('/*', async (req, res) => {
    const linkPath = req.url;
    const fullPath = path.join(dirname, runtimeOptions.publicFolder, linkPath);
    res.render('template_preview', {
        overrideTemplate: true,
        linkPath,
        fullPath,
        shortName: path.basename(fullPath, '.css')
    });
});

router.post('/', async (req, res) => {
    const config = await cachedConfigurationValues.getConfig();

    config.title = req.body.title;
    config.author = req.body.author;
    config.template = req.body.template;

    config.private = req.body.publish ? false : true;
    
    config.z3_cr_in_footer = req.body.z3_cr_in_footer ? true : false;

    if (req.body.overrideTemplate) {
        if (req.body.overrideTemplate.length > 0) {
            config.overrideTemplate = req.body.overrideTemplate;
        } else {
            config.overrideTemplate = null;
        }
    } else {
        config.overrideTemplate = null;
    }

    config.headHtml = req.body.headHtml;
    config.footerHtml = req.body.footerHtml;
    config.searchUrl = req.body.searchUrl;
    config.forceDomain = req.body.forceDomain;
    config.forceHttps = req.body.forceHttps ? true : false;
    config.redirects = JSON.parse(req.body.redirects || '{}');

    pogon.defaultTemplate = config.overrideTemplate;

    await cachedConfigurationValues.setConfig(config);

    res.locals.config = await cachedConfigurationValues.getConfig();;
    res.redirect('/config');
});

const rawParser = bodyParser.raw({
    type: 'image/png',
    limit: '1024kb'
});

router.put('/avatar', rawParser, async (req, res) => {
    const avatar = req.body;

    // Write the avatar (240x240)
    const avatarWebp = await sharp(avatar)
        .resize({width: 240, height: 240})
        .toBuffer();

    const avatarPng = await sharp(avatar)
        .resize({width: 240, height: 240})
        .toBuffer();

    // Generate all the favicons
    const androidChrome192 = await sharp(avatar)
        .resize({width: 192, height: 192})
        .toBuffer();

    const androidChrome512 = await sharp(avatar)
        .resize({width: 512, height: 512})
        .toBuffer();

    const appleTouchIcon = await sharp(avatar)
        .resize({width: 180, height: 180})
        .toBuffer();

    const favicon16 = await sharp(avatar)
        .resize({width: 16, height: 16})
        .toBuffer();

    const favicon32 = await sharp(avatar)
        .resize({width: 32, height: 32})
        .toBuffer();

    const favicon = await pngToIco(avatar);

    const avatarValues = {
        avatar: avatar.toString('base64'),
        avatarWebp: avatarWebp.toString('base64'),
        avatarPng: avatarPng.toString('base64'),
        androidChrome192: androidChrome192.toString('base64'),
        androidChrome512: androidChrome512.toString('base64'),
        appleTouchIcon: appleTouchIcon.toString('base64'),
        favicon16: favicon16.toString('base64'),
        favicon32: favicon32.toString('base64'),
        favicon: favicon.toString('base64'),
    };

    await cachedConfigurationValues.setAvatar(avatarValues);

    res.status(201);
    res.end();
});

module.exports = router;
