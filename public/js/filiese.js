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

    // Garantir que os dois termos foram marcados
    if (!formData.aceite_estatuto || !formData.aceite_lgpd) {
      msgBox.textContent = "É necessário aceitar o Estatuto e a LGPD para prosseguir.";
      msgBox.classList.add("error");
      return;
    }

    // Campos realmente obrigatórios, alinhados com o backend
    const obrigatorios = [
      "nome",
      "cpf",
      "data_nascimento",
      "telefone1",
      "email_pessoal",
      "endereco",
      "bairro",
      "cidade",
      "uf",
      "cep",
      "siape",
      "lotacao",
    ];

    for (const campo of obrigatorios) {
      if (!formData[campo] || String(formData[campo]).trim() === "") {
        msgBox.textContent = "Preencha todos os campos obrigatórios (*) antes de enviar.";
        msgBox.classList.add("error");
        return;
      }
    }

    // Normalização leve de campos
    formData.cpf = String(formData.cpf).trim();
    formData.email_pessoal = String(formData.email_pessoal).trim();
    formData.email_funcional = (formData.email_funcional || "").trim();

    try {
      msgBox.textContent = "Enviando sua solicitação...";
      msgBox.className = "form-message info";

      const resp = await fetch("/api/filiese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      let data = {};
      try {
        data = await resp.json();
      } catch {
        // se o backend devolver algo não-JSON, evita crash
      }

      if (!resp.ok) {
        msgBox.textContent =
          data.error ||
          data.detailedMessage ||
          "Erro ao enviar sua solicitação. Tente novamente.";
        msgBox.classList.add("error");
        return;
      }

      msgBox.textContent =
        data.message ||
        "Solicitação enviada com sucesso. A equipe do SINPRF-ES entrará em contato.";
      msgBox.classList.add("success");
      form.reset();

    } catch (err) {
      console.error("Erro no envio da ficha de filiação:", err);
      msgBox.textContent = "Erro inesperado ao enviar. Tente novamente em alguns instantes.";
      msgBox.classList.add("error");
    }
  });
});
