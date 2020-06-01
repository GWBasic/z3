const dbConnector = require('./dbConnector');
const format = require('pg-format');

const channel = 'config_updates';

var isSubscribed = false;
var cachedValues = {};

module.exports = {
    // Use to resolve a promise for an update event
    callOnEvent: null,

    get: async name => {
        if (!isSubscribed) {
            const client = await dbConnector.connect();

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
                messageJSON => {
                    const message = JSON.parse(messageJSON);
                    cachedValues[message.name] = message.value;

                    if (module.exports.callOnEvent) {
                        module.exports.callOnEvent();
                    }
                },
                () => {
                    isSubscribed = false;
                    cachedValues = {};

                    if (module.exports.callOnEvent) {
                        module.exports.callOnEvent();
                    }
                });

            isSubscribed = true;
        }

        if (name in cachedValues) {
            return cachedValues[name];
        } else {
            return null;
        }
    },

    set: async (name, value) => {
        const client = await dbConnector.connect();

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

                const message = { name, value };
                const messageJSON = JSON.stringify(message);

                await client.query(`NOTIFY ${format.ident(channel)}, ${format.literal(messageJSON)}`);
        
                await client.query('COMMIT');    
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        } finally {
            client.release();
        }
    },

    getConfig: async () => await module.exports.get('config'),
    setConfig: async config => await module.exports.set('config', config)
}