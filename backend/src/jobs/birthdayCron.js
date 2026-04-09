// src/jobs/birthdayCron.js
require('dotenv').config();
const pool = require('../config/db');
const filiadosService = require('../services/filiados.service');
const emailService = require('../services/email.service');
const aniversariosAutoService = require('../services/aniversariosAuto.service');
const birthdayGreetingsService = require('../services/birthdayGreetings.service');
const log = require('../utils/log');

/**
 * Executa o job de aniversariantes com garantia de idempotência (execução única diária)
 * utilizando a tabela job_runs para lock.
 */
async function runBirthdayScan() {
  const jobName = 'BIRTHDAY_SCAN';
  log.info("Job.BirthdayScan.Iniciado");
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const res = await client.query(
      'SELECT last_run_date FROM job_runs WHERE job_name = $1 FOR UPDATE',
      [jobName]
    );

    let lastRun = null;
    if (res.rows.length === 0) {
      await client.query(
        'INSERT INTO job_runs (job_name, last_run_date, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (job_name) DO NOTHING',
        [jobName, '01/01/1900']
      );
      lastRun = '01/01/1900';
      log.warn("Job.BirthdayScan.RegistroCriado", { jobName });
    } else {
      lastRun = res.rows[0].last_run_date;
    }

    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    if (lastRun === todayStr) {
      log.info("Job.BirthdayScan.JaExecutadoHoje", { todayStr });
      await client.query('ROLLBACK');
      return;
    }

    log.info("Job.BirthdayScan.Processando", { todayStr });

    const aniversariantes = await filiadosService.buscarAniversariantesDoDia();
    const count = aniversariantes.length;

    let summaryEmailStatus = 'failed';
    await emailService.enviarRelatorioAniversariantes({
      dateStr: todayStr,
      aniversariantes,
    });
    summaryEmailStatus = 'sent';

    const greetingStats = await birthdayGreetingsService.sendBirthdayGreetingsBatch({
      aniversariantes,
      referenceDate: birthdayGreetingsService.getReferenceDateISO(),
    });

    if (count > 0) {
      try {
        await aniversariosAutoService.criarAniversarioAutomatico({ aniversariantes });
      } catch (autoErr) {
        log.error("Job.BirthdayScan.ErroAutoAniversario", autoErr);
      }
    }

    await client.query(
      'UPDATE job_runs SET last_run_date = $1, updated_at = NOW() WHERE job_name = $2',
      [todayStr, jobName]
    );

    await client.query('COMMIT');
    log.info("Job.BirthdayScan.Finalizado", {
      totalBirthdaysFound: greetingStats.totalBirthdaysFound,
      sentSuccessfully: greetingStats.sentSuccessfully,
      summaryEmailStatus,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    log.error("Job.BirthdayScan.ErroCritico", error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runBirthdayScan()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 [Job] Process exiting with error:', err);
      process.exit(1);
    });
}

module.exports = { runBirthdayScan };
