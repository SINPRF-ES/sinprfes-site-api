// scripts/assembleia-hml-seed.js
const pool = require("../src/config/db");
const bcrypt = require("bcryptjs");

async function seed() {
  console.log("--- INICIANDO SEED DE HOMOLOGAÇÃO ---");
  const env = process.env.ASSEMBLEIA_ENV || "dev";

  if (env === "prod") {
    console.error("❌ ERRO: Não é permitido rodar o seed em produção!");
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash("senha123", 10);

    // 1. Limpar dados anteriores de assembleia (opcional, dependendo da política)
    // console.log("Limpando dados anteriores...");
    // await pool.query("DELETE FROM assembleia_votos");
    // await pool.query("DELETE FROM assembleia_votacoes");
    // await pool.query("DELETE FROM assembleia_checkins");
    // await pool.query("DELETE FROM assembleia_quoruns");
    // await pool.query("DELETE FROM assembleia_mesa");
    // await pool.query("DELETE FROM assembleia_auditoria");
    // await pool.query("DELETE FROM assembleias");

    // 2. Criar Usuários de Teste
    console.log("Criando usuários de teste...");
    const users = [
      { nome: "Diretor Um", cpf: "11111111111", perfil: "DIRETORIA" },
      { nome: "Diretor Dois", cpf: "22222222222", perfil: "DIRETORIA" },
      { nome: "User Um", cpf: "33333333333", perfil: "USER" },
      { nome: "User Dois", cpf: "44444444444", perfil: "USER" },
      { nome: "User Três", cpf: "55555555555", perfil: "USER" },
      { nome: "User Quatro", cpf: "66666666666", perfil: "USER" },
      { nome: "User Cinco", cpf: "77777777777", perfil: "USER" },
      { nome: "Organizador Um", cpf: "88888888888", perfil: "ORGANIZADOR" },
      { nome: "Admin Teste", cpf: "99999999999", perfil: "ADMIN" },
      { nome: "Comunicador Teste", cpf: "00000000000", perfil: "COMUNICADOR" },
    ];

    for (const u of users) {
      await pool.query(
        `INSERT INTO users (nome, cpf, senha_hash, perfil_acesso, situacao)
         VALUES ($1, $2, $3, $4, 'ATIVO')
         ON CONFLICT (cpf) DO UPDATE SET perfil_acesso = $4, situacao = 'ATIVO'`,
        [u.nome, u.cpf, passwordHash, u.perfil]
      );
    }

    // 3. Criar Assembleia Fictícia
    console.log("Criando assembleia fictícia...");
    const { rows } = await pool.query(
      `INSERT INTO assembleias (tipo, titulo, pauta, data_evento, hora_primeira_chamada, hora_segunda_chamada, estado)
       VALUES ('AGE', 'Assembleia de Homologação 2026', 'Pauta de teste para homologação do sistema.', CURRENT_DATE, '18:00', '18:30', 'CRIADA')
       RETURNING id`
    );
    const assId = rows[0].id;

    console.log(`--- SEED CONCLUÍDO COM SUCESSO ---`);
    console.log(`Assembleia ID: ${assId}`);
    console.log(`Usuários criados com senha: senha123`);
    process.exit(0);
  } catch (err) {
    console.error("❌ ERRO NO SEED:", err);
    process.exit(1);
  }
}

seed();
