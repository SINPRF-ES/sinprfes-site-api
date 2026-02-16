const pool = require("./src/config/db");

async function check() {
  try {
    const res = await pool.query("SELECT * FROM report_jobs WHERE report_type = 'INDIVIDUAL' ORDER BY created_at DESC LIMIT 5");
    console.log("Últimos jobs INDIVIDUAL:");
    res.rows.forEach(r => {
      console.log(`ID: ${r.id}, Type: ${r.report_type}, Params: ${r.params}`);
    });
  } catch (err) {
    console.error(err.message);
  }
  process.exit(0);
}

check();
