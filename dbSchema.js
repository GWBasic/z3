const fs = require('fs-extra');

const dbConnector = require('./dbConnector');
const runtimeOptions = require('./runtimeOptions');
const sessionConfigGenerator = require('./sessionConfigGenerator');

const SCHEMA_VERSION = 2;

// To dump the schema:
// cd /Applications/Postgres.app/Contents/Versions/12/bin
// ./pg_dump -s -x -O z3 > ~/git/z3/schema.pgsql

// To clear the schema:
// drop schema public cascade; CREATE SCHEMA public AUTHORIZATION postgres; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public; COMMENT ON SCHEMA public IS 'standard public schema';

async function setupSchema() {
    const client = await dbConnector.connect();

    try {
        await client.query('BEGIN');

        try {

            const doesSchemaVersionTableExistResult = await client.query("SELECT to_regclass('schema_version');");

            const exists = (doesSchemaVersionTableExistResult.rows[0].to_regclass == 'schema_version');

            if (!exists) {
                const schema = (await fs.readFile('./schema.pgsql')).toString();
                await client.query(schema);

                await client.query(
                    "INSERT INTO public.schema_version (version) VALUES ($1)",
                    [SCHEMA_VERSION]);

                await client.query(
                    "INSERT INTO public.configurations (name, obj) VALUES ('config', $1)",
                    [ runtimeOptions.defaults.config ]);

                if (!runtimeOptions.defaults.session.secret) {
                    runtimeOptions.defaults.session.secret = sessionConfigGenerator.generateSecret();
                }

                await client.query(
                    "INSERT INTO public.configurations (name, obj) VALUES ('session', $1)",
                    [ runtimeOptions.defaults.session ]);
                
            } else {
                const schemaVersionResult = await client.query("SELECT version FROM schema_version");

                if (schemaVersionResult.rowCount != 1) {
                    throw new Error('No schema version');
                }

                var schemaVersion = schemaVersionResult.rows[0].version;

                if (schemaVersion == 1) {
                    await client.query(
                        "ALTER TABLE public.posts ADD COLUMN preview_password character varying;");

                    await client.query(
                        "UPDATE public.schema_version SET version=2");

                    schemaVersion = 2;
                }

                if (SCHEMA_VERSION != schemaVersion) {
                    throw new Error(`Unsupported schema version: ${schemaVersion}`);
                }
            }
            
            await client.query('COMMIT');
        } catch (err) {
            console.error(`Can not startup the schema: ${err}`);
            
            await client.query('ROLLBACK');
            throw err;
        }
    } catch (err) {
        console.error(`Can not startup the schema: ${err}`);
        throw err;
    } finally {
        client.end();
    }
}

module.exports = {
    setupSchema
};