/**
 * Módulo Informes Admin (área interna)
 * Regra canônica: apenas 1 informe atual editável por vez.
 */

(function (global) {
  if (global.AniversariosAdmin) return;

  let perfilLogado = null;
  let informeAtual = null;
  let informesArquivados = [];

  function ehGestaoAniversarios() {
    return ["ADMIN", "DIRETORIA", "FUNCIONARIO", "COMUNICADOR"].includes(perfilLogado);
  }

  function formatDateOnly(value) {
    if (!value) return "";
    const raw = String(value);
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return raw;
  }

  function formatFriendlyRef(ref) {
    if (!ref) return "";
    const match = String(ref).match(/^(\d{4})(\d{2})(\d{2})-aniversario-(\d+)$/i);
    if (!match) return "Aniversário interno";
    return `Aniversário #${match[4]} de ${match[3]}/${match[2]}/${match[1]}`;
  }

  function getFriendlyAniversarioUrl(publicRef) {
    if (!publicRef) return "";
    return `/area-filiado/aniversarios/${encodeURIComponent(publicRef)}`;
  }

  async function requestJson(url, options = {}) {
    const r = await window.Api.apiFetch(url, options);
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  async function inicializarAniversarios(perfil) {
    perfilLogado = (perfil || "").toUpperCase();
    const container = document.getElementById("sec-aniversarios") || document.getElementById("sec-aniversarios-admin");
    if (!container) return;

    const ehGestao = ehGestaoAniversarios();

    container.innerHTML = `
      <div class="ui-card">
        <div class="af-standard-header" style="display:flex; justify-content:${ehGestao ? "space-between" : "center"}; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:20px;">
          <div style="${ehGestao ? "" : "width:100%; text-align:center;"}">
            <h2 style="margin:0; text-align:center;">🎂 Aniversários internos</h2>
            ${ehGestao ? '<p class="section-subtitle" style="margin:4px 0 0;">Apenas o aniversário atual pode ser editado. Arquivados ficam imutáveis no acervo.</p>' : ''}
          </div>
          ${ehGestao ? `<button id="btn-novo-aniversario" class="ui-button ui-button-secondary">+ Inserir novo aniversário atual</button>` : ''}
        </div>

        <section style="margin-bottom:16px;">
          <h3 style="margin:0 0 10px; color:#003366;">Aniversário atual</h3>
          <div id="aniversario-atual-admin"><p style="color:#666;">Carregando...</p></div>
        </section>

        <section>
          <h3 style="margin:0 0 10px; color:#003366;">Arquivo de aniversários</h3>
          <div id="aniversarios-arquivados-admin"><p style="color:#666;">Carregando...</p></div>
        </section>

      </div>
    `;

    if (ehGestao) {
      document.getElementById("btn-novo-aniversario").onclick = () => abrirModalAniversario();
    }

    await carregarAniversarios();
  }

  async function carregarAniversarios(paginaArquivadas = 1) {
    const atualEl = document.getElementById("aniversario-atual-admin");
    const arquivadasEl = document.getElementById("aniversarios-arquivados-admin");
    if (!atualEl || !arquivadasEl) return;

    const filtroConsumo = ehGestaoAniversarios() ? "" : "&status=PUBLICADA";
    const respAtual = await requestJson(`/api/aniversarios?status_editorial=ATUAL${filtroConsumo}`);
    informeAtual = (Array.isArray(respAtual.data) ? respAtual.data[0] : respAtual.data.items?.[0]) || null;

    const respArq = await requestJson(`/api/aniversarios?status_editorial=ARQUIVADA${filtroConsumo}&pagina=${paginaArquivadas}`);
    informesArquivados = respArq.data.items || [];
    const pagination = respArq.data.pagination || { page: 1, totalPages: 1 };

    renderizarAtual();
    renderizarArquivadas(pagination);
  }

  function escape(v) {
    return (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : String(v || "");
  }

  function renderCardAniversario(n, { mostrarEditar = false, mostrarArquivar = false, mostrarPublicar = false, mostrarExcluir = false, mostrarMetadados = false } = {}) {
    const data = formatDateOnly(n.data_informe || n.published_at || n.created_at);
    const friendlyRef = formatFriendlyRef(n.public_ref);
    const friendlyUrl = getFriendlyAniversarioUrl(n.public_ref);
    return `
      <div class="informe-admin-card" style="border:1px solid #ddd; border-radius:12px; padding:14px; margin-bottom:12px; background:#fff;">
        <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
          <div>
            <h4 style="margin:0 0 4px; color:#003366;">${escape(n.titulo)}</h4>
            ${n.subtitulo ? `<p style="margin:0 0 6px; color:#334155;">${escape(n.subtitulo)}</p>` : ''}
            <small style="color:#64748b;">${mostrarMetadados ? `${data} · ${escape(n.status)} · ${escape(n.status_editorial)}` : data}</small>
            ${n.public_ref ? `<div style="margin-top:6px;"><small style="display:block; color:#003366; font-weight:600;">${escape(friendlyRef)}</small></div>` : ''}
          </div>
          ${n.capa_url ? `<img src="${escape(n.capa_url)}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;">` : ''}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="AniversariosAdmin.abrirVisualizacaoAniversario('${n.id}')">📖 Visualizar</button>
          ${n.public_ref ? `<a class="btn btn-outline btn-sm" href="${friendlyUrl}">🔗 Link amigável</a>` : ''}
          ${mostrarEditar ? `<button class="btn btn-outline btn-sm" onclick="AniversariosAdmin.abrirModalAniversario('${n.id}')">✏️ Editar aniversário atual</button>` : ''}
          ${mostrarPublicar ? `<button class="btn btn-primary btn-sm" onclick="AniversariosAdmin.publicarAniversarioAtual('${n.id}')">📢 Publicar aniversário</button>` : ''}
          ${mostrarArquivar ? `<button class="btn btn-primary btn-sm" onclick="AniversariosAdmin.arquivarAniversarioAtual('${n.id}')">📦 Arquivar aniversário atual</button>` : ''}
          ${mostrarExcluir ? `<button class="btn btn-sm" style="background:#d32f2f; color:#fff; border-color:#d32f2f;" onclick="AniversariosAdmin.excluirAniversarioAtual('${n.id}')">Excluir Aniversário</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderizarAtual() {
    const el = document.getElementById("aniversario-atual-admin");
    if (!el) return;
    if (!informeAtual) {
      el.innerHTML = ehGestaoAniversarios()
        ? `<p style="color:#475569;">Nenhum aniversário atual ativo. Crie um novo aniversário para iniciar o ciclo editorial.</p>`
        : `<p style="color:#475569;">Nenhum aniversário disponível no momento.</p>`;
      return;
    }
    el.innerHTML = renderCardAniversario(informeAtual, {
      mostrarEditar: ehGestaoAniversarios() && informeAtual.is_editable,
      mostrarPublicar: ehGestaoAniversarios() && informeAtual.is_editable && informeAtual.status === "RASCUNHO",
      mostrarArquivar: ehGestaoAniversarios() && informeAtual.is_editable && informeAtual.status === "PUBLICADA",
      mostrarExcluir: ehGestaoAniversarios() && informeAtual.is_editable,
      mostrarMetadados: ehGestaoAniversarios(),
    });
  }

  function renderizarArquivadas(pagination) {
    const el = document.getElementById("aniversarios-arquivados-admin");
    if (!el) return;
    if (!informesArquivados.length) {
      el.innerHTML = ehGestaoAniversarios()
        ? `<p style="color:#64748b;">Sem aniversários arquivados até o momento.</p>`
        : `<p style="color:#64748b;">Não há aniversários anteriores disponíveis.</p>`;
      return;
    }

    let html = informesArquivados.map((n) => `
      <div style="margin-bottom:16px;">
        ${renderCardAniversario(n, { mostrarMetadados: ehGestaoAniversarios() })}
        ${ehGestaoAniversarios() ? '<p style="margin:-4px 0 0; font-size:0.85rem; color:#b91c1c;">Este aniversário está consolidado e não pode mais ser editado.</p>' : ''}
      </div>
    `).join("");

    if (pagination && pagination.totalPages > 1) {
      html += `
        <div class="cms-pagination" style="display:flex; justify-content:center; gap:8px; margin-top:20px;">
          ${Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => `
            <button class="ui-button ui-button-sm ${p === pagination.page ? 'ui-button-secondary' : 'ui-button-outline'}"
                    onclick="AniversariosAdmin.carregarAniversarios(${p})" ${p === pagination.page ? 'disabled' : ''}>
              ${p}
            </button>
          `).join("")}
        </div>
      `;
    }

    el.innerHTML = html;
  }

  async function abrirVisualizacaoAniversario(id) {
    const { ok, data } = await requestJson(`/api/aniversarios/${id}`);
    if (!ok) return alert("Não foi possível abrir o aniversário.");

    const modal = document.getElementById("modal-generic");
    if (!modal) return;
    document.getElementById("modal-generic-titulo").textContent = data.titulo || "Aniversário";
    document.getElementById("modal-generic-corpo").innerHTML = `
      <article>
        ${data.capa_url ? `<img src="${escape(data.capa_url)}" style="width:100%; border-radius:8px; margin-bottom:12px;">` : ''}
        <div class="markdown-body informe-markdown"></div>
        <div style="margin-top:14px; text-align:right;"><button class="ui-button ui-button-outline" onclick="Utils.fecharModal('modal-generic')">Fechar</button></div>
      </article>
    `;
    const md = document.querySelector("#modal-generic-corpo .informe-markdown");
    if (window.InformesRenderer?.mountRenderedMarkdown) window.InformesRenderer.mountRenderedMarkdown(md, data.conteudo || "");
    modal.style.display = "flex";
  }

  async function abrirVisualizacaoAniversarioPorRef(publicRef) {
    const { ok, data } = await requestJson(`/api/aniversarios/ref/${encodeURIComponent(publicRef)}`);
    if (!ok) return alert("Não foi possível abrir o aniversário.");
    return abrirVisualizacaoAniversario(data.id);
  }

  function renderGaleriaEdicao(midias, capaMidiaId) {
    const imagens = (midias || []).filter((m) => m.tipo === "IMAGEM");
    if (!imagens.length) return `<p style="color:#64748b; margin:6px 0 0;">Nenhuma imagem anexada ainda.</p>`;
    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:12px; margin-top:8px;">
        ${imagens.map((m) => `
          <div style="border:1px solid #e2e8f0; border-radius:8px; padding:6px;">
            <img src="${escape(m.url)}" style="width:100%; height:90px; object-fit:cover; border-radius:6px;">
            <div style="margin-top:6px; display:flex; flex-direction:column; gap:6px;">
              <button type="button" class="ui-button ui-button-sm ${m.id === capaMidiaId ? 'ui-button-secondary' : 'ui-button-outline'}" onclick="AniversariosAdmin.definirCapaMidia('${m.id}')">
                ${m.id === capaMidiaId ? '✅ Capa' : 'Definir capa'}
              </button>
              <button type="button" class="ui-button ui-button-sm ui-button-outline" onclick="AniversariosAdmin.removerMidia('${m.id}')">Remover</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  async function abrirModalAniversario(id = null) {
    if (!ehGestaoAniversarios()) return alert("Apenas gestão pode gerenciar aniversários.");

    if (!id && informeAtual) {
      return alert("Já existe um aniversário no ciclo atual. Publique ou arquive o aniversário atual antes de criar outro.");
    }

    let informe = { titulo: "", subtitulo: "", conteudo: "", capa_url: "", midias: [], capa_midia_id: null, data_informe: "" };
    if (id) {
      const detalhe = await requestJson(`/api/aniversarios/${id}`);
      if (!detalhe.ok) return alert("Não foi possível carregar o aniversário para edição.");
      informe = detalhe.data;
      if (!informe.is_editable || informe.status_editorial === "ARQUIVADA") {
        return alert("Este aniversário está arquivado e não pode ser editado.");
      }
    }

    const modal = document.getElementById("modal-generic");
    if (!modal) return;

    document.getElementById("modal-generic-titulo").textContent = id ? "Editar aniversário atual" : "Inserir novo aniversário atual";
    document.getElementById("modal-generic-corpo").innerHTML = `
      <form id="form-aniversario-admin">
        <div class="field-group"><label>Título</label><input class="ui-input" name="titulo" value="${escape(informe.titulo)}" required></div>
        <div class="field-group" style="margin-top:10px;"><label>Subtítulo</label><input class="ui-input" name="subtitulo" value="${escape(informe.subtitulo || "")}"></div>
        <div class="field-group" style="margin-top:10px;"><label>Conteúdo</label><textarea class="ui-textarea" name="conteudo" rows="8" required>${escape(informe.conteudo || "")}</textarea></div>
        <div class="field-group" style="margin-top:10px;"><label>Data do informe</label><input class="ui-input" type="date" name="data_informe" value="${escape(informe.data_informe || "")}"></div>
        ${id ? `
          <div class="field-group" style="margin-top:10px;">
            <label>Adicionar imagem na galeria</label>
            <input class="ui-input" type="file" id="informe-upload-midia" accept="image/*">
            <small style="color:#64748b;">A capa deve ser escolhida entre as imagens anexadas.</small>
          </div>
          <div class="field-group" style="margin-top:10px;">
            <label>Galeria de imagens anexadas</label>
            <div id="informe-galeria-edit">${renderGaleriaEdicao(informe.midias, informe.capa_midia_id)}</div>
          </div>
        ` : '<p style="margin-top:10px; color:#64748b;">Após criar o informe, você poderá anexar imagens e definir a capa.</p>'}
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button type="button" class="ui-button ui-button-outline" onclick="Utils.fecharModal('modal-generic')">Cancelar</button>
          <button type="submit" class="ui-button ui-button-secondary">Salvar rascunho</button>
        </div>
      </form>
    `;

    modal.style.display = "flex";

    document.getElementById("form-aniversario-admin").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const body = {
        titulo: fd.get("titulo"),
        subtitulo: fd.get("subtitulo"),
        conteudo: fd.get("conteudo"),
        data_informe: fd.get("data_informe") || null
      };

      const endpoint = id ? `/api/aniversarios/${id}` : "/api/aniversarios";
      const method = id ? "PUT" : "POST";
      const resp = await requestJson(endpoint, { method, body });
      if (!resp.ok) return alert(resp.data?.message || "Não foi possível salvar.");

      Utils.fecharModal("modal-generic");
      await carregarAniversarios();
    };

    if (id) {
      const input = document.getElementById("informe-upload-midia");
      if (input) {
        input.addEventListener("change", async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          const fd = new FormData();
          fd.append("file", file);
          fd.append("tipo", "IMAGEM");
          const r = await requestJson(`/api/aniversarios/${id}/midias`, { method: "POST", body: fd });
          if (!r.ok) return alert(r.data?.message || "Falha ao anexar imagem.");
          await abrirModalAniversario(id);
        });
      }
    }
  }

  async function definirCapaMidia(midiaId) {
    if (!informeAtual?.id) return;
    const resp = await requestJson(`/api/aniversarios/${informeAtual.id}/capa`, {
      method: "PUT",
      body: { coverMediaId: midiaId },
    });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao definir capa.");
    await abrirModalAniversario(informeAtual.id);
    await carregarAniversarios();
  }

  async function removerMidia(midiaId) {
    if (!confirm("Remover esta imagem anexada?")) return;
    const resp = await requestJson(`/api/aniversarios/midias/${midiaId}`, { method: "DELETE" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao remover mídia.");
    if (informeAtual?.id) await abrirModalAniversario(informeAtual.id);
    await carregarAniversarios();
  }


  async function publicarAniversarioAtual(id) {
    if (!ehGestaoAniversarios()) return;
    if (!confirm("Publicar aniversário atual? Após publicar ele ficará visível para filiados.")) return;
    const resp = await requestJson(`/api/aniversarios/${id}/publicar`, { method: "POST" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao publicar informe atual.");
    await carregarAniversarios();
    alert("Informe publicado com sucesso.");
  }

  async function arquivarAniversarioAtual(id) {
    if (!ehGestaoAniversarios()) return;
    if (!confirm("Arquivar aniversário atual? Esta ação consolida o conteúdo e bloqueia novas edições.")) return;
    const resp = await requestJson(`/api/aniversarios/${id}/arquivar`, { method: "POST" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao arquivar informe atual.");
    await carregarAniversarios();
    alert("Aniversário atual arquivado com sucesso. Agora você pode criar um novo informe atual.");
  }

  async function excluirAniversarioAtual(id) {
    if (!ehGestaoAniversarios()) return;
    if (!confirm("Deseja EXCLUIR permanentemente este informe?")) return;
    const resp = await requestJson(`/api/aniversarios/${id}`, { method: "DELETE" });
    if (!resp.ok) return alert(resp.data?.message || "Erro ao excluir informe.");
    Utils.fecharModal("modal-generic");
    await carregarAniversarios();
  }

  global.AniversariosAdmin = {
    inicializarAniversarios,
    carregarAniversarios,
    abrirModalAniversario,
    abrirVisualizacaoAniversario,
    abrirVisualizacaoAniversarioPorRef,
    publicarAniversarioAtual,
    arquivarAniversarioAtual,
    excluirAniversarioAtual,
    definirCapaMidia,
    removerMidia,
  };
})(window);
