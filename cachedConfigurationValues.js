const dbConnector = require('./dbConnector');
const format = require('pg-format');

const channel = 'config_updates';

var cachedValues = {};

var connectingPromise = null;

async function update(name) {
    const client = await dbConnector.connectToPool();

    try {
        const selectConfigurationResult = await client.query(
            "SELECT obj FROM configurations WHERE name=$1;",
            [name]);

        if (selectConfigurationResult.rowCount > 0) {
            cachedValues[name] = selectConfigurationResult.rows[0].obj;
        } else {
            delete cachedValues[name];
        }
    } finally {
        client.release();
    }
}

async function connect() {
    try {
        const client = await dbConnector.connectToPool();

        try {
            const selectConfigurationResult = await client.query("SELECT * FROM configurations;");

            for (var row of selectConfigurationResult.rows) {
                cachedValues[row.name] = row.obj;
            }
        } finally {
            client.release();
        }

        await dbConnector.listen(
            channel,
            async name => {
                try {
                    await update(name);

                    if (module.exports.callOnEvent) {
                        module.exports.callOnEvent();
                    }
                } catch (err) {
                    console.error(`Problem handling event for ${name}, :${err}`);
                }
            },
            () => {
                connectingPromise = null;
                cachedValues = {};

                if (module.exports.callOnEvent) {
                    module.exports.callOnEvent();
                }
            });
    } catch (err) {
        connectingPromise = null;
        throw err;
    }
}

async function ensureConnected() {
    if (null == connectingPromise) {
        connectingPromise = connect();
    }

    await connectingPromise;
}

async function get (name) {
    await ensureConnected();

    if (name in cachedValues) {
        return cachedValues[name];
    } else {
        return null;
    }
}

async function set (name, value) {
    const client = await dbConnector.connectToPool();

    try {
        await client.query('BEGIN');

        try {
            const upsertConfigurationResult = await client.query(
                "INSERT INTO configurations (name, obj) VALUES ($1, $2)" +
                "ON CONFLICT (name) DO UPDATE SET obj=$2 WHERE configurations.name=$1",
                [name, value]);
        
            if (upsertConfigurationResult.rowCount != 1) {
                throw new Error(`Can not upsert ${name} into configurations`);
            }
    
            await client.query('COMMIT');    
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
    } finally {
        client.release();
    }

    cachedValues[name] = value;
}

module.exports = {
    // Use to resolve a promise for an update event
    callOnEvent: null,

    ensureConnected,
    get,
    set,

    getConfig: async () => await module.exports.get('config'),
    setConfig: async config => await module.exports.set('config', config),

    getSession: async () => await module.exports.get('session'),
    setSession: async config => await module.exports.set('session', config),

    getPassword: async () => await module.exports.get('password'),
    setPassword: async config => await module.exports.set('password', config),

    getAvatar: async () => await module.exports.get('avatar'),
    setAvatar: async config => await module.exports.set('avatar', config)
}