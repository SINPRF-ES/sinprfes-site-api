document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("filiese-form");
  const messageBox = document.getElementById("filiese-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    messageBox.textContent = "Enviando sua solicitação...";
    messageBox.style.color = "var(--amarelo)";

    const formData = new FormData(form);
    const dados = Object.fromEntries(formData.entries());

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
        messageBox.textContent = result.error || "Erro ao enviar.";
        messageBox.style.color = "red";
        return;
      }

      messageBox.textContent = "Solicitação enviada com sucesso!";
      messageBox.style.color = "#00c851";

      form.reset();

    } catch (err) {
      console.error("Erro no envio:", err);
      messageBox.textContent = "Falha ao enviar. Tente novamente mais tarde.";
      messageBox.style.color = "red";
    }
  });
});
