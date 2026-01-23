// src/jobs/birthdayCron.js
require('dotenv').config();
const pool = require('../config/db');
const filiadosService = require('../services/filiados.service');
const emailService = require('../services/email.service');

/**
 * Executa o job de aniversariantes com garantia de idempotência (execução única diária)
 * utilizando a tabela job_runs para lock.
 */
async function runBirthdayScan() {
  const jobName = 'BIRTHDAY_SCAN';
  const client = await pool.connect();

  try {
    // 1. Inicia transação
    await client.query('BEGIN');

    // 2. Tenta adquirir lock e ler o estado atual
    // FOR UPDATE garante que outros processos fiquem aguardando
    const res = await client.query(
      'SELECT last_run_date FROM job_runs WHERE job_name = $1 FOR UPDATE',
      [jobName]
    );

    if (res.rows.length === 0) {
      console.error('💥 [Job] Registro BIRTHDAY_SCAN não encontrado na tabela job_runs.');
      await client.query('ROLLBACK');
      return;
    }

    // Determina a data atual no timezone de Brasília (America/Sao_Paulo)
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    const lastRun = res.rows[0].last_run_date;

    // 3. Verifica se já rodou hoje
    if (lastRun === todayStr) {
      console.log(`🎂 [Job] Skip: ${jobName} já executado hoje (${todayStr}).`);
      await client.query('ROLLBACK');
      return;
    }

    console.log(`🎂 [Job] Iniciando busca de aniversariantes para ${todayStr}...`);

    // 4. Executa a lógica de negócio
    const aniversariantes = await filiadosService.buscarAniversariantesDoDia();
    let count = 0;

    if (aniversariantes.length > 0) {
      console.log(`🎂 [Job] Encontrados ${aniversariantes.length} aniversariantes.`);
      await emailService.enviarEmailAniversariantes(aniversariantes);
      count = aniversariantes.length;
    } else {
      console.log('🎂 [Job] Nenhum aniversariante hoje.');
    }

    // 5. Atualiza a data da última execução
    await client.query(
      'UPDATE job_runs SET last_run_date = $1, updated_at = NOW() WHERE job_name = $2',
      [todayStr, jobName]
    );

    // 6. Comita a transação
    await client.query('COMMIT');
    console.log(`🎂 [Job] Finalizado com sucesso. (${count} processados)`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('💥 [Job] Erro crítico ao processar aniversariantes:', error);
  } finally {
    client.release();
  }
}

// Se executado diretamente via node (ex: cron do sistema ou Render Cron)
if (require.main === module) {
  runBirthdayScan().then(() => {
    process.exit(0);
  });
}

module.exports = { runBirthdayScan };
