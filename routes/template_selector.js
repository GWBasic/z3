const createError = require('http-errors');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const runtimeOptions = require('../runtimeOptions');
const SafeRouter = require('../SafeRouter');

const safeRouter = new SafeRouter(express);

const db = require('../db');
const z3 = require('../z3');

const dirname = path.dirname(__dirname);

safeRouter.get('/', z3.checkIsAuthenticated(async (req, res) => {
    const dirname = path.dirname(__dirname);
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
}));

safeRouter.get('/*', z3.checkIsAuthenticated(async (req, res) => {
    const linkPath = req.url;
    const fullPath = path.join(dirname, 'public', linkPath);
    res.render('template_preview', {
        overrideTemplate: true,
        linkPath,
        fullPath,
        shortName: path.basename(fullPath, '.css')
    });
}));

safeRouter.post('/', z3.checkIsAuthenticated(async (req, res) => {

    z3.config.template = req.body.template;
    await z3.saveConfig();

    res.redirect('/config');
}));

module.exports = safeRouter.router;

