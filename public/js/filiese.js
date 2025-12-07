document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('filiese-form');
  if (!form) return;

  const messageBox = document.getElementById('filiese-message');
  const submitButton = form.querySelector('button[type="submit"]');

  function setMessage(text, type = 'info') {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.className = `form-message ${type}`;
    messageBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // dispara validação nativa do navegador (required, e-mail, etc.)
    if (!form.reportValidity()) {
      return;
    }

    // garante as duas checkboxes marcadas
    const estatuto = document.getElementById('aceite_estatuto');
    const lgpd = document.getElementById('aceite_lgpd');

    if (!estatuto.checked || !lgpd.checked) {
      setMessage(
        'É necessário aceitar o Estatuto e a LGPD para enviar a solicitação.',
        'error'
      );
      return;
    }

    const formData = new FormData(form);

    // Monta o payload exatamente com os nomes que o backend usa
    const payload = {
      nome: (formData.get('nome') || '').toString().trim(),
      nacionalidade: (formData.get('nacionalidade') || '').toString().trim(),
      estado_civil: (formData.get('estado_civil') || '').toString().trim(),
      data_nascimento: (formData.get('data_nascimento') || '').toString().trim(),
      cpf: (formData.get('cpf') || '').toString().trim(),
      rg: (formData.get('rg') || '').toString().trim(),
      siape: (formData.get('siape') || '').toString().trim(),
      lotacao: (formData.get('lotacao') || '').toString().trim(),
      grau_instrucao: (formData.get('grau_instrucao') || '').toString().trim(),

      telefone1: (formData.get('telefone1') || '').toString().trim(),
      telefone2: (formData.get('telefone2') || '').toString().trim(),

      // email1 = funcional (opcional), email2 = pessoal (obrigatório)
      email1: (formData.get('email1') || '').toString().trim(),
      email2: (formData.get('email2') || '').toString().trim(),

      endereco: (formData.get('endereco') || '').toString().trim(),
      complemento: (formData.get('complemento') || '').toString().trim(),
      bairro: (formData.get('bairro') || '').toString().trim(),
      cidade: (formData.get('cidade') || '').toString().trim(),
      uf: (formData.get('uf') || '').toString().trim(),
      cep: (formData.get('cep') || '').toString().trim(),

      conjuge_nome: (formData.get('conjuge_nome') || '').toString().trim(),
      conjuge_nascimento: (formData.get('conjuge_nascimento') || '').toString().trim(),

      dependente1_nome: (formData.get('dependente1_nome') || '').toString().trim(),
      dependente1_nascimento: (formData.get('dependente1_nascimento') || '').toString().trim(),
      dependente2_nome: (formData.get('dependente2_nome') || '').toString().trim(),
      dependente2_nascimento: (formData.get('dependente2_nascimento') || '').toString().trim(),
      dependente3_nome: (formData.get('dependente3_nome') || '').toString().trim(),
      dependente3_nascimento: (formData.get('dependente3_nascimento') || '').toString().trim(),

      // flags de aceite – sempre como boolean
      aceite_estatuto: formData.has('aceite_estatuto'),
      aceite_lgpd: formData.has('aceite_lgpd'),
    };

    // segurança extra: confirmar e-mail pessoal
    if (!payload.email2) {
      setMessage('Informe o seu e-mail pessoal para continuar.', 'error');
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';
      }

      const response = await fetch('/api/filiese', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg =
          data && data.error
            ? data.error
            : 'Não foi possível enviar sua solicitação. Tente novamente.';
        setMessage(msg, 'error');
        return;
      }

      // Sucesso
      setMessage(
        data.message ||
          'Solicitação enviada com sucesso. Você receberá uma cópia por e-mail.',
        'success'
      );

      // Limpa o formulário (menos o e-mail pessoal, se você quiser manter apague esta linha)
      form.reset();
    } catch (err) {
      console.error('Erro ao enviar solicitação de filiação:', err);
      setMessage(
        'Ocorreu um erro ao enviar sua solicitação. Tente novamente em alguns instantes.',
        'error'
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar solicitação de filiação';
      }
    }
  });
});
