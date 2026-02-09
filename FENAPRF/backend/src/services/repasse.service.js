const pool = require("../config/db");
const { UFS } = require("../../shared/canon");

const factorFromPercentual = (percent) => {
  if (percent < 70) return 0;
  if (percent < 80) return 0.4;
  if (percent < 90) return 0.7;
  return 1.0;
};

async function getUsersAtivosCount(uf) {
  const { rows } = await pool.query(`
    SELECT COUNT(*) as count
    FROM users
    WHERE situacao = 'ATIVO'
      AND arquivado_em IS NULL
      AND uf = $1
  `, [uf]);

  return parseInt(rows[0].count);
}

async function listarResponsaveis(uf = null) {
  let query = `
    SELECT id, nome, cpf, uf, perfil_acesso, situacao, arquivado_em
    FROM users
    WHERE situacao = 'ATIVO'
      AND arquivado_em IS NULL
  `;
  const params = [];

  if (uf) {
    query += ` AND uf = $1`;
    params.push(uf);
  }

  query += ` ORDER BY nome ASC`;

  const { rows } = await pool.query(query, params);

  // Logging backend (obrigatório)
  const total = rows.length;
  const byUf = {};
  const organizadores = rows.filter(r => (r.perfil_acesso || '').toUpperCase() === 'ORGANIZADOR');

  rows.forEach(r => {
    const ufVal = r.uf || 'SEM UF';
    byUf[ufVal] = (byUf[ufVal] || 0) + 1;
  });

  console.info(`[REPASSE_RESP] total=${total} byUf=${JSON.stringify(byUf)}`);
  console.info(`[REPASSE_RESP] organizadores=${organizadores.length} ufs=${JSON.stringify(organizadores.map(o => o.uf))}`);

  return rows;
}

async function getRepasseAno(year) {
  // Busca todas as configurações de per_capita para o ano
  const { rows: configRows } = await pool.query(
    `SELECT * FROM repasse_mes WHERE year = $1`,
    [year]
  );

  // Busca todos os dados de unidades (UF) para o ano
  const { rows: unidadesRows } = await pool.query(
    `SELECT ru.*, f.nome as responsavel_nome, f.cpf as responsavel_cpf
     FROM repasse_unidades ru
     LEFT JOIN users f ON ru.responsavel_id = f.id
     WHERE ru.year = $1`,
    [year]
  );

  // Calcula membros ativos atuais para cada UF
  // (O requisito diz: "Para TODOS os cálculos do módulo 'Repasse': 'Membros ativos' = SOMENTE SITUAÇÃO FUNCIONAL = ATIVO")

  const ativosPorUf = {};
  for (const uf of UFS) {
    ativosPorUf[uf] = await getUsersAtivosCount(uf);
  }

  const meses = [];
  for (let month = 1; month <= 12; month++) {
    const config = configRows.find(r => r.month === month) || { per_capita: 0 };
    const perCapita = parseFloat(config.per_capita);

    const localidades = UFS.map(uf => {
      const data = unidadesRows.find(r => r.month === month && r.uf_key === uf) || {
        responsavel_id: null,
        responsavel_nome: null,
        responsavel_cpf: null,
        prf_total: 0,
        reembolso_mes: 0
      };

      const usersAtivos = ativosPorUf[uf];
      const prfTotal = parseInt(data.prf_total) || 0;

      let percentual = 0;
      let creditoMes = 0;

      if (prfTotal > 0) {
        percentual = (usersAtivos / prfTotal) * 100;
        const base = usersAtivos * perCapita;
        const factor = factorFromPercentual(percentual);
        creditoMes = base * factor;
      }

      return {
        uf,
        responsavelId: data.responsavel_id,
        responsavelNome: data.responsavel_nome,
        responsavelCpf: data.responsavel_cpf,
        usersAtivos,
        prfTotal,
        percentual: prfTotal > 0 ? percentual : null,
        creditoMes,
        reembolsoMes: parseFloat(data.reembolso_mes || 0)
      };
    });

    const totalRepasseMes = localidades.reduce((acc, loc) => acc + loc.creditoMes, 0);

    meses.push({
      month,
      perCapita,
      localidades,
      totalRepasseMes
    });
  }

  // Cálculo do acumulado por UF no ano
  const ufsAcumulado = UFS.map(uf => {
    let somaCreditos = 0;
    let somaReembolsos = 0;

    meses.forEach(m => {
      const loc = m.localidades.find(l => l.uf === uf);
      somaCreditos += loc.creditoMes;
      somaReembolsos += loc.reembolsoMes;
    });

    return {
      uf,
      acumuladoAno: somaCreditos - somaReembolsos
    };
  });

  // Anexar o acumulado em cada UF de cada mês
  meses.forEach(m => {
    m.localidades.forEach(loc => {
      const acc = ufsAcumulado.find(la => la.uf === loc.uf);
      loc.acumuladoAno = acc.acumuladoAno;
    });
  });

  const totalAcumuladoGeral = ufsAcumulado.reduce((acc, curr) => acc + curr.acumuladoAno, 0);

  return {
    year,
    meses,
    totalAcumuladoGeral
  };
}

/**
 * Obtém os dados de repasse mais recentes para uma UF específica.
 * Usado pelo módulo de Relatórios para evitar duplicação de lógica.
 */
async function getUltimosDadosParaRelatorio(uf) {
  // 1. Total de membros ativos atuais (Source of Truth do Repasse)
  const usersAtivos = await getUsersAtivosCount(uf);

  // 2. Busca o registro mais recente de prf_total para esta UF
  const { rows } = await pool.query(`
    SELECT ru.year, ru.month, ru.prf_total
    FROM repasse_unidades ru
    WHERE ru.uf_key = $1
    ORDER BY ru.year DESC, ru.month DESC
    LIMIT 1
  `, [uf]);

  if (rows.length === 0) {
    return {
      usersAtivos,
      prfTotal: null,
      percentual: null,
      competencia: null
    };
  }

  const { year, month, prf_total: prfTotal } = rows[0];
  let percentual = null;
  if (prfTotal > 0) {
    percentual = (usersAtivos / prfTotal) * 100;
  }

  return {
    usersAtivos,
    prfTotal,
    percentual,
    competencia: { year, month }
  };
}

async function updateRepasseMes(year, month, perCapita, localidadesData) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update per_capita
    await client.query(`
      INSERT INTO repasse_mes (year, month, per_capita)
      VALUES ($1, $2, $3)
      ON CONFLICT (year, month) DO UPDATE SET per_capita = $3
    `, [year, month, perCapita]);

    // Update each location
    for (const loc of localidadesData) {
      const ufKey = loc.ufKey;
      // Proteção: Apenas UFs válidas
      if (!UFS.includes(ufKey)) continue;

      await client.query(`
        INSERT INTO repasse_unidades (year, month, uf_key, responsavel_id, prf_total, reembolso_mes)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (year, month, uf_key) DO UPDATE SET
          responsavel_id = $4,
          prf_total = $5,
          reembolso_mes = $6
      `, [year, month, ufKey, loc.responsavelId, loc.prfTotal, loc.reembolsoMes]);
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  getRepasseAno,
  getUltimosDadosParaRelatorio,
  updateRepasseMes,
  listarResponsaveis,
  factorFromPercentual
};
