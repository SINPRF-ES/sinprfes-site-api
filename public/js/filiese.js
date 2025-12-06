// public/js/filiese.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("filiese-form");
  const msgBox = document.getElementById("filiese-message");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgBox.textContent = "";
    msgBox.className = "form-message";

    const formData = Object.fromEntries(new FormData(form));

    // validações extras antes do envio
    if (!formData.aceite_estatuto || !formData.aceite_lgpd) {
      msgBox.textContent = "É necessário aceitar os termos e a LGPD para enviar.";
      msgBox.classList.add("error");
      return;
    }

    try {
      const resp = await fetch("/api/filiese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await resp.json();

      if (!resp.ok) {
        msgBox.textContent = data.error || "Erro ao enviar.";
        msgBox.classList.add("error");
        return;
      }

      msgBox.textContent = data.message || "Solicitação enviada com sucesso!";
      msgBox.classList.add("success");
      form.reset();

    } catch (err) {
      console.error("Erro no envio:", err);
      msgBox.textContent = "Erro inesperado. Tente novamente.";
      msgBox.classList.add("error");
    }
  });
});
