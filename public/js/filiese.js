// ======================================================
// ROTA – Solicitação de filiação (filiese.html)
// ======================================================

app.post('/api/filiese', async (req, res) => {
  try {
    const {
      nome,
      cpf,
      data_nascimento,
      telefone1,
      telefone2,
      email1,
      email2,
      email_pessoal,
      email_funcional,
      endereco,
      complemento,
      bairro,
      cidade,
      uf,
      cep,
      aceite_estatuto,
      aceite_lgpd,
    } = req.body || {};

    // Escolhe um e-mail principal (pessoal ou email1)
    const emailPrincipal =
      (email_pessoal || email1 || email_funcional || email2 || '').toString().trim();

    // Validações básicas
    if (!nome || !cpf || !data_nascimento || !telefone1 || !emailPrincipal || !endereco) {
      return res.status(400).json({
        error:
          'Preencha todos os campos obrigatórios (nome, CPF, data, telefone, e-mail, endereço).',
      });
    }

    // Normaliza flags de aceite (podem vir como true/false, "on", "true", "1")
    const aceitouEstatuto =
      aceite_estatuto === true ||
      aceite_estatuto === 'true' ||
      aceite_estatuto === 'on' ||
      aceite_estatuto === '1';

    const aceitouLgpd =
      aceite_lgpd === true ||
      aceite_lgpd === 'true' ||
      aceite_lgpd === 'on' ||
      aceite_lgpd === '1';

    if (!aceitouEstatuto || !aceitouLgpd) {
      return res.status(400).json({
        error: 'É obrigatório aceitar o Estatuto e a LGPD para prosseguir.',
      });
    }

    const agora = new Date().toISOString();

    const dados = {
      nome: String(nome).trim(),
      cpf: String(cpf).trim(),
      data_nascimento: String(data_nascimento).trim(),
      telefone1: String(telefone1).trim(),
      telefone2: (telefone2 || '').toString().trim(),
      email1: emailPrincipal,
      email2: (email2 || email_funcional || '').toString().trim(),
      endereco: String(endereco).trim(),
      complemento: (complemento || '').toString().trim(),
      bairro: (bairro || '').toString().trim(),
      cidade: (cidade || '').toString().trim(),
      uf: (uf || '').toString().trim(),
      cep: (cep || '').toString().trim(),
      data_solicitacao: agora,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
    };

    console.log('📥 Nova solicitação de filiação recebida:', {
      nome: dados.nome,
      cpf: dados.cpf,
      email: dados.email1,
    });

    // Gera PDF (mantém sua função atual)
    const pdfBuffer = await gerarPdfFichaFiliacao(dados);

    // Envia o e-mail com o PDF em anexo
    await enviarEmailFichaFiliacao(dados, pdfBuffer);

    return res.json({
      message:
        'Solicitação de filiação enviada com sucesso. Sua ficha será analisada pelo sindicato.',
    });
  } catch (err) {
    console.error('💥 Erro em /api/filiese:', err);
    return res
      .status(500)
      .json({ error: 'Erro interno ao processar sua solicitação de filiação.' });
  }
});
