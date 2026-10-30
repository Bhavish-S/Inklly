import { parentPort, workerData } from 'node:worker_threads';
import { Client } from 'pg';

if (!parentPort) {
  throw new Error('pg-worker must be executed inside a worker thread.');
}

const { sharedBuffer, connectionString, sslRejectUnauthorized } = workerData;
const signalArray = new Int32Array(sharedBuffer, 0, 4);
const dataBytes = new Uint8Array(sharedBuffer, 16);

// Allow disabling SSL for local database connections or when sslmode=disable is explicit
const isLocal =
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1');

const sslDisabled = /[?&]sslmode=disable\b/i.test(connectionString);

// By default, allow connecting to cloud-hosted databases (Supabase, Render PostgreSQL,
// AWS RDS) whose certificate chains include intermediate/private CAs not bundled in
// Node's default root store. Strict verification can be enforced by setting
// DATABASE_SSL_REJECT_UNAUTHORIZED=true.
const rejectUnauthorized =
  sslRejectUnauthorized === true ||
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';

const ssl = isLocal || sslDisabled ? false : { rejectUnauthorized };

const client = new Client({
  connectionString,
  ssl,
});

client.connect()
  .then(() => {
    // Signal readiness: 99 = READY
    Atomics.store(signalArray, 0, 99);
    Atomics.notify(signalArray, 0);

    parentPort!.on('message', async (msg) => {
      if (msg === 'EXECUTE') {
        const len = signalArray[1];
        const reqStr = Buffer.from(dataBytes.buffer, 16, len).toString('utf-8');
        const { sql, params } = JSON.parse(reqStr);

        try {
          // Convert SQLite '?' parameter placeholders to PostgreSQL '$1', '$2', ...
          let idx = 1;
          const pgSql = sql.replace(/\?/g, () => '$' + idx++);
          const res = await client.query(pgSql, params);
          const resBytes = Buffer.from(JSON.stringify(res.rows || []), 'utf-8');
          signalArray[1] = resBytes.length;
          dataBytes.set(resBytes, 0);
          Atomics.store(signalArray, 0, 2); // 2 = SUCCESS
        } catch (err: any) {
          const errBytes = Buffer.from(err.message || 'Database error occurred', 'utf-8');
          signalArray[1] = errBytes.length;
          dataBytes.set(errBytes, 0);
          Atomics.store(signalArray, 0, 3); // 3 = ERROR
        }

        Atomics.notify(signalArray, 0);
      }
    });
  })
  .catch((err: any) => {
    const errBytes = Buffer.from(err.message || 'Connection failed', 'utf-8');
    signalArray[1] = errBytes.length;
    dataBytes.set(errBytes, 0);
    Atomics.store(signalArray, 0, 98); // 98 = INIT_ERROR
    Atomics.notify(signalArray, 0);
  });
