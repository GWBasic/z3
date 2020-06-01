require('use-strict');

const express = require('express');
const cookieParser = require('cookie-parser');
const createError = require('http-errors');
const logger = require('morgan');
const path = require('path');
const pogon = require('pogon.html');
const session = require('client-sessions');

const cachedConfigurationValues = require('./cachedConfigurationValues');
const db = require('./db');
const dbSchema = require('./dbSchema');
const sessionConfigPromise = require('./sessionConfig');
const recentPosts = require('./recentPosts');
const runtimeOptions = require('./runtimeOptions');
const z3 = require('./z3');

const blogRouter = require('./routes/blog');
const changePasswordRouter = require('./routes/changePassword');
const configRouter = require('./routes/config');
const dashboardRouter = require('./routes/dashboard');
const draftsRouter = require('./routes/drafts');
const editRouter = require('./routes/edit');
const indexRouter = require('./routes/index');
const loginRouter = require('./routes/login');
const publishRouter = require('./routes/publish');
const redirectsRouter = require('./routes/redirects');
const searchRouter = require('./routes/search');

async function startApp() {
	await cachedConfigurationValues.ensureConnected();
	
	const app = express();

	const isDevelopment = app.get('env') === 'development';

	// Enable session keys on http in develop mode
	// (Otherwise, they require https only)
	const sessionConfig = await sessionConfigPromise;
	if (isDevelopment) {
		sessionConfig.cookie.secure = false;
	}

	pogon.registerCustomTag('z3_recentPosts', recentPosts);

	app.use(session(sessionConfig));

	// Set up pogon as the view handler
	app.set('views', './views') // specify the views directory
	app.set('view engine', 'pogon.html') // register the template engine

	app.use(logger('dev'));
	app.use(express.json());
	app.use(express.urlencoded({ extended: false }));
	app.use(cookieParser());
	app.use(express.static(path.join(__dirname, runtimeOptions.publicFolder)));

	await dbSchema.setupSchema();

	const config = await cachedConfigurationValues.getConfig();
	pogon.defaultTemplate = config.overrideTemplate;

	app.use(async function(req, res, next) {
		try {
			res.locals.isLoggedIn = false;

			if (req.session) {
				if (req.session.isLoggedIn) {
					res.locals.isLoggedIn = true;
				}
			}

			res.locals.staticPages = await db.getAllStaticPages();

			const config = await cachedConfigurationValues.getConfig();
			res.locals.config = config;

			// Private mode
			if (config.private && !req.session.isLoggedIn) {
				if (req.url != '/login') {
					res.redirect('/login');
					res.end();
					return;
				}
			}

			next();
		} catch (err) {
			next(err);
		}
	});

	// Admin pages do not use domain forcing
	app.use('/changePassword/', changePasswordRouter);
	app.use('/config/', configRouter);
	app.use('/dashboard/', dashboardRouter);
	app.use('/drafts/', draftsRouter);
	app.use('/edit/', editRouter);
	app.use('/login/', loginRouter);
	app.use('/publish/', publishRouter);

	// Globally-readable pages use domain forcing
	app.use('/', redirectsRouter);
	app.use('/blog/', blogRouter);
	app.use('/search/', searchRouter);
	app.use('/', indexRouter);

	// catch 404 and forward to error handler
	app.use((req, res, next) => {
		next(createError(404));
	});

	// error handler
	app.use((err, req, res, next) => {
		if (res.headersSent) {
			return next(err);
		}

		if ((err instanceof db.PostNotFoundError) ||
			(err instanceof db.DraftNotFoundError) ||
			(err instanceof db.ImageNotFoundError)) {
			res.status(404);
			res.render(
				'error', {
					status: 404,
					message: err.message
				});

			return;
		} else if ((err instanceof db.UnknownStaticGroupError) ||
			(err instanceof db.UnknownAfterPageIdError)) {
			res.status(401);
			res.render(
				'error', {
					status: 400,
					message: err.message
				});

			return;
		} else {
			if (!(err.status)) {
				console.error(`Unhandled error ${req.method} ${req.originalUrl}: ${err.stack}`);
			}

			const args = {};
			// set locals, only providing error in development
			args.message = err.message;
			args.error = isDevelopment ? err : {};
			args.status = err.status || 500;
			args.url = req.url;

			const viewFile = err.status == 401 ? '401' : 'error';
			res.status(args.status);
			res.render(viewFile, args);
		}
	});

	return app;
}

module.exports = startApp;
