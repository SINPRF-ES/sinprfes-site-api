// public/js/login.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = (window.Utils && window.Utils.resolveApiBase)
    ? window.Utils.resolveApiBase()
    : (window.API_BASE_URL || "").replace(/\/+$/, "");

  if (!API_BASE) {
    console.error("API_BASE não definido. Verifique config.js e utils.js");
    alert("Erro de configuração do sistema. Tente novamente mais tarde.");
    return;
  }

  const loginForm = document.getElementById("login-form");
  const loginMsg = document.getElementById("login-mensagem");

  const forgotForm = document.getElementById("forgot-form");
  const forgotMsg = document.getElementById("forgot-mensagem");

    // CPF só com números (login e esqueci a senha)
  const loginCpfInput = document.getElementById("login-cpf");
  const forgotCpfInput = document.getElementById("forgot-cpf");

  function aplicarMascaraCpf(input) {
    if (!input) return;

    const formatar = (val) => {
      // Se Formatters estiver carregado, usa a função canônica
      if (window.Formatters && window.Formatters.formatCpfLive) {
        return window.Formatters.formatCpfLive(val);
      }
      let v = String(val).replace(/\D/g, "").slice(0, 11);
      if (v.length <= 3) return v;
      if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
      if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
      return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
    };

    input.addEventListener("input", (e) => {
      const el = e.target;
      const start = el.selectionStart;
      const oldLen = el.value.length;
      el.value = formatar(el.value);
      const newLen = el.value.length;

      // Preserva cursor se estiver digitando no meio
      if (start !== null && start < oldLen) {
        el.setSelectionRange(start + (newLen - oldLen), start + (newLen - oldLen));
      }
    });

    if (input.value) input.value = formatar(input.value);
  }

  aplicarMascaraCpf(loginCpfInput);
  aplicarMascaraCpf(forgotCpfInput);

  // Campo extra para 2FA (se existir no HTML)
  const campo2fa = document.getElementById("campo-2fa");
  const inputToken2fa = document.getElementById("login-token-2fa");

  // Util: normaliza CPF
  function normalizarCpf(cpf) {
    return (cpf || "").replace(/\D/g, "");
  }

  // ==========================
  // AUTO-REDIRECT SE JÁ ESTIVER LOGADO
  // ==========================
  (async () => {
    const tokenExistente = localStorage.getItem("token");
    if (!tokenExistente) return;

    try {
      const resp = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          Authorization: "Bearer " + tokenExistente,
          "Content-Type": "application/json",
        },
      });

      if (resp.ok) {
        // Token válido → pula o login e vai direto pra Página Inicial
        window.location.href = "/area-filiado.html";
      } else if (resp.status === 401 || resp.status === 403) {
        // Token inválido/expirado → limpa e deixa o usuário logar de novo
        localStorage.removeItem("token");
        localStorage.removeItem("perfil_acesso");
      }
    } catch (err) {
      console.error("Erro ao verificar sessão existente:", err);
      // Em caso de erro de rede, apenas não redireciona; o usuário vê o login normalmente
    }
  })();

  // ==========================
  // LOGIN NORMAL + 2FA
  // ==========================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginMsg) {
        loginMsg.textContent = "";
      }

      const cpfInput = document.getElementById("login-cpf");
      const senhaInput = document.getElementById("login-senha");

      const cpf = normalizarCpf(cpfInput ? cpfInput.value : "");
      const senha = senhaInput ? senhaInput.value : "";

      if (!cpf || !senha) {
        if (loginMsg) {
          loginMsg.textContent = "Informe CPF e senha.";
        }
        return;
      }

      // Monta payload básico
      const payload = { cpf, senha };

      // Se o campo 2FA estiver visível e preenchido, envia também
      if (
        campo2fa &&
        campo2fa.style.display !== "none" &&
        inputToken2fa &&
        inputToken2fa.value.trim() !== ""
      ) {
        payload.token_2fa = inputToken2fa.value.trim();
      }

      const btnSubmit = loginForm.querySelector('button[type="submit"]');
      const originalBtnText = btnSubmit.innerHTML;

      try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "Entrando...";

        const resp = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          // Caso em que o backend exige 2FA
          if (data && data.requires_2fa) {
            if (campo2fa) {
              campo2fa.style.display = "block";
            }
            if (loginMsg) {
              loginMsg.textContent =
                data.error ||
                "Este usuário possui 2FA habilitado. Informe o código do aplicativo autenticador.";
            }
            // Foca no campo de 2FA, se existir
            if (inputToken2fa) {
              inputToken2fa.focus();
            }
            return;
          }

          if (loginMsg) {
            loginMsg.textContent =
              (data && data.error) ||
              "Erro ao realizar login. Verifique seus dados e tente novamente.";
          }
          return;
        }

        // Sucesso: salva token e perfil no localStorage
        if (data.token) {
          localStorage.setItem("token", data.token);
        }
        if (data.perfil_acesso) {
          localStorage.setItem("perfil_acesso", data.perfil_acesso);
        }

        if (loginMsg) {
          loginMsg.textContent =
            data.message || "Login realizado com sucesso. Redirecionando...";
        }

        // Redireciona para Página Inicial
        window.location.href = "/area-filiado.html";
      } catch (err) {
        console.error("Erro no login:", err);
        if (loginMsg) {
          loginMsg.textContent = "Erro de comunicação com o servidor.";
        }
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
      }
    });
  }

  // ==========================
  // ESQUECI MINHA SENHA / PRIMEIRO ACESSO
  // ==========================
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (forgotMsg) {
        forgotMsg.textContent = "";
      }

      const cpfInput = document.getElementById("forgot-cpf");
      const cpf = normalizarCpf(cpfInput ? cpfInput.value : "");

      if (!cpf) {
        if (forgotMsg) {
          forgotMsg.textContent = "Informe o CPF.";
        }
        return;
      }

      const btnSubmit = forgotForm.querySelector('button[type="submit"]');
      const originalBtnText = btnSubmit.innerHTML;

      try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "Enviando...";

        const resp = await fetch(`${API_BASE}/api/senha/recuperar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cpf }),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          if (forgotMsg) {
            forgotMsg.textContent =
              (data && data.error) ||
              "Erro ao solicitar redefinição de senha.";
          }
          return;
        }

        // Mensagem padrão
        let msg =
          (data && data.message) || "Solicitação registrada.";

        // Se o backend devolver o e-mail de destino, inclui na mensagem
        if (data && data.email_destino) {
          msg += ` E-mail de destino: ${data.email_destino}.`;
        }

        if (forgotMsg) {
          forgotMsg.textContent = msg;
        }
      } catch (err) {
        console.error("Erro em esqueci minha senha:", err);
        if (forgotMsg) {
          forgotMsg.textContent = "Erro de comunicação com o servidor.";
        }
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
      }
    });
  }
});
