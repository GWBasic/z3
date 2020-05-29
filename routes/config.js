const bodyParser = require('body-parser')
const fs = require('fs').promises;
const fsConstants = require('fs').constants;
const path = require('path');
const pogon = require('pogon.html');
const pngToIco = require('png-to-ico');
const router = require('express-promise-router')();
const sharp = require('sharp');

const runtimeOptions = require('../runtimeOptions');

const z3 = require('../z3');

const dirname = path.dirname(__dirname);

router.all('/*', z3.checkIsAuthenticated);

router.get('/', async (req, res) => {
    const linkPathPrefix = path.join(dirname, runtimeOptions.publicFolder);

    const templates = [];

    var isBuiltIn;

    async function scanFolder(folderToScan, templates, linkPathPrefix) {
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

    isBuiltIn = false;
    await scanFolder(path.join(dirname, runtimeOptions.publicFolder, 'templates', 'custom'), templates, linkPathPrefix);

    isBuiltIn = true;
    await scanFolder(path.join(dirname, runtimeOptions.publicFolder, 'templates', 'built-in'), templates, linkPathPrefix);

    var isAvatarConfigured;

    try {
        await fs.access(path.join(dirname, runtimeOptions.publicFolder, 'favicon.ico'), fsConstants.R_OK);
        isAvatarConfigured = true;
    } catch (ex) {
        isAvatarConfigured = false;
    }

    const config = await z3.getCachedConfig();

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
    await z3.updateConfig(async config => {
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
    });

    res.locals.config = await z3.getCachedConfig();;
    res.redirect('/config');
});

const rawParser = bodyParser.raw({
    type: 'image/png',
    limit: '1024kb'
});

router.put('/avatar', rawParser, async (req, res) => {
    const avatarImageBuffer = req.body;

    // Write the avatar (240x240)
    await sharp(avatarImageBuffer)
        .resize({width: 240, height: 240})
        .toFile(`./${runtimeOptions.publicFolder}/images/avatar.webp`);

    await sharp(avatarImageBuffer)
        .resize({width: 240, height: 240})
        .toFile(`./${runtimeOptions.publicFolder}/images/avatar.png`);

    // Generate all the favicons
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

module.exports = router;
