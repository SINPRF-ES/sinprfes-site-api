const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function verify() {
  const client = await pool.connect();
  try {
    console.log('Verifying migration v34...');

    // 1. Check if 'informes' table exists
    const { rows: tableRows } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'informes'
      );
    `);
    const informesExists = tableRows[0].exists;
    console.log(`- Table 'informes' exists: ${informesExists}`);

    if (!informesExists) throw new Error("Table 'informes' NOT found!");

    // 2. Check if 'audiencia' column was removed from 'noticias'
    const { rows: colRows } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'noticias' AND column_name = 'audiencia'
      );
    `);
    const audienciaExists = colRows[0].exists;
    console.log(`- Column 'audiencia' exists in 'noticias': ${audienciaExists}`);

    if (audienciaExists) throw new Error("Column 'audiencia' still exists in 'noticias'!");

    // 3. Count records in informes
    const { rows: countRows } = await client.query('SELECT COUNT(*) FROM informes');
    console.log(`- Total records in 'informes': ${countRows[0].count}`);

    console.log('Verification completed successfully!');
  } catch (err) {
    console.error('Verification failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verify();
