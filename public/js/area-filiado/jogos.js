import { apiFetch, formatarTelefoneTexto } from './utils.js';

const PERFIS_GERENCIA = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"];

// ===============================
// Estado de ordenação (gestão)
// ===============================
const ordenacaoEstado = {
  indice: null,
  direcao: "asc" // "asc" | "desc"
};

// ===============================
// Helpers: idade (considerando ano-base 2026)
// ===============================
function calcularIdade2026(dataNascimento) {
  if (!dataNascimento) return "-";

  // Aceita: "YYYY", "YYYY-MM-DD", ISO completo, Date
  let ano = NaN;

  if (typeof dataNascimento === "number") {
    ano = dataNascimento;
  } else if (dataNascimento instanceof Date) {
    ano = dataNascimento.getFullYear();
  } else if (typeof dataNascimento === "string") {
    const s = dataNascimento.trim();
    // Se for apenas ano
    if (/^\d{4}$/.test(s)) {
      ano = parseInt(s, 10);
    } else {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) {
        ano = d.getFullYear();
      } else {
        // tenta extrair ano inicial
        const m = s.match(/(\d{4})/);
        if (m) ano = parseInt(m[1], 10);
      }
    }
  }

  if (!Number.isFinite(ano) || ano <= 0) return "-";
  return 2026 - ano;
}

