const { Client, Pool } = require('pg');
const format = require('pg-format');

const connectionString = process.env.DATABASE_URL;
const disableSSL = process.env.DISABLE_SSL != null

var pool = null;
var clients = [];

const connectionArguments = {
    connectionString: connectionString
}

if (!disableSSL) {
    connectionArguments.ssl = {
        rejectUnauthorized: false
    }
}

module.exports = {
    connectToPool: async () => {
        if (pool == null) {
            pool = new Pool(connectionArguments);
        }

        return await pool.connect();
    },

    connect: async () => {
        const client = new Client(connectionArguments);
        await client.connect();

        return client;
    },

    listen: async (channel, callback, done) => {
        var client = new Client(connectionString);
        await client.connect();
        await client.query(`LISTEN ${format.ident(channel)}`);

        client.on('notification', data => {
            callback(data.payload);
        });

        if (done) {
            client.on('end', done);
        }

        clients.push(client);
    },

    end: async () => {
        if (pool) {
            pool.end();
        }

        pool = null;

        for (var client of clients) {
            client.end();
        }

        clients = [];
    }
};

process.on("exit", () => {
    module.exports.end();
});