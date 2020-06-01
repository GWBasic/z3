module.exports = {
    publicFolder: 'public',

    // TODO: Get rid of this
    db: {
        location: 'data'
    },

    // TODO: Get rid of this
    authentication: {
        // TODO: Move to defaults
        defaultSessionConfig: {
            cookieName: 'session',
            duration: 30 * 24 * 60 * 60 * 1000, // Sessions last 30 days
            activeDuration: 5 * 60 * 1000,
            cookie: {
                ephemeral: true, // when true, cookie expires when the browser closes
                httpOnly: true, // when true, cookie is not accessible from javascript
                secure: true,
            }}
    },

    defaults: {
        config: {
            title: '',
            author: '',
            private: true,
            z3_cr_in_footer: true,
            template: null,
            overrideTemplate: null,
            headHtml: '',
            footerHtml: '',
            searchUrl: '',
            forceDomain: '',
            forceHttps: false,
            redirects: {}
        },

        session: {
            cookieName: 'session',
            duration: 30 * 24 * 60 * 60 * 1000, // Sessions last 30 days
            activeDuration: 5 * 60 * 1000,
            cookie: {
                ephemeral: true, // when true, cookie expires when the browser closes
                httpOnly: true, // when true, cookie is not accessible from javascript
                secure: true,
            }}
    }
};