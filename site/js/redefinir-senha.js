// public/js/redefinir-senha.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reset-form");
  const msgEl = document.getElementById("reset-mensagem");

  // Lê token da querystring
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    if (msgEl) {
      msgEl.textContent = "Link inválido. Falta o token na URL.";
    }
    if (form) {
      form.style.display = "none";
    }
    return;
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msgEl.textContent = "";

      const senhaNova = document.getElementById("senha-nova").value;
      const senhaConfirma = document.getElementById("senha-confirma").value;

      if (!senhaNova || !senhaConfirma) {
        msgEl.textContent = "Preencha os dois campos de senha.";
        return;
      }

      if (senhaNova !== senhaConfirma) {
        msgEl.textContent = "As senhas não conferem.";
        return;
      }

      if (senhaNova.length < 6) {
        msgEl.textContent = "A senha deve ter pelo menos 6 caracteres.";
        return;
      }

      const btnSubmit = form.querySelector('button[type="submit"]');
      const originalBtnText = btnSubmit.innerHTML;

      try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "Salvando...";

        const resp = await fetch(window.API_BASE_URL + "/api/senha/resetar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            senha_nova: senhaNova,
          }),
        });

        const data = await resp.json();

        if (!resp.ok) {
          msgEl.textContent =
            data.error || "Erro ao redefinir a senha. Tente novamente.";
          return;
        }

        msgEl.textContent =
          data.message ||
          "Senha redefinida com sucesso. Você já pode voltar à tela de login.";

        // Opcional: redirecionar para login após alguns segundos
        setTimeout(() => {
          window.location.href = "/login.html";
        }, 4000);
      } catch (err) {
        console.error("Erro ao redefinir senha:", err);
        msgEl.textContent = "Erro de comunicação com o servidor.";
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
      }
    });
  }
});
