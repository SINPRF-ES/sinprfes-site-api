// src/jobs/birthdayCron.js
require('dotenv').config();
const pool = require('../config/db');
const filiadosService = require('../services/filiados.service');
const emailService = require('../services/email.service');
const aniversariosAutoService = require('../services/aniversariosAuto.service');

/**
 * Executa o job de aniversariantes com garantia de idempotência (execução única diária)
 * utilizando a tabela job_runs para lock.
 */
async function runBirthdayScan() {
  const jobName = 'BIRTHDAY_SCAN';
  console.log(`🚀 [Job] START: ${jobName}`);
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
      console.error(`💥 [Job] Registro ${jobName} não encontrado na tabela job_runs.`);
      await client.query('ROLLBACK');
      return;
    }

    // Determina a data atual no timezone de Brasília (America/Sao_Paulo)
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    const lastRun = res.rows[0].last_run_date;
    console.log(`[Job] lastRun=${lastRun} | todayStr=${todayStr}`);

    // 3. Verifica se já rodou hoje
    if (lastRun === todayStr) {
      console.log(`🎂 [Job] Skip: ${jobName} já executado hoje (${todayStr}).`);
      await client.query('ROLLBACK');
      return;
    }

    console.log(`🎂 [Job] Iniciando busca de aniversariantes para ${todayStr}...`);

    // 4. Executa a lógica de negócio
    const aniversariantes = await filiadosService.buscarAniversariantesDoDia();
    const count = aniversariantes.length;
    console.log(`✅ [Job] BUSCA aniversariantes OK (count: ${count})`);

    // Sempre envia o relatório para o sindicato (mesmo se vazio, conforme requisito)
    console.log(`[Job] Iniciando envio de e-mail de aniversariantes...`);
    await emailService.enviarRelatorioAniversariantes({
      dateStr: todayStr,
      aniversariantes
    });
    console.log('✅ [Job] EMAIL OK');


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

    // 5. Atualiza a data da última execução
    await client.query(
      'UPDATE job_runs SET last_run_date = $1, updated_at = NOW() WHERE job_name = $2',
      [todayStr, jobName]
    );
    console.log('✅ [Job] UPDATE job_runs OK');

    // 6. Comita a transação
    await client.query('COMMIT');
    console.log('✅ [Job] COMMIT OK');
    console.log(`🎂 [Job] Finalizado com sucesso. (${count} processados)`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('💥 [Job] Erro crítico ao processar aniversariantes:', error.stack || error);
    throw error;
  } finally {
    client.release();
  }
}

// Se executado diretamente via node (ex: cron do sistema ou Cloud Cron)
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
