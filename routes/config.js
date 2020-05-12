const createError = require('http-errors');
const express = require('express');
const SafeRouter = require('../SafeRouter');

const safeRouter = new SafeRouter(express);

const db = require('../db');
const z3 = require('../z3');

safeRouter.get('/', z3.checkIsAuthenticated(async (req, res, next) => {
    res.render('config');
}));

safeRouter.post('/', z3.checkIsAuthenticated(async (req, res, next) => {
    z3.config.title = req.body.title;
    z3.config.author = req.body.author;
    z3.config.private = req.body.private ? true : false;
    
    z3.config.z3_cr_in_footer = req.body.z3_cr_in_footer ? true : false;

    await z3.saveConfig();

    res.redirect('/config');
}));


module.exports = safeRouter.router;
