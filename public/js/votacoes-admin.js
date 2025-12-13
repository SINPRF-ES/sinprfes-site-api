import { apiFetch } from "./utils.js";

const listaEl = document.getElementById("lista-votacoes");
const formCriar = document.getElementById("form-criar-votacao");

async function carregarVotacoes() {
  try {
    const r = await apiFetch("/api/votacoes");
    const votacoes = await r.json();

    if (!Array.isArray(votacoes) || !votacoes.length) {
      listaEl.innerHTML = "<p>Nenhuma votação encontrada.</p>";
      return;
    }

    listaEl.innerHTML = votacoes.map(v => {
      return `
        <div class="section-box" style="margin-bottom:10px;">
          <strong>${v.titulo}</strong><br/>
          Status: <b>${v.status}</b><br/>
          ${v.ja_votou ? "⚠️ Você já votou" : ""}
          <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-outline" data-action="abrir" data-id="${v.id}">Abrir</button>
            <button class="btn btn-outline" data-action="encerrar" data-id="${v.id}">Encerrar</button>
            <button class="btn btn-outline" data-action="resultado" data-id="${v.id}">Resultado</button>
          </div>
        </div>
      `;
    }).join("");

    configurarBotoes();
  } catch (e) {
    console.error(e);
    listaEl.innerHTML = "<p style='color:red;'>Erro ao carregar votações.</p>";
  }
}

function configurarBotoes() {
  listaEl.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === "abrir") {
        await apiFetch(`/api/votacoes/${id}/abrir`, { method: "POST" });
        alert("Votação aberta.");
      }

      if (action === "encerrar") {
        await apiFetch(`/api/votacoes/${id}/encerrar`, { method: "POST" });
        alert("Votação encerrada.");
      }

      if (action === "resultado") {
        const r = await apiFetch(`/api/votacoes/${id}/resultado`);
        const d = await r.json();

        alert(
          `Resultado:\n\n` +
          d.opcoes.map(o => `${o.texto}: ${o.votos}`).join("\n") +
          `\n\nTotal: ${d.total}`
        );
      }

      await carregarVotacoes();
    });
  });
}

formCriar.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fd = new FormData(formCriar);
  const titulo = fd.get("titulo");
  const descricao = fd.get("descricao");
  const opcoes = fd.get("opcoes")
    .split("\n")
    .map(o => o.trim())
    .filter(Boolean);

  if (opcoes.length < 2) {
    alert("Informe pelo menos duas opções.");
    return;
  }

  try {
    await apiFetch("/api/votacoes", {
      method: "POST",
      body: { titulo, descricao, opcoes }
    });

    alert("Votação criada.");
    formCriar.reset();
    await carregarVotacoes();
  } catch {
    alert("Erro ao criar votação.");
  }
});

// Auto-refresh (assembleia ao vivo)
setInterval(carregarVotacoes, 5000);

// Inicial
carregarVotacoes();
