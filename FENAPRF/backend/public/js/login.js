// public/js/login.js

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const loginMsg = document.getElementById("login-mensagem");

  const loginCpfInput = document.getElementById("login-cpf");

  function aplicarMascaraCpf(input) {
    if (!input) return;
    input.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 11);
      if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
      else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
      e.target.value = v;
    });
  }

  aplicarMascaraCpf(loginCpfInput);

  function normalizarCpf(cpf) {
    return (cpf || "").replace(/\D/g, "");
  }

    // ==========================
  // AUTO-REDIRECT SE JÁ ESTIVER LOGADO
  // ==========================
  (async () => {
    const raw = localStorage.getItem("token");
    const tokenExistente = (raw || "").trim();

    // Evita falso-positivo ("null", "undefined", "")
    if (!tokenExistente || tokenExistente === "null" || tokenExistente === "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("perfil_acesso");
      return;
    }

    try {
      const resp = await fetch("/api/auth/me", {
        headers: {
          Authorization: "Bearer " + tokenExistente,
          "Content-Type": "application/json",
        },
      });

      if (resp.ok) {
        window.location.replace("/portal/");
      } else if (resp.status === 401 || resp.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("perfil_acesso");
        return;
      }

      // Qualquer outro status: não redireciona
      return;
    } catch (err) {
      console.error("Erro ao verificar sessão existente:", err);
    }
  })();

  // ==========================
  // LOGIN
  // ==========================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginMsg) loginMsg.textContent = "";

      const cpf = normalizarCpf(loginCpfInput ? loginCpfInput.value : "");
      const senhaInput = document.getElementById("login-senha");
      const senha = senhaInput ? senhaInput.value : "";

      if (!cpf || !senha) {
        if (loginMsg) loginMsg.textContent = "Informe CPF e senha.";
        return;
      }

      const btnSubmit = loginForm.querySelector('button[type="submit"]');
      const originalBtnText = btnSubmit.innerHTML;

      try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "Entrando...";

        const resp = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf, senha }),
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          if (loginMsg) loginMsg.textContent = (data && data.error) || "Erro ao realizar login.";
          return;
        }

        // Limpa cache antigo antes de setar novo
        localStorage.removeItem("perfil_acesso");
        localStorage.removeItem("userInfo");

        if (data.token) localStorage.setItem("token", data.token);

        // Seta novo perfil vindo do login (fallback para perfil do user se existir)
        const novoPerfil = data.perfil_acesso || (data.user && data.user.perfil_acesso);
        if (novoPerfil) {
          localStorage.setItem("perfil_acesso", novoPerfil.toUpperCase());
        }

        window.location.replace("/portal/");
      } catch (err) {
        console.error("Erro no login:", err);
        if (loginMsg) loginMsg.textContent = "Erro de comunicação com o servidor.";
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
      }
    });
  }
});
