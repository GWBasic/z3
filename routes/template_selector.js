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
    const linkPathPrefix = path.join(dirname, 'public');

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
    await scanFolder(path.join(dirname, 'public', 'templates', 'custom'), templates, linkPathPrefix);

    isBuiltIn = true;
    await scanFolder(path.join(dirname, 'public', 'templates', 'built-in'), templates, linkPathPrefix);

    res.render('template_selector', {
        templates
    });
}));

safeRouter.get('/*', z3.checkIsAuthenticated(async (req, res) => {
    linkPath = req.url;
    const fullPath = path.join(dirname, 'public', linkPath);
    res.render('template_preview', {
        overrideTemplate: true,
        linkPath,
        fullPath,
        shortName: path.basename(fullPath, '.css')
    });
}));

module.exports = safeRouter.router;

