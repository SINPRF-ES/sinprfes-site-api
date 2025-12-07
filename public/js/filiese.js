// public/js/filiese.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("filiese-form");
  const messageBox = document.getElementById("filiese-message");
  const submitButton = form.querySelector('button[type="submit"]');

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // MENSAGEM DE CARREGAMENTO
      messageBox.textContent = "Gerando PDF e Enviando...";
      messageBox.style.color = "var(--amarelo)"; // Amarelo
      submitButton.disabled = true;
      submitButton.textContent = 'Aguarde...';

      const formData = new FormData(form);
      const dados = Object.fromEntries(formData.entries());
      
      // TRATAMENTO DE CHECKBOXES: Garante que o backend saiba se não foram marcados (false)
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
        messageBox.style.color = "#00c851"; // Verde de sucesso

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