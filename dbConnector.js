const Pool = require('pg').Pool

const connectionString = process.env.DATABASE_URL;

var pool = null;

module.exports = {
    connect: async () => {
        if (pool == null) {
            pool = new Pool({connectionString});
        }

        return await pool.connect();
    },

    end: async () => {
        pool.end();
        pool = null;
    }
};