// public/js/filiese.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('filiese-form');
  if (!form) return;

  const messageBox = document.getElementById('filiese-message');
  const API_URL = '/api/filiese'; // Se sua rota no backend tiver outro caminho, é só mudar aqui

  form.addEventListener('submit', async (event) => {
    event.preventDefault(); // impede o reload da página

    if (messageBox) {
      messageBox.textContent = '';
      messageBox.className = 'form-message';
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
    }

    // Lê todos os campos do formulário
    const formData = new FormData(form);
    const dados = Object.fromEntries(formData.entries());

    // Checkboxes como booleano
    dados.aceite_estatuto = !!form.aceite_estatuto?.checked;
    dados.aceite_lgpd = !!form.aceite_lgpd?.checked;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dados),
      });

      let body = {};
      try {
        body = await response.json();
      } catch (e) {
        body = {};
      }

      if (!response.ok) {
        const msg = body.error || 'Erro ao enviar solicitação de filiação. Tente novamente mais tarde.';
        if (messageBox) {
          messageBox.textContent = msg;
          messageBox.classList.add('form-message-error');
        } else {
          alert(msg);
        }
      } else {
        const msg = body.message || 'Solicitação enviada com sucesso. Em breve entraremos em contato.';
        if (messageBox) {
          messageBox.textContent = msg;
          messageBox.classList.add('form-message-success');
        } else {
          alert(msg);
        }
        form.reset();
      }
    } catch (err) {
      console.error('Erro ao enviar filiação:', err);
      const msg = 'Não foi possível enviar sua solicitação. Verifique sua conexão e tente novamente.';
      if (messageBox) {
        messageBox.textContent = msg;
        messageBox.classList.add('form-message-error');
      } else {
        alert(msg);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText || 'Enviar solicitação de filiação';
      }
    }
  });
});
