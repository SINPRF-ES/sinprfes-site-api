// src/jobs/birthdayCron.js
require('dotenv').config();
const filiadosService = require('../services/filiados.service');
const emailService = require('../services/email.service');

async function runBirthdayScan() {
  console.log('🎂 [Job] Iniciando busca de aniversariantes...');
  try {
    const aniversariantes = await filiadosService.buscarAniversariantesDoDia();
    if (aniversariantes.length > 0) {
      console.log(`🎂 [Job] Encontrados ${aniversariantes.length} aniversariantes.`);
      await emailService.enviarEmailAniversariantes(aniversariantes);
    } else {
      console.log('🎂 [Job] Nenhum aniversariante hoje.');
    }
  } catch (error) {
    console.error('💥 [Job] Erro ao processar aniversariantes:', error);
  }
}

// Se executado diretamente via node (ex: cron do sistema ou Render Cron)
if (require.main === module) {
  runBirthdayScan().then(() => {
    console.log('🎂 [Job] Finalizado.');
    process.exit(0);
  });
}

module.exports = { runBirthdayScan };