// ===============================
// Exportação CSV (compatível com Excel PT-BR)
// ===============================
function exportarTabelaCSV(tabelaEl) {
  if (!tabelaEl) return;

  const linhas = tabelaEl.querySelectorAll("tr");
  const csvData = [];

  // BOM para Excel reconhecer acentuação
  csvData.push("\uFEFF");

  linhas.forEach((linha) => {
    const cols = linha.querySelectorAll("td, th");
    const linhaCsv = [];
    cols.forEach((col) => {
      let texto = (col.innerText || "").replace(/"/g, '""'); // Escapa aspas
      if (texto.search(/("|;|\n)/g) >= 0) texto = `"${texto}"`;
      linhaCsv.push(texto);
    });
    csvData.push(linhaCsv.join(";")); // ; para Excel PT-BR
  });

  const blob = new Blob([csvData.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "Inscritos_Jogos_2026.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// ===============================
// Ordenação de tabela
// ===============================
function ordenarTabela(tabelaEl, indiceColuna) {
  if (!tabelaEl) return;
  const tbody = tabelaEl.querySelector("tbody");
  if (!tbody) return;

  const linhas = Array.from(tbody.querySelectorAll("tr"));
  if (linhas.length <= 1) return;

  // Toggle direção
  if (ordenacaoEstado.indice === indiceColuna) {
    ordenacaoEstado.direcao = ordenacaoEstado.direcao === "asc" ? "desc" : "asc";
  } else {
    ordenacaoEstado.indice = indiceColuna;
    ordenacaoEstado.direcao = "asc";
  }

  // Atualiza classes visuais das setas
  const ths = Array.from(tabelaEl.querySelectorAll("thead th"));
  ths.forEach((th, idx) => {
    th.classList.remove("sort-asc", "sort-desc");
    if (idx === ordenacaoEstado.indice) {
      th.classList.add(ordenacaoEstado.direcao === "asc" ? "sort-asc" : "sort-desc");
    }
  });

  const dir = ordenacaoEstado.direcao;

  const norm = (v) => (v || "").toString().trim().toLowerCase();

  linhas.sort((a, b) => {
    const ca = a.children[indiceColuna]?.innerText ?? "";
    const cb = b.children[indiceColuna]?.innerText ?? "";

    const va = norm(ca);
    const vb = norm(cb);

    // Tenta numérico (idade, fam, etc.)
    const na = parseFloat(va.replace(",", "."));
    const nb = parseFloat(vb.replace(",", "."));

    let comp = 0;
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      comp = na - nb;
    } else {
      comp = va.localeCompare(vb, "pt-BR");
    }
    return dir === "asc" ? comp : comp * -1;
  });

  // Reaplica no DOM
  tbody.innerHTML = "";
  linhas.forEach((tr) => tbody.appendChild(tr));
}

// ===============================
// Inicialização pública
// ===============================
export function inicializarJogos(perfilAcesso) {
  const secJogos = document.getElementById("sec-jogos");
  if (!secJogos) return;

  const mainContent = secJogos.querySelector(".section-card");
  if (!mainContent) return;
  mainContent.innerHTML = "";

  const perfil = (perfilAcesso || "").toUpperCase();

  // 1) Container do Formulário (visível para todos)
  const containerForm = document.createElement("div");
  mainContent.appendChild(containerForm);
  renderizarFormulario(containerForm);

  // 2) Lista de Inscritos (somente gestão)
  if (PERFIS_GERENCIA.includes(perfil)) {
    const hr = document.createElement("hr");
    hr.style.cssText =
      "margin: 32px 0 24px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.25)";
    mainContent.appendChild(hr);

    const headerAdmin = document.createElement("div");
    headerAdmin.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <h3 class="section-subtitle" style="color: #f1c40f; font-size: 1.6rem; font-weight: bold;">
          📋 Área de Gestão – Inscritos nos Jogos
        </h3>
        <p class="field-hint">Visualização exclusiva para: <strong>${perfil}</strong></p>
      </div>`;
    mainContent.appendChild(headerAdmin);

    const containerLista = document.createElement("div");
    containerLista.className = "jogos-container-lista";
    mainContent.appendChild(containerLista);

    renderizarLista(containerLista);
  }
}

function renderizarFormulario(container) {
  // CSS específico dos Jogos (tabela + formulário + resumo)
  if (!document.getElementById("style-jogos")) {
    const s = document.createElement("style");
    s.id = "style-jogos";
    s.textContent = `
      .jogos-container { max-width: 100%; margin: 0 auto; }

      /* Deixa a área de lista “expandir” para fora do padding do card */
      .jogos-container-lista {
        width: 100%;
        margin: 0 -24px 0 -24px; /* compensa o padding do .section-card */
        padding: 0 0 24px 0;
      }

      /* Cards brancos com texto escuro */
      .categoria-card {
        background: #ffffff;
        color: #333333;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        padding: 25px;
        margin-bottom: 25px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.05);
      }

      .categoria-titulo {
        font-size: 1.2rem;
        color: #2c3e50;
        border-bottom: 2px solid #f0f0f0;
        padding-bottom: 10px;
        margin-bottom: 20px;
        font-weight: bold;
      }

      .opcoes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 15px;
      }

      /* Checkbox grande e visível */
      .destaque-adesao {
        background: #f0f7ff;
        color: #004085;
        border: 1px solid #b8daff;
        padding: 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 30px;
        cursor: pointer;
        font-size: 1.1rem;
        font-weight: 600;
      }
      .destaque-adesao input {
        transform: scale(1.5);
        cursor: pointer;
      }

      .categoria-card select,
      .categoria-card textarea,
      .categoria-card input[type="text"] {
        width: 100%;
        padding: 12px;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 1rem;
        color: #333;
        background-color: #fff;
        font-family: inherit;
      }
      .categoria-card textarea { resize: vertical; line-height: 1.5; }

      .btn-danger { background: transparent; border: 1px solid #c0392b; color: #c0392b; margin-left: 15px; }
      .btn-danger:hover { background: #c0392b; color: #fff; }

      .jogos-resumo-card {
        background: #0b1728;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.15);
        padding: 14px 16px;
        margin-top: 16px;
        font-size: 0.9rem;
        color: #e0e7ff;
        text-align: left;
      }
      .jogos-resumo-card strong { color: #f1c40f; }
      .jogos-resumo-card small { color: #a0aec0; }

      /* Tabela com bordas em amarelo e tema escuro */
      .tabela-jogos {
        width: 100%;
        border-collapse: collapse;
        min-width: 980px;
        background-color: transparent;
        border: 1px solid var(--amarelo);
      }

      .tabela-jogos th {
        background: #003366;
        color: #ffffff;
        padding: 10px 12px;
        text-align: center !important;
        vertical-align: middle !important;
        font-size: 0.85rem;
        border-bottom: 2px solid var(--amarelo);
        cursor: pointer;
        user-select: none;
        position: relative;
      }
      .tabela-jogos th:hover { background-color: #004080; }

      /* Setas de ordenação */
      .tabela-jogos th.sort-asc::after { content: " 🔼"; position: absolute; right: 6px; font-size: 0.7rem; }
      .tabela-jogos th.sort-desc::after { content: " 🔽"; position: absolute; right: 6px; font-size: 0.7rem; }

      .tabela-jogos td {
        padding: 8px 12px;
        border-top: 1px solid rgba(241,196,15,0.25);
        border-right: 1px solid rgba(241,196,15,0.20);
        color: var(--texto-claro);
        background-color: rgba(0, 0, 0, 0.2);
        vertical-align: middle !important;
        white-space: normal;
        word-wrap: break-word;
        font-size: 0.85rem;
      }

      .tabela-jogos th:last-child,
      .tabela-jogos td:last-child { border-right: none; }

      .tabela-jogos tr:nth-child(even) td { background-color: rgba(0, 0, 0, 0.4); }
      .tabela-jogos tr:hover td { background-color: rgba(0, 24, 69, 0.6); }

      /* Coluna 1 (Nome) */
      .tabela-jogos th:nth-child(1),
      .tabela-jogos td:nth-child(1) {
        white-space: nowrap;
        width: 1%;
        text-align: left;
      }

      /* Coluna 2 (Idade) */
      .tabela-jogos th:nth-child(2),
      .tabela-jogos td:nth-child(2) {
        text-align: center;
        width: 60px;
        white-space: nowrap;
      }

      /* Coluna 3 (Sexo) */
      .tabela-jogos th:nth-child(3),
      .tabela-jogos td:nth-child(3) {
        text-align: center;
        width: 90px;
        white-space: nowrap;
      }

      /* Coluna 4 (Telefone) */
      .tabela-jogos th:nth-child(4),
      .tabela-jogos td:nth-child(4) {
        text-align: center;
        width: 140px;
        white-space: nowrap;
      }

      /* Coluna 6 (Fam.) */
      .tabela-jogos th:nth-child(6),
      .tabela-jogos td:nth-child(6) {
        text-align: center;
        width: 60px;
        white-space: nowrap;
      }

      /* Wrapper que expande a tabela além do card */
      .tabela-full-wrapper {
        position: relative;
        left: 50%;
        transform: translateX(-50%);
        width: 100vw;
        max-width: 1600px;
        padding: 0;
        margin: 0;
      }

      .tabela-scroll {
        overflow-x: auto;
        padding-bottom: 12px;
        position: relative;
      }

      .tabela-full-wrapper .tabela-jogos { width: 100%; }

      .tabela-jogos thead th {
        position: sticky;
        top: 0;
        z-index: 5;
      }

      .btn-export {
        background-color: #27ae60;
        color: white;
        padding: 8px 16px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
        font-size: 0.9rem;
        margin-top: 10px;
      }
      .btn-export:hover { background-color: #219150; }

      @media (max-width: 600px) {
        .opcoes-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(s);
  }

  // Formulário (idêntico ao código estável)
  container.innerHTML = `
    <div class="jogos-container">
      <header style="text-align: center; margin-bottom: 30px;">
        <h2 style="font-size: 2rem; color: #e67e22; margin-bottom: 5px;">
          🏅 Jogos de Integração PRF 2026
        </h2>
        <p style="font-size: 1.1rem; color: #aaa;">
          📍 Poços de Caldas - MG (12 a 17/04/2026)
        </p>
      </header>

      <form id="form-inscricao-jogos">
        <label class="destaque-adesao">
          <input type="checkbox" id="interesse" />
          <span>Desejo integrar a delegação do SINPRF-ES</span>
        </label>

        <div class="categoria-card">
          <div class="categoria-titulo">👤 Dados do Participante</div>
          <div style="max-width: 300px;">
            <label style="display:block; margin-bottom:5px; font-weight:bold;">
              Sexo (Para categorias esportivas):
            </label>
            <select id="sexo">
              <option value="">Selecione...</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          </div>
        </div>

        <div class="categoria-card">
          <div class="categoria-titulo">🏃 1. Atletismo</div>
          <div class="opcoes-grid">
            <label><input type="checkbox" name="modalidades" value="Atletismo 100m"> 100m</label>
            <label><input type="checkbox" name="modalidades" value="Atletismo 400m"> 400m</label>
            <label><input type="checkbox" name="modalidades" value="Atletismo 1500m"> 1500m</label>
            <label><input type="checkbox" name="modalidades" value="Atletismo 5000m"> 5000m</label>
          </div>
        </div>

        <div class="categoria-card">
          <div class="categoria-titulo">🏊 10. Natação</div>
          <div class="opcoes-grid">
            <label><input type="checkbox" name="modalidades" value="Natação 50m Livre"> 50m Livre</label>
            <label><input type="checkbox" name="modalidades" value="Natação 50m Costas"> 50m Costas</label>
            <label><input type="checkbox" name="modalidades" value="Natação 50m Peito"> 50m Peito</label>
            <label><input type="checkbox" name="modalidades" value="Natação 50m Borboleta"> 50m Borboleta</label>
            <label><input type="checkbox" name="modalidades" value="Natação Rev. 4x50m Livre"> Rev. 4x50m Livre</label>
            <label><input type="checkbox" name="modalidades" value="Natação Rev. 2x50m Misto"> Rev. 2x50m Misto</label>
          </div>
        </div>

        <div class="categoria-card">
          <div class="categoria-titulo">⚽ Esportes Coletivos e Quadra</div>
          <div class="opcoes-grid">
            <label><input type="checkbox" name="modalidades" value="Futebol Society (Livre)"> Fut. Society (Livre)</label>
            <label><input type="checkbox" name="modalidades" value="Futebol Society Master (55+)"> Fut. Society Master (55+)</label>
            <label><input type="checkbox" name="modalidades" value="Futsal (Livre)"> Futsal (Livre)</label>
            <label><input type="checkbox" name="modalidades" value="Voleibol (Livre)"> Voleibol (Livre)</label>
            <label><input type="checkbox" name="modalidades" value="Voleibol de Praia"> Vôlei de Praia</label>
            <label><input type="checkbox" name="modalidades" value="Futevôlei"> Futevôlei</label>
            <label><input type="checkbox" name="modalidades" value="Beach Tennis"> Beach Tennis</label>
            <label><input type="checkbox" name="modalidades" value="Tênis de Quadra"> Tênis de Quadra</label>
          </div>
        </div>

        <div class="categoria-card">
          <div class="categoria-titulo">🎱 Jogos de Salão e Outros</div>
          <div class="opcoes-grid">
            <label><input type="checkbox" name="modalidades" value="Tiro (NRA/IPSC)"> Tiro (NRA/IPSC)</label>
            <label><input type="checkbox" name="modalidades" value="Jiu-Jitsu"> Jiu-Jitsu</label>
            <label><input type="checkbox" name="modalidades" value="Tênis de Mesa"> Tênis de Mesa</label>
            <label><input type="checkbox" name="modalidades" value="Sinuca"> Sinuca</label>
            <label><input type="checkbox" name="modalidades" value="Xadrez"> Xadrez</label>
            <label><input type="checkbox" name="modalidades" value="Truco"> Truco</label>
            <label><input type="checkbox" name="modalidades" value="Canastra"> Canastra</label>
            <label><input type="checkbox" name="modalidades" value="Dominó"> Dominó</label>
          </div>
        </div>

        <div class="categoria-card" style="background-color: #f8f9fa;">
          <div class="categoria-titulo" style="color: #666;">🏳️ Exibição (Sem pontuação)</div>
          <div class="opcoes-grid">
            <label><input type="checkbox" name="modalidades" value="Exibição: Peteca"> Peteca</label>
            <label><input type="checkbox" name="modalidades" value="Exibição: Damas"> Damas</label>
            <label><input type="checkbox" name="modalidades" value="Exibição: Bocha"> Bocha</label>
          </div>
        </div>

        <div class="categoria-card">
          <div class="categoria-titulo">👨‍👩‍👧‍👦 Familiares</div>

          <div style="margin-bottom: 15px; max-width: 300px;">
            <label style="font-weight: bold; display: block; margin-bottom: 5px;">
              Quantidade de familiares:
            </label>
            <select id="qtd_familiares">
              <option value="0">0 (Nenhum)</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
            </select>
          </div>

          <label style="font-weight: bold; display: block; margin-bottom: 5px;">
            Nomes dos familiares (um por linha):
          </label>
          <textarea id="familiares" rows="6" placeholder="Exemplo:
Maria da Silva (Esposa)
Joãozinho (Filho)"></textarea>
        </div>

        <div class="categoria-card">
          <div class="categoria-titulo">📝 Observações Adicionais</div>
          <label style="font-weight: bold; display: block; margin-bottom: 5px;">
            Informações extras:
          </label>
          <textarea id="obs" rows="5" placeholder="Tamanho da camisa, restrições alimentares, dúvidas, etc..."></textarea>
        </div>

        <div class="form-actions" style="margin-top: 40px; text-align: center;">
          <button class="btn btn-primary btn-lg" type="submit" style="padding: 12px 40px; font-size: 1.1rem;">
            ✅ Confirmar Inscrição
          </button>

          <button type="button" id="btn-cancelar-inscricao" class="btn btn-danger btn-lg" style="padding: 12px 25px; font-size: 1rem;">
            ❌ Cancelar Inscrição
          </button>

          <div id="jogos-status" class="field-hint" style="margin-top: 15px; font-weight: bold; font-size: 1rem;"></div>

          <!-- Painel de resumo da inscrição do próprio filiado -->
          <div id="jogos-resumo-inscricao" class="jogos-resumo-card" style="display:none; margin-top: 12px;"></div>
        </div>
      </form>
    </div>`;

  const form = container.querySelector("#form-inscricao-jogos");
  const statusEl = container.querySelector("#jogos-status");
  const btnCancelar = container.querySelector("#btn-cancelar-inscricao");

  // Carregar inscrição existente do próprio filiado (se houver)
  carregarMinhaInscricao(form).catch((e) => {
    console.error("Erro ao carregar inscrição atual:", e);
  });

  // Cancelar inscrição
  if (btnCancelar) {
    btnCancelar.addEventListener("click", async () => {
      if (!confirm("Tem certeza que deseja CANCELAR sua inscrição nos Jogos?")) return;

      if (statusEl) {
        statusEl.textContent = "Cancelando...";
        statusEl.style.color = "orange";
      }

      try {
        const r = await apiFetch("/api/jogos/inscricao", { method: "DELETE" });

        if (!r) {
          if (statusEl) {
            statusEl.textContent = "Erro de autenticação ou sessão expirada.";
            statusEl.style.color = "#c0392b";
          }
          return;
        }

        if (r.ok) {
          if (statusEl) {
            statusEl.textContent = "Inscrição cancelada com sucesso.";
            statusEl.style.color = "red";
          }

          // Limpa o formulário visualmente
          form.reset();

          const sexoSel = document.getElementById("sexo");
          const qtdFamSel = document.getElementById("qtd_familiares");
          if (sexoSel) sexoSel.value = "";
          if (qtdFamSel) qtdFamSel.value = "0";

          const interesse = document.getElementById("interesse");
          if (interesse) interesse.checked = false;

          const resumoEl = document.getElementById("jogos-resumo-inscricao");
          if (resumoEl) {
            resumoEl.style.display = "none";
            resumoEl.innerHTML = "";
          }

          // Se existir painel de lista (gestão), recarrega
          const containerLista = document.querySelector(".jogos-container-lista");
          if (containerLista) {
            renderizarLista(containerLista);
          }
        } else {
          const detalhes = await r.text().catch(() => "");
          console.error("Erro ao cancelar inscrição:", r.status, detalhes);
          if (statusEl) {
            statusEl.textContent = "Erro ao cancelar inscrição.";
            statusEl.style.color = "#c0392b";
          }
        }
      } catch (e) {
        console.error("Exceção ao cancelar inscrição:", e);
        if (statusEl) {
          statusEl.textContent = "Erro de conexão.";
          statusEl.style.color = "#c0392b";
        }
      }
    });
  }

  // Enviar inscrição
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const interesse = form.querySelector("#interesse");
    if (!interesse?.checked) {
      if (statusEl) {
        statusEl.textContent = "⚠️ Marque a caixa 'Desejo integrar a delegação' no topo.";
        statusEl.style.color = "#c0392b";
      }
      interesse?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const mods = Array.from(form.querySelectorAll("input[name='modalidades']:checked")).map(
      (m) => m.value
    );
    if (mods.length === 0) {
      if (statusEl) {
        statusEl.textContent = "⚠️ Selecione ao menos uma modalidade.";
        statusEl.style.color = "#c0392b";
      }
      return;
    }

    const sexo = form.querySelector("#sexo")?.value;
    if (!sexo) {
      if (statusEl) {
        statusEl.textContent = "⚠️ Informe seu Sexo para as categorias esportivas.";
        statusEl.style.color = "#c0392b";
      }
      form.querySelector("#sexo")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const payload = {
      modalidades: mods,
      observacoes: form.querySelector("#obs")?.value,
      familiares: form.querySelector("#familiares")?.value,
      qtd_familiares: form.querySelector("#qtd_familiares")?.value,
      sexo: sexo
    };

    if (statusEl) {
      statusEl.textContent = "Enviando...";
      statusEl.style.color = "#333";
    }

    try {
      const r = await apiFetch("/api/jogos/inscricao", { method: "POST", body: payload });
      if (r && r.ok) {
        if (statusEl) {
          statusEl.textContent = "🎉 Inscrição confirmada com sucesso!";
          statusEl.style.color = "#27ae60";
        }

        // Recarrega o resumo do próprio filiado
        await carregarMinhaInscricao(form);

        // Atualiza lista de gestão, se existir
        const containerLista = document.querySelector(".jogos-container-lista");
        if (containerLista) {
          renderizarLista(containerLista);
        }
      } else {
        if (statusEl) {
          statusEl.textContent = "Erro ao salvar inscrição.";
          statusEl.style.color = "#c0392b";
        }
      }
    } catch (e) {
      console.error(e);
      if (statusEl) {
        statusEl.textContent = "Erro de conexão.";
        statusEl.style.color = "#c0392b";
      }
    }
  });
}

/**
 * Carrega a inscrição do próprio filiado (GET /api/jogos/inscricao)
 * e:
 *   - pré-preenche o formulário
 *   - mostra um resumo numa caixinha logo abaixo dos botões
 */
async function carregarMinhaInscricao(form) {
  try {
    const r = await apiFetch("/api/jogos/inscricao", { method: "GET" });

    // Se o backend retornar 404, apenas não mostra nada
    if (!r || !r.ok) return;

    const data = await r.json().catch(() => null);
    if (!data) return;

    const interesse = form.querySelector("#interesse");
    const sexoEl = form.querySelector("#sexo");
    const qtdFamEl = form.querySelector("#qtd_familiares");
    const famEl = form.querySelector("#familiares");
    const obsEl = form.querySelector("#obs");

    if (interesse) interesse.checked = true;
    if (sexoEl) sexoEl.value = data.sexo || "";
    if (qtdFamEl) qtdFamEl.value = String(data.qtd_familiares || "0");
    if (famEl) famEl.value = data.familiares || "";
    if (obsEl) obsEl.value = data.observacoes || "";

    // marca modalidades
    const mods = Array.isArray(data.modalidades) ? data.modalidades : [];
    form.querySelectorAll("input[name='modalidades']").forEach((chk) => {
      chk.checked = mods.includes(chk.value);
    });

    // Monta resumo
    const resumo = document.getElementById("jogos-resumo-inscricao");
    if (resumo) {
      const listaMods = mods.length ? mods.join(", ") : "Nenhuma modalidade marcada.";
      const listaFam = (data.familiares || "").trim()
        ? data.familiares.replace(/\n/g, "<br>")
        : "Sem familiares cadastrados.";
      const obs = (data.observacoes || "").trim()
        ? data.observacoes.replace(/\n/g, "<br>")
        : "Sem observações adicionais.";

      resumo.innerHTML = `
        <div style="margin-bottom:4px;">
          <strong>Situação atual da sua inscrição:</strong>
        </div>
        <div style="margin-bottom:6px;">
          <small>Você já possui inscrição registrada. Pode ajustar o formulário acima e clicar em <strong>Confirmar Inscrição</strong> para atualizar.</small>
        </div>
        <div style="margin-top:6px;">
          <strong>Modalidades:</strong><br>${listaMods}
        </div>
        <div style="margin-top:6px;">
          <strong>Familiares (${data.qtd_familiares || 0}):</strong><br>${listaFam}
        </div>
        <div style="margin-top:6px;">
          <strong>Observações adicionais:</strong><br>${obs}
        </div>
      `;
      resumo.style.display = "block";
    }
  } catch (e) {
    console.error("Erro ao carregar minha inscrição:", e);
  }
}

async function renderizarLista(container) {
  console.log("➡️ renderizarLista() iniciada");

  container.innerHTML = '<p style="color:#fff;">Carregando lista...</p>';

  try {
    const r = await apiFetch("/api/jogos/inscricoes");
    console.log("Resposta bruta do fetch:", r);

    if (!r) {
      console.log("❌ apiFetch retornou null/undefined");
      container.innerHTML = "<p style='color:#f88;'>Erro: resposta inválida.</p>";
      return;
    }

    if (!r.ok) {
      console.log("❌ Resposta HTTP não OK:", r.status);
      const texto = await r.text().catch(() => "(sem detalhes)");
      console.log("Corpo do erro:", texto);
      container.innerHTML = `<p style='color:#f88;'>Erro ${r.status}: não foi possível carregar inscritos.</p>`;
      return;
    }

    const data = await r.json().catch((e) => {
      console.log("❌ Erro ao fazer .json():", e);
      return null;
    });

    console.log("📦 JSON retornado pelo servidor:", data);

    if (!data) {
      container.innerHTML = "<p style='color:#f88;'>Erro ao interpretar resposta.</p>";
      return;
    }

    const lista = Array.isArray(data.inscricoes)
      ? data.inscricoes
      : Array.isArray(data)
      ? data
      : [];

    console.log("📋 Lista interpretada:", lista);

    if (lista.length === 0) {
      container.innerHTML = "<p style='text-align:center; color:#fff;'>Nenhuma inscrição encontrada.</p>";
      return;
    }

    const totalTit = lista.length;
    const totalFam = lista.reduce((acc, c) => acc + (parseInt(c.qtd_familiares, 10) || 0), 0);

    const rows = lista
      .map((i) => {
        const idade = calcularIdade2026(i.data_nascimento ?? i.ano_nascimento ?? i.nascimento ?? i.dataNascimento ?? i.anoNascimento);
        return `
          <tr>
            <td><strong>${i.nome_filiado || "-"}</strong></td>
            <td style="text-align:center;">${idade}</td>
            <td style="text-align:center;">${i.sexo || "-"}</td>
            <td style="text-align:center;">${formatarTelefoneTexto(i.telefone1) || "-"}</td>
            <td>${(i.modalidades || []).join(", ")}</td>
            <td style="text-align:center;">${i.qtd_familiares || 0}</td>
            <td>${i.familiares ? i.familiares.replace(/\n/g, "<br>") : ""}</td>
            <td>${i.observacoes ? i.observacoes.replace(/\n/g, "<br>") : ""}</td>
          </tr>
        `;
      })
      .join("");

    console.log("🧱 HTML gerado para linhas:", rows);

    container.innerHTML = `
      <div class="tabela-full-wrapper">

        <!-- Resumo superior -->
        <div style="
          background:#003366;
          color:#fff;
          padding:16px 20px;
          border-radius:10px;
          margin: 0 0 20px 0;
          border:1px solid var(--amarelo);
          font-size:1rem;
          text-align:center;
        ">
          <div style="font-size:1.1rem; font-weight:600;">
            Inscritos: <strong>${totalTit}</strong> titulares &nbsp;+&nbsp; <strong>${totalFam}</strong> familiares
          </div>
          <div style="
            margin-top:10px;
            border-top:1px solid rgba(255,255,255,0.3);
            padding-top:10px;
            color:var(--amarelo);
            font-size:1.3rem;
          ">
            <strong>Total Geral: ${totalTit + totalFam} Pessoas</strong>
          </div>

          <button type="button" id="btn-export-csv" class="btn-export">📊 Exportar Excel (CSV)</button>
        </div>

        <!-- Tabela -->
        <div class="tabela-scroll">
          <table class="tabela-jogos" id="tabela-inscritos">
            <colgroup>
              <col style="min-width: 180px;"> <!-- Nome -->
              <col style="width: 60px;">     <!-- Idade -->
              <col style="width: 90px;">     <!-- Sexo -->
              <col style="width: 130px;">    <!-- Telefone -->
              <col style="width: auto;">     <!-- Modalidades -->
              <col style="width: 60px;">     <!-- Fam. -->
              <col style="min-width: 200px;"><!-- Familiares -->
              <col style="min-width: 200px;"><!-- Obs -->
            </colgroup>
            <thead>
              <tr>
                <th data-col="0">Nome</th>
                <th data-col="1">Idade</th>
                <th data-col="2">Sexo</th>
                <th data-col="3">Telefone</th>
                <th data-col="4">Modalidades</th>
                <th data-col="5">Fam.</th>
                <th data-col="6">Nomes Familiares</th>
                <th data-col="7">Obs.</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    // Bind eventos (sem depender de onclick inline / window.*)
    const tabela = container.querySelector("#tabela-inscritos");
    const btnExport = container.querySelector("#btn-export-csv");

    if (btnExport && tabela) {
      btnExport.addEventListener("click", () => exportarTabelaCSV(tabela));
    }

    if (tabela) {
      const ths = Array.from(tabela.querySelectorAll("thead th"));
      ths.forEach((th, idx) => {
        th.addEventListener("click", () => ordenarTabela(tabela, idx));
      });
    }

    console.log("✅ Tabela renderizada com sucesso!");
  } catch (e) {
    console.error("❌ Erro inesperado em renderizarLista:", e);
    container.innerHTML = "<p style='color:#f88;'>Erro ao carregar lista.</p>";
  }
}
