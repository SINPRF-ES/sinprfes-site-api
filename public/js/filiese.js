// public/js/filiese.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("filiese-form");
  const messageBox = document.getElementById("filiese-message");
  const submitButton = form.querySelector('button[type="submit"]');

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // VALIDAÇÃO CRÍTICA (FRONTEND)
      // O campo email1 (pessoal) é obrigatório por HTML.
      // Aqui, garantimos que o campo email2 (funcional) não bloqueie o envio se estiver vazio.
      const email2Input = document.getElementById('email_funcional');
      if (email2Input && email2Input.value === '') {
          email2Input.setCustomValidity(''); // Remove qualquer validação pendente se estiver vazio
      }
      
      // Valida o aceite do Estatuto (name="aceite")
      const aceiteEstatuto = form.querySelector('input[name="aceite"]');
      if (!aceiteEstatuto.checked) {
          messageBox.textContent = "É obrigatório declarar que leu e aceita o Estatuto do SINPRF-ES.";
          messageBox.style.color = "red";
          submitButton.disabled = false;
          submitButton.textContent = 'Enviar solicitação de filiação';
          return;
      }


      // MENSAGEM DE CARREGAMENTO
      messageBox.textContent = "Gerando PDF e Enviando...";
      messageBox.style.color = "var(--amarelo)";
      submitButton.disabled = true;
      submitButton.textContent = 'Aguarde...';

      const formData = new FormData(form);
      const dados = Object.fromEntries(formData.entries());
      
      // TRATAMENTO DE CHECKBOXES
      // Garante que o backend saiba se não foram marcados (false)
      dados.aceite = formData.has('aceite');
      dados.aceite_lgpd = formData.has('aceite_lgpd');

      try {
        const response = await fetch("/api/filiese", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(dados)
        });

        const result = await response.json();

        if (!response.ok) {
          // Exibe erro retornado pelo backend
          const errorMessage = result.error || "Erro desconhecido ao enviar.";
          messageBox.textContent = `Falha: ${errorMessage}`;
          messageBox.style.color = "red";
          console.error("Erro do Backend:", result);
          return;
        }

        // SUCESSO
        messageBox.textContent = "Solicitação enviada com sucesso! Verifique seu e-mail pessoal para uma cópia.";
        messageBox.style.color = "#00c851"; 

        form.reset();
        submitButton.textContent = 'Enviar solicitação de filiação';

      } catch (err) {
        // ERRO DE REDE/CONEXÃO
        console.error("Erro no envio (Rede/Fetch):", err);
        messageBox.textContent = "Falha ao enviar. Verifique sua conexão e tente novamente.";
        messageBox.style.color = "red";
        submitButton.textContent = 'Enviar solicitação de filiação';

      } finally {
        submitButton.disabled = false; // Reativa o botão
      }
    });
  }
});