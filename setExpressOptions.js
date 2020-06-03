module.exports = function(app) {
    const enabledCS = process.env.EXPRESS_ENABLE || '';
    const disabledCS = process.env.EXPRESS_DISABLE || '';

    for (var enable of enabledCS.split(',')) {
        enable = enable.trim();

        if (enable.length > 0) {
            app.enable(enable);
        }
    }

    for (var disable of disabledCS.split(',')) {
        disable = disable.trim();

        if (disable.length > 0) {
            app.disable(disable);
        }
    }
}