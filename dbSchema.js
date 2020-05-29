const fs = require('fs-extra');
const Pool = require('pg').Pool

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({connectionString});

const SCHEMA_VERSION = 1;

// To dump the schema:
// cd /Applications/Postgres.app/Contents/Versions/12/bin
// ./pg_dump -s z3 > ~/git/z3/schema.pgsql

async function setupSchema() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        try {

            const doesSchemaVersionTableExistResult = await client.query("SELECT to_regclass('schema_version');");

            const exists = (doesSchemaVersionTableExistResult.rows[0].to_regclass == 'schema_version');

            if (!exists) {
                const schema = (await fs.readFile('./schema.pgsql')).toString();
                await client.query(schema);
                await client.query(
                    'INSERT INTO public.schema_version (version) VALUES ($1)',
                    [SCHEMA_VERSION]);
            }

            const schemaVersionResult = await client.query("SELECT version FROM schema_version");

            if (schemaVersionResult.rowCount != 1) {
                throw new Error('No schema version');
            }

            const schemaVersion = schemaVersionResult.rows[0].version;

            if (SCHEMA_VERSION != schemaVersion) {
                throw new Error(`Unsupported schema version: ${schemaVersion}`);
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
    } finally {
        client.release();
    }
}

module.exports = {
    setupSchema
};