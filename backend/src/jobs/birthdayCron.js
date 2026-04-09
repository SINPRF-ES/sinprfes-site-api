// src/jobs/birthdayCron.js
require('dotenv').config();
const pool = require('../config/db');
const filiadosService = require('../services/filiados.service');
const emailService = require('../services/email.service');
const aniversariosAutoService = require('../services/aniversariosAuto.service');
const birthdayGreetingsService = require('../services/birthdayGreetings.service');

/**
 * Executa o job de aniversariantes com garantia de idempotência (execução única diária)
 * utilizando a tabela job_runs para lock.
 */
async function runBirthdayScan() {
  const jobName = 'BIRTHDAY_SCAN';
  console.log(`🚀 [Job] START: ${jobName}`);
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
        'INSERT INTO job_runs (job_name, last_run_date, updated_at) VALUES ($1, $2, NOW())',
        [jobName, '01/01/1900']
      );
      lastRun = '01/01/1900';
      console.warn(`⚠️ [Job] Registro ${jobName} ausente em job_runs. Registro inicial criado.`);
    } else {
      lastRun = res.rows[0].last_run_date;
    }

    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    console.log(`[Job] lastRun=${lastRun} | todayStr=${todayStr}`);

    if (lastRun === todayStr) {
      console.log(`🎂 [Job] Skip: ${jobName} já executado hoje (${todayStr}).`);
      await client.query('ROLLBACK');
      return;
    }

    console.log(`🎂 [Job] Iniciando busca de aniversariantes para ${todayStr}...`);

    const aniversariantes = await filiadosService.buscarAniversariantesDoDia();
    const count = aniversariantes.length;
    console.log(`✅ [Job] BUSCA aniversariantes OK (count: ${count})`);

    let summaryEmailStatus = 'failed';
    console.log('[Job] Iniciando envio de e-mail de aniversariantes...');
    await emailService.enviarRelatorioAniversariantes({
      dateStr: todayStr,
      aniversariantes,
    });
    summaryEmailStatus = 'sent';
    console.log('✅ [Job] EMAIL OK');

    const greetingStats = await birthdayGreetingsService.sendBirthdayGreetingsBatch({
      aniversariantes,
      referenceDate: birthdayGreetingsService.getReferenceDateISO(),
    });

    if (count > 0) {
      try {
        console.log('[Job] Iniciando criação automática de aniversário...');
        const resultadoAniversario = await aniversariosAutoService.criarAniversarioAutomatico({ aniversariantes });
        console.log('✅ [Job] ANIVERSARIO_AUTO OK', resultadoAniversario);
      } catch (autoErr) {
        console.error('⚠️ [Job] Falha ao criar aniversário automático (não bloqueia e-mail):', autoErr?.message || autoErr);
      }
    } else {
      console.log('[Job] Sem aniversariantes hoje: criação de aniversário automático ignorada.');
    }

    await client.query(
      'UPDATE job_runs SET last_run_date = $1, updated_at = NOW() WHERE job_name = $2',
      [todayStr, jobName]
    );
    console.log('✅ [Job] UPDATE job_runs OK');

    await client.query('COMMIT');
    console.log('✅ [Job] COMMIT OK');
    console.log('🎂 [Job] SUMMARY', {
      totalBirthdaysFound: greetingStats.totalBirthdaysFound,
      eligibleForIndividualSend: greetingStats.eligibleForIndividualSend,
      sentSuccessfully: greetingStats.sentSuccessfully,
      failed: greetingStats.failed,
      skipped: greetingStats.skipped,
      summaryEmailStatus,
    });
    console.log(`🎂 [Job] Finalizado com sucesso. (${count} processados)`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('💥 [Job] Erro crítico ao processar aniversariantes:', error.stack || error);
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
