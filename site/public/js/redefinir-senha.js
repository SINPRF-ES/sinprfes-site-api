// public/js/redefinir-senha.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = (window.Utils && window.Utils.resolveApiBase)
    ? window.Utils.resolveApiBase()
    : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || "").replace(/\/+$/, "");

  const form = document.getElementById("reset-form");
  const msgEl = document.getElementById("reset-mensagem");

  const exibirMensagem = (el, texto, tipo) => window.Utils && window.Utils.exibirMensagem(el, texto, tipo);

  // Lê token da querystring
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  // Palette: Inicializa toggle de visibilidade de senha
  if (window.Utils && window.Utils.initPasswordToggles) {
    window.Utils.initPasswordToggles();
  }

  if (!token) {
    exibirMensagem(msgEl, "Link inválido. O token de recuperação de senha não foi encontrado na URL.", "danger");
    if (form) {
      form.style.display = "none";
    }
    return;
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      exibirMensagem(msgEl, "");

      const senhaNova = document.getElementById("senha-nova").value;
      const senhaConfirma = document.getElementById("senha-confirma").value;

      if (!senhaNova || !senhaConfirma) {
        exibirMensagem(msgEl, "Preencha os dois campos de senha.");
        return;
      }

      if (senhaNova !== senhaConfirma) {
        exibirMensagem(msgEl, "As senhas não conferem.");
        return;
      }

      if (senhaNova.length < 6) {
        exibirMensagem(msgEl, "A senha deve ter pelo menos 6 caracteres.");
        return;
      }

      const btnSubmit = form.querySelector('button[type="submit"]');
      const originalBtnText = btnSubmit.innerHTML;

      try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span aria-hidden="true" class="ui-spinner"></span> Salvando...';
        btnSubmit.setAttribute("aria-busy", "true");

        const resp = await fetch(`${API_BASE}/api/senha/resetar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            senha_nova: senhaNova,
          }),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          exibirMensagem(msgEl, data.error || "Erro ao redefinir a senha. Tente novamente.");
          return;
        }

        exibirMensagem(msgEl, data.message || "Senha redefinida com sucesso. Redirecionando para a tela de login...", "success");

        // Redirecionar para login após alguns segundos
        setTimeout(() => {
          window.location.href = "/login.html";
        }, 4000);
      } catch (err) {
        console.error("Erro ao redefinir senha:", err);
        exibirMensagem(msgEl, "Erro de comunicação com o servidor.");
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
        btnSubmit.removeAttribute("aria-busy");
      }
    });
  }
});
