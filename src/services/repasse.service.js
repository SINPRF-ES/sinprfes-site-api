const pool = require("../config/db");
const { REPASSE_LOTACOES } = require("../../shared/repasse.constants");

/**
 * Mapeamento de lotação para keyword de busca no banco.
 * Segue a lógica de filiados-admin.js para consistência.
 */
const LOTACAO_KEYWORDS = {
  "SEDE": "SEDE",
  "DEL 01 - Viana": "VIANA",
  "DEL 02 - Serra": "SERRA",
  "DEL 03 - Guarapari": "GUARAPARI",
  "DEL 04 - Linhares": "LINHARES"
};

const factorFromPercentual = (percent) => {
  if (percent < 70) return 0;
  if (percent < 80) return 0.4;
  if (percent < 90) return 0.7;
  return 1.0;
};

async function getFiliadosAtivosCount(lotacaoKey) {
  const keyword = LOTACAO_KEYWORDS[lotacaoKey];
  if (!keyword) return 0;

  const { rows } = await pool.query(`
    SELECT COUNT(*) as count
    FROM filiados
    WHERE situacao = 'ATIVO'
      AND arquivado_em IS NULL
      AND UPPER(lotacao) LIKE $1
  `, [`%${keyword.toUpperCase()}%`]);

  return parseInt(rows[0].count);
}

async function listarResponsaveis(lotacaoKey = null) {
  let query = `
    SELECT id, nome, cpf, lotacao, perfil_acesso, situacao, arquivado_em
    FROM filiados
    WHERE situacao = 'ATIVO'
      AND arquivado_em IS NULL
  `;
  const params = [];

  if (lotacaoKey) {
    const keyword = LOTACAO_KEYWORDS[lotacaoKey];
    if (keyword) {
      query += ` AND UPPER(lotacao) LIKE $1`;
      params.push(`%${keyword.toUpperCase()}%`);
    }
  }

  query += ` ORDER BY nome ASC`;

  const { rows } = await pool.query(query, params);

  // Logging backend (obrigatório)
  const total = rows.length;
  const byLotacao = {};
  const organizadores = rows.filter(r => (r.perfil_acesso || '').toUpperCase() === 'ORGANIZADOR');

  rows.forEach(r => {
    const lot = r.lotacao || 'SEM LOTACAO';
    byLotacao[lot] = (byLotacao[lot] || 0) + 1;
  });

  console.info(`[REPASSE_RESP] total=${total} byLotacao=${JSON.stringify(byLotacao)}`);
  console.info(`[REPASSE_RESP] organizadores=${organizadores.length} lotacoes=${JSON.stringify(organizadores.map(o => o.lotacao))}`);

  return rows;
}

async function getRepasseAno(year) {
  // Busca todas as configurações de per_capita para o ano
  const { rows: configRows } = await pool.query(
    `SELECT * FROM repasse_mes WHERE year = $1`,
    [year]
  );

  // Busca todos os dados de lotação para o ano
  const { rows: lotacaoRows } = await pool.query(
    `SELECT rl.*, f.nome as responsavel_nome, f.cpf as responsavel_cpf
     FROM repasse_lotacao rl
     LEFT JOIN filiados f ON rl.responsavel_id = f.id
     WHERE rl.year = $1`,
    [year]
  );

  // Calcula filiados ativos atuais para cada localidade
  // (O requisito diz: "Para TODOS os cálculos do módulo 'Repasse': 'Filiados ativos' = SOMENTE SITUAÇÃO FUNCIONAL = ATIVO")
  // Note: O número de filiados ativos pode variar com o tempo, mas para o cálculo do repasse do MÊS,
  // geralmente se usa o valor no momento. O requisito não diz para persistir esse número,
  // diz para calculá-lo ("Campos calculados (não persistir): filiadosAtivos").
  // Isso implica que o histórico será recalculado com base no estado ATUAL do banco?
  // Geralmente repasse se baseia no histórico, mas o requisito é explícito: "não persistir".

  const ativosPorLotacao = {};
  for (const lot of REPASSE_LOTACOES) {
    ativosPorLotacao[lot] = await getFiliadosAtivosCount(lot);
  }

  const meses = [];
  for (let month = 1; month <= 12; month++) {
    const config = configRows.find(r => r.month === month) || { per_capita: 0 };
    const perCapita = parseFloat(config.per_capita);

    const localidades = REPASSE_LOTACOES.map(lot => {
      const data = lotacaoRows.find(r => r.month === month && r.lotacao_key === lot) || {
        responsavel_id: null,
        responsavel_nome: null,
        responsavel_cpf: null,
        prf_total: 0,
        reembolso_mes: 0
      };

      const filiadosAtivos = ativosPorLotacao[lot];
      const prfTotal = parseInt(data.prf_total) || 0;

      let percentual = 0;
      let creditoMes = 0;

      if (prfTotal > 0) {
        percentual = (filiadosAtivos / prfTotal) * 100;
        const base = filiadosAtivos * perCapita;
        const factor = factorFromPercentual(percentual);
        creditoMes = base * factor;
      }

      return {
        lotacao: lot,
        responsavelId: data.responsavel_id,
        responsavelNome: data.responsavel_nome,
        responsavelCpf: data.responsavel_cpf,
        filiadosAtivos,
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

  // Cálculo do acumulado por localidade no ano
  // acumuladoAno = soma(créditos mensais) – soma(reembolsos)
  const lotacoesAcumulado = REPASSE_LOTACOES.map(lot => {
    let somaCreditos = 0;
    let somaReembolsos = 0;

    meses.forEach(m => {
      const loc = m.localidades.find(l => l.lotacao === lot);
      somaCreditos += loc.creditoMes;
      somaReembolsos += loc.reembolsoMes;
    });

    return {
      lotacao: lot,
      acumuladoAno: somaCreditos - somaReembolsos
    };
  });

  // Anexar o acumulado em cada localidade de cada mês (para exibição na tela)
  meses.forEach(m => {
    m.localidades.forEach(loc => {
      const acc = lotacoesAcumulado.find(la => la.lotacao === loc.lotacao);
      loc.acumuladoAno = acc.acumuladoAno;
    });
  });

  const totalAcumuladoGeral = lotacoesAcumulado.reduce((acc, curr) => acc + curr.acumuladoAno, 0);

  return {
    year,
    meses,
    totalAcumuladoGeral
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
      await client.query(`
        INSERT INTO repasse_lotacao (year, month, lotacao_key, responsavel_id, prf_total, reembolso_mes)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (year, month, lotacao_key) DO UPDATE SET
          responsavel_id = $4,
          prf_total = $5,
          reembolso_mes = $6
      `, [year, month, loc.lotacaoKey, loc.responsavelId, loc.prfTotal, loc.reembolsoMes]);
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
  updateRepasseMes,
  listarResponsaveis,
  factorFromPercentual
};
