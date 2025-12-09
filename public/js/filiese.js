// public/js/filiese.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("filiese-form");
  const msgEl = document.getElementById("filiese-message");

  if (!form) return;

  // -------------------------
  // Máscaras
  // -------------------------
  function aplicarMascaraCPF(input) {
    if (!input) return;
    input.addEventListener("input", () => {
      let v = input.value.replace(/\D/g, "").slice(0, 11);
      if (v.length > 9) {
        v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
      } else if (v.length > 6) {
        v = v.replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
      } else if (v.length > 3) {
        v = v.replace(/(\d{3})(\d{0,3})/, "$1.$2");
      }
      input.value = v;
    });
  }

  function aplicarMascaraTelefone(input) {
    if (!input) return;

    function formatar(valor) {
      let v = String(valor || "").replace(/\D/g, "");

      if (!v) return "";

      if (v.length > 11) v = v.slice(0, 11);

      if (v.length <= 10) {
        if (v.length >= 1) v = "(" + v;
        if (v.length >= 3) v = v.slice(0, 3) + ") " + v.slice(3);
        if (v.length > 9) v = v.slice(0, 9) + "-" + v.slice(9);
      } else {
        v = "(" + v.slice(0, 2) + ") " + v.slice(2);
        if (v.length > 10) v = v.slice(0, 10) + "-" + v.slice(10);
      }

      return v;
    }

    input.value = formatar(input.value);

    input.addEventListener("input", () => {
      input.value = formatar(input.value);
    });
  }

  aplicarMascaraCPF(document.getElementById("cpf"));
  aplicarMascaraTelefone(document.getElementById("telefone1"));
  aplicarMascaraTelefone(document.getElementById("telefone2"));

  // -------------------------
  // CEP / ViaCEP
  // -------------------------
  const cepInput = document.getElementById("cep");
  const btnCep = document.getElementById("btn-buscar-cep");
  const endInput = document.getElementById("endereco");
  const cidadeInput = document.getElementById("cidade");
  const ufInput = document.getElementById("uf");

  if (cepInput) {
    cepInput.addEventListener("input", () => {
      cepInput.value = cepInput.value.replace(/\D/g, "").slice(0, 8);
    });
  }

  async function consultarCep() {
    const cepLimpo = (cepInput.value || "").replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      mostrarMensagem("CEP inválido. Use 8 dígitos.", true);
      return;
    }

    try {
      mostrarMensagem("Consultando CEP...", false);

      const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      if (!resp.ok) throw new Error("Erro ao consultar ViaCEP");

      const data = await resp.json();
      if (data.erro) {
        mostrarMensagem("CEP não encontrado.", true);
        return;
      }

      const logradouroBairro = [data.logradouro, data.bairro]
        .filter(Boolean)
        .join(", ");

      if (logradouroBairro) endInput.value = logradouroBairro;
      if (data.localidade) cidadeInput.value = data.localidade;
      if (data.uf) ufInput.value = data.uf;

      mostrarMensagem("CEP carregado com sucesso.", false);
    } catch (err) {
      console.error("Erro ao consultar CEP:", err);
      mostrarMensagem("Erro ao consultar CEP. Tente novamente.", true);
    }
  }

  if (btnCep) {
    btnCep.addEventListener("click", (e) => {
      e.preventDefault();
      consultarCep();
    });
  }
  if (cepInput) {
    cepInput.addEventListener("blur", () => {
      if (cepInput.value.trim()) consultarCep();
    });
  }

  // -------------------------
  // Mensagens
  // -------------------------
  function mostrarMensagem(texto, erro = false) {
    if (!msgEl) return;
    msgEl.textContent = texto;
    msgEl.style.color = erro ? "#c0392b" : "#2ecc71";
  }

  // -------------------------
  // Envio do formulário
  // -------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    mostrarMensagem("Enviando solicitação...", false);

    const payload = {
      nome: document.getElementById("nome").value.trim(),
      data_nascimento: document.getElementById("data_nascimento").value,
      cpf: document.getElementById("cpf").value.replace(/\D/g, ""),
      siape: document.getElementById("siape").value.trim(),

      telefone1: document.getElementById("telefone1").value.replace(/\D/g, ""),
      telefone2: document
        .getElementById("telefone2")
        .value.replace(/\D/g, ""),

      email_pessoal: document.getElementById("email_pessoal").value.trim(),
      email_funcional: document.getElementById("email_funcional").value.trim(),

      cep: document.getElementById("cep").value.replace(/\D/g, ""),
      endereco: document.getElementById("endereco").value.trim(),
      complemento: document.getElementById("complemento").value.trim(),
      cidade: document.getElementById("cidade").value.trim(),
      uf: document.getElementById("uf").value.trim(),

      conjuge_nome: document.getElementById("conjuge_nome").value.trim(),
      conjuge_nascimento:
        document.getElementById("conjuge_nascimento").value,

      dependente1_nome:
        document.getElementById("dependente1_nome").value.trim(),
      dependente1_nascimento:
        document.getElementById("dependente1_nascimento").value,
      dependente2_nome:
        document.getElementById("dependente2_nome").value.trim(),
      dependente2_nascimento:
        document.getElementById("dependente2_nascimento").value,
      dependente3_nome:
        document.getElementById("dependente3_nome").value.trim(),
      dependente3_nascimento:
        document.getElementById("dependente3_nascimento").value,

      aceite_estatuto: document.getElementById("aceite_estatuto").checked,
      aceite_lgpd: document.getElementById("aceite_lgpd").checked,
    };

    if (!payload.aceite_estatuto || !payload.aceite_lgpd) {
      mostrarMensagem(
        "É necessário aceitar o Estatuto e a autorização de dados.",
        true
      );
      return;
    }

    try {
      const resp = await fetch("/api/filiese", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new Error("Falha ao enviar solicitação");
      }

      const data = await resp.json().catch(() => ({}));

      mostrarMensagem(
        data.message ||
          "Solicitação registrada com sucesso. Verifique seu e-mail para baixar o PDF, assinar via Gov.br e enviar para sinprfes@sinprfes.org.br.",
        false
      );

      form.reset();
    } catch (err) {
      console.error(err);
      mostrarMensagem(
        "Erro ao enviar solicitação. Tente novamente mais tarde.",
        true
      );
    }
  });
});
