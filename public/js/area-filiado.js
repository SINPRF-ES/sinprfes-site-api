// public/js/area-filiado.js

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("area-filiado-conteudo");
  const btnLogout = document.getElementById("btn-logout");

  const token = localStorage.getItem("token");

  // Se não tiver token, volta pro login
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  // Logout: limpa storage e volta pro login
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("perfil_acesso");
      window.location.href = "/login.html";
    });
  }

  // Busca /api/filiados/me
  carregarMeusDados(token, container);
});

async function carregarMeusDados(token, container) {
  try {
    const resp = await fetch("/api/filiados/me", {
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
      },
    });

    if (resp.status === 401 || resp.status === 403) {
      // Token inválido/expirado → força login de novo
      localStorage.removeItem("token");
      localStorage.removeItem("perfil_acesso");
      window.location.href = "/login.html";
      return;
    }

    if (!resp.ok) {
      container.innerHTML = `<p style="color:#ff7675;">Erro ao carregar seus dados.</p>`;
      return;
    }

    const dados = await resp.json();

    // Monta visual simples (por enquanto só leitura)
    container.innerHTML = `
      <div class="section-box">
        <p><strong>Nome:</strong> ${dados.nome || ""}</p>
        <p><strong>CPF:</strong> ${dados.cpf || ""}</p>
        <p><strong>Situação:</strong> ${dados.situacao || ""}</p>
        <p><strong>Perfil de acesso:</strong> ${dados.perfil_acesso || "-"}</p>
      </div>

      <div class="section-box" style="margin-top: 10px;">
        <p><strong>Telefone 1:</strong> ${dados.telefone1 || ""}</p>
        <p><strong>Telefone 2:</strong> ${dados.telefone2 || ""}</p>
        <p><strong>E-mail principal:</strong> ${dados.email1 || ""}</p>
        <p><strong>E-mail alternativo:</strong> ${dados.email2 || ""}</p>
        <p><strong>Endereço:</strong> ${dados.endereco || ""}</p>
      </div>

      <p class="field-hint" style="margin-top:10px;">
        Em breve será possível atualizar diretamente seus dados aqui.
      </p>
    `;
  } catch (err) {
    console.error("Erro ao carregar /api/filiados/me:", err);
    container.innerHTML = `<p style="color:#ff7675;">Erro de comunicação com o servidor.</p>`;
  }
}
