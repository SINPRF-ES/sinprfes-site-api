// public/js/recuperar-senha.js

document.addEventListener("DOMContentLoaded", () => {
  const forgotForm = document.getElementById("forgot-form");
  const resetForm = document.getElementById("reset-form");
  const msgEl = document.getElementById("mensagem");
  const titleEl = document.getElementById("page-title");
  const introEl = document.getElementById("page-intro");

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  // CPF Input mask
  const forgotCpfInput = document.getElementById("forgot-cpf");
  if (forgotCpfInput) {
    forgotCpfInput.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 11);
      if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
      else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
      e.target.value = v;
    });
  }

  if (token) {
    // Modo REDEFINIÇÃO
    titleEl.textContent = "Redefinir Senha";
    introEl.textContent = "Defina uma nova senha segura para sua conta FENAPRF.";
    forgotForm.style.display = "none";
    resetForm.style.display = "grid";

    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      msgEl.textContent = "";

      const senhaNova = document.getElementById("senha-nova").value;
      const senhaConfirma = document.getElementById("senha-confirma").value;

      if (senhaNova !== senhaConfirma) {
        msgEl.textContent = "As senhas não conferem.";
        return;
      }

      if (senhaNova.length < 6) {
        msgEl.textContent = "A senha deve ter pelo menos 6 caracteres.";
        return;
      }

      const btnSubmit = resetForm.querySelector('button[type="submit"]');
      const originalBtnText = btnSubmit.innerHTML;

      try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "Salvando...";

        const resp = await fetch("/api/senha/resetar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, senha_nova: senhaNova }),
        });

        const data = await resp.json();
        if (!resp.ok) {
          msgEl.textContent = data.error || "Erro ao redefinir a senha.";
          return;
        }

        msgEl.textContent = "Senha redefinida com sucesso! Redirecionando...";
        setTimeout(() => { window.location.href = "/login.html"; }, 3000);
      } catch (err) {
        msgEl.textContent = "Erro de comunicação com o servidor.";
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
      }
    });
  } else {
    // Modo SOLICITAÇÃO
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      msgEl.textContent = "";

      const cpf = forgotCpfInput.value.replace(/\D/g, "");
      if (cpf.length !== 11) {
        msgEl.textContent = "Informe um CPF válido.";
        return;
      }

      const btnSubmit = forgotForm.querySelector('button[type="submit"]');
      const originalBtnText = btnSubmit.innerHTML;

      try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "Enviando...";

        const resp = await fetch("/api/senha/recuperar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf }),
        });

        const data = await resp.json();
        msgEl.textContent = data.message || "Se o CPF estiver cadastrado, você receberá um e-mail com as instruções.";

        if (data.email_destino) {
            msgEl.textContent += ` Verifique o e-mail: ${data.email_destino}`;
        }
      } catch (err) {
        msgEl.textContent = "Erro de comunicação.";
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
      }
    });
  }
});
