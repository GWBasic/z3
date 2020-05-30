module.exports = {
    publicFolder: 'public',

    db: {
        location: 'data'
    },

    authentication: {
        sessionConfigFile: 'session.json',
        defaultSessionConfig: {
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