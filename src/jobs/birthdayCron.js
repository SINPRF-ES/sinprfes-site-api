const pool = require("../config/db");
const { enviarEmailBase } = require("../services/email.service");
const Textos = require("../utils/textos");
const log = require("../utils/log");

/**
 * Executa a verificação de aniversariantes do dia e envia notificações.
 * Utiliza lock no banco de dados para garantir execução única diária.
 */
async function runBirthdayScan() {
  const jobName = "BIRTHDAY_SCAN";
  const now = new Date();

  // Ajusta para o fuso de São Paulo para a comparação de data
  const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Cria tabela de controle se não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_runs (
        job_name VARCHAR(50) PRIMARY KEY,
        last_run_at TIMESTAMP,
        last_run_date VARCHAR(10),
        status VARCHAR(20),
        meta JSONB
      )
    `);

    // Tenta adquirir lock para o dia de hoje
    const { rows } = await client.query(
      "SELECT last_run_date FROM job_runs WHERE job_name = $1 FOR UPDATE",
      [jobName]
    );

    if (rows.length > 0 && rows[0].last_run_date === dateStr) {
      log.info("BirthdayJobSkipAlreadyRanToday", { date: dateStr });
      await client.query("ROLLBACK");
      return;
    }

    log.info("BirthdayJobStart", { date: dateStr });

    // Busca aniversariantes (considerando apenas mês e dia no fuso SP)
    // Nota: Esta query é simplificada e deve ser ajustada conforme a estrutura real da data_nascimento
    const queryAniversariantes = `
      SELECT nome, email1, telefone1
      FROM filiados
      WHERE arquivado_em IS NULL
        AND EXTRACT(MONTH FROM data_nascimento) = EXTRACT(MONTH FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'))
        AND EXTRACT(DAY FROM data_nascimento) = EXTRACT(DAY FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'))
    `;
    const { rows: aniversariantes } = await client.query(queryAniversariantes);

    for (const aniv of aniversariantes) {
      if (aniv.email1) {
        try {
          await enviarEmailBase(
            aniv.email1,
            Textos.ASSUNTOS_EMAIL.ASSUNTO_ANIVERSARIO,
            `Olá ${aniv.nome.split(" ")[0]},\n\nO SINPRF-ES deseja a você um feliz aniversário! Muita saúde e conquistas.\n\nAtenciosamente,\nDiretoria SINPRF-ES`
          );
        } catch (e) {
          log.error("BirthdayJobEmailError", e, { email: aniv.email1 });
        }
      }
    }

    // Atualiza controle
    await client.query(
      `INSERT INTO job_runs (job_name, last_run_at, last_run_date, status)
       VALUES ($1, NOW(), $2, 'SUCCESS')
       ON CONFLICT (job_name) DO UPDATE SET
         last_run_at = EXCLUDED.last_run_at,
         last_run_date = EXCLUDED.last_run_date,
         status = EXCLUDED.status`,
      [jobName, dateStr]
    );

    await client.query("COMMIT");
    log.info("BirthdayJobEnd", { count: aniversariantes.length });
  } catch (err) {
    await client.query("ROLLBACK");
    log.error("BirthdayJobError", err);
  } finally {
    client.release();
  }
}

/**
 * Inicializa o agendamento do Job.
 * Em produção, prefira um cron externo chamando um endpoint.
 */
function initBirthdayJob() {
  // Execução no boot apenas se explicitamente habilitado (evita loops em restart/scale)
  if (process.env.BIRTHDAY_SCAN_ON_BOOT === "true") {
    log.info("BirthdayJobBootTriggered");
    runBirthdayScan();
  }

  // Agenda para verificar periodicamente (ex: a cada 1 hora)
  // O lock no banco garante que só rodará efetivamente uma vez por dia na primeira janela após as 08:00
  setInterval(() => {
    const now = new Date();
    const hours = now.getUTCHours() - 3; // Simples ajuste para SP (GMT-3)

    // Tenta rodar na janela das 08:00
    if (hours === 8) {
      runBirthdayScan();
    }
  }, 1000 * 60 * 60); // 1 hora
}

module.exports = {
  runBirthdayScan,
  initBirthdayJob
};
