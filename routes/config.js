const createError = require('http-errors');
const bodyParser = require('body-parser')
const express = require('express');
const fs = require('fs').promises;

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
    const avatarImage = req.body;

    await fs.writeFile('./public/images/avatar.png', avatarImage);

    res.status(201);
    res.end();
});


module.exports = safeRouter.router;
