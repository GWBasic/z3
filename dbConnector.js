const { Client, Pool } = require('pg');
const format = require('pg-format');

const connectionString = process.env.DATABASE_URL;

var pool = null;
var clients = [];

module.exports = {
    connect: async () => {
        if (pool == null) {
            pool = new Pool({connectionString});
        }

        return await pool.connect();
    },

    listen: async (channel, callback, done) => {
        var client = new Client(connectionString);
        await client.connect();
        await client.query(`LISTEN ${format.ident(channel)}`);

        client.on('notification', data => {
            callback(data.payload);
        });

        client.on('end', done);

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