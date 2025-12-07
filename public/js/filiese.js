// public/js/filiese.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("filiese-form");
  const msg = document.getElementById("filiese-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "Enviando...";

    const dados = Object.fromEntries(new FormData(form).entries());

    // Conversão para o padrão do backend
    dados.email_pessoal = dados.email_pessoal || "";
    dados.email_funcional = dados.email_funcional || "";

    try {
      const r = await fetch("/api/filiese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });

      const json = await r.json();

      if (!r.ok) {
        msg.textContent = "❌ " + (json.error || "Erro no envio.");
        msg.style.color = "red";
        return;
      }

      msg.textContent = "✔ Solicitação enviada com sucesso!";
      msg.style.color = "limegreen";
      form.reset();

    } catch (err) {
      msg.textContent = "❌ Falha ao enviar o formulário.";
      msg.style.color = "red";
      console.error(err);
    }
  });
});
