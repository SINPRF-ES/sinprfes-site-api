// public/js/config-2fa.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = (window.Utils && window.Utils.resolveApiBase)
    ? window.Utils.resolveApiBase()
    : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || "").replace(/\/+$/, "");

  const btnAtivar = document.getElementById("btn-ativar-2fa");
  const msg = document.getElementById("mensagem-2fa");
  const areaQr = document.getElementById("area-qr");
  const divQrCode = document.getElementById("qrcode");
  const secretEl = document.getElementById("secret-2fa");

  const token = localStorage.getItem("token");

  // Se o usuário não estiver logado, não pode ativar 2FA
  if (!token) {
    if (msg) {
      msg.textContent = "Você precisa estar logado para ativar o 2FA.";
    }
    setTimeout(() => {
      window.location.href = "/login.html";
    }, 2500);
    return;
  }

  // Clique para gerar 2FA
  btnAtivar.addEventListener("click", async () => {
    msg.textContent = "";

    try {
      const resp = await fetch(`${API_BASE}/api/auth/2fa/ativar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        msg.textContent =
          data.error || "Não foi possível ativar o 2FA. Tente novamente.";
        return;
      }

      const { message, secret_base32, otpauth_url } = data;

      msg.textContent =
        message || "2FA ativado com sucesso. Configure no autenticador.";

      // Mostra a área com o QR Code
      areaQr.style.display = "block";

      // Limpa QR anterior, se existir
      divQrCode.innerHTML = "";

      // Gera QR Code com contraste perfeito + quiet zone
      new QRCode(divQrCode, {
        text: otpauth_url,
        width: 280,
        height: 280,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
      });

      // Exibe chave manual
      secretEl.textContent = secret_base32 || "Não informado";

      // Habilita botão de copiar
      const btnCopiar = document.getElementById("btn-copiar-secret");
      if (btnCopiar && secret_base32) {
        btnCopiar.style.display = "inline-flex";
        btnCopiar.onclick = () => {
          navigator.clipboard.writeText(secret_base32).then(() => {
            const originalText = btnCopiar.textContent;
            btnCopiar.textContent = "✅ Copiado!";
            setTimeout(() => {
              btnCopiar.textContent = originalText;
            }, 2000);
          }).catch(err => {
            console.error("Erro ao copiar:", err);
          });
        };
      }

    } catch (err) {
      console.error("Erro ao ativar 2FA:", err);
      msg.textContent =
        "Erro ao comunicar com o servidor. Tente novamente em instantes.";
    }
  });
});
