// public/js/login.js

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const loginMsg = document.getElementById("login-mensagem");

  const forgotForm = document.getElementById("forgot-form");
  const forgotMsg = document.getElementById("forgot-mensagem");

  // Util: normaliza CPF
  function normalizarCpf(cpf) {
    return (cpf || "").replace(/\D/g, "");
  }

  // ==========================
  // LOGIN NORMAL
  // ==========================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginMsg.textContent = "";

      const cpfInput = document.getElementById("login-cpf");
      const senhaInput = document.getElementById("login-senha");

      const cpf = normalizarCpf(cpfInput.value);
      const senha = senhaInput.value;

      if (!cpf || !senha) {
        loginMsg.textContent = "Informe CPF e senha.";
        return;
      }

      try {
        const resp = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cpf, senha }),
        });

        const data = await resp.json();

        if (!resp.ok) {
          loginMsg.textContent = data.error || "Erro ao realizar login.";
          return;
        }

        // Salva token e perfil no localStorage
        if (data.token) {
          localStorage.setItem("token", data.token);
        }
        if (data.perfil_acesso) {
          localStorage.setItem("perfil_acesso", data.perfil_acesso);
        }

        // Redireciona para área do filiado
        window.location.href = "/area-filiado.html";
      } catch (err) {
        console.error("Erro no login:", err);
        loginMsg.textContent = "Erro de comunicação com o servidor.";
      }
    });
  }

  // ==========================
  // ESQUECI MINHA SENHA / PRIMEIRO ACESSO
  // ==========================
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      forgotMsg.textContent = "";

      const cpfInput = document.getElementById("forgot-cpf");
      const cpf = normalizarCpf(cpfInput.value);

      if (!cpf) {
        forgotMsg.textContent = "Informe o CPF.";
        return;
      }

      try {
        const resp = await fetch("/api/senha/recuperar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cpf }),
        });

        const data = await resp.json();

        if (!resp.ok) {
          forgotMsg.textContent =
            data.error || "Erro ao solicitar redefinição de senha.";
          return;
        }

        // Mensagem padrão
        let msg = data.message || "Solicitação registrada.";

        // Se o backend devolver o e-mail de destino, inclui na mensagem
        if (data.email_destino) {
          msg += ` E-mail de destino: ${data.email_destino}.`;
        }

        forgotMsg.textContent = msg;
      } catch (err) {
        console.error("Erro em esqueci minha senha:", err);
        forgotMsg.textContent = "Erro de comunicação com o servidor.";
      }
    });
  }
});
