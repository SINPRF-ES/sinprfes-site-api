/**
 * Módulo Informes Admin (área interna)
 * Regra canônica: apenas 1 informe atual editável por vez.
 */

(function (global) {
  if (global.InformesAdmin) return;

  let perfilLogado = null;
  let informeAtual = null;
  let informesArquivados = [];

  function ehGestaoInformes() {
    return ["ADMIN", "DIRETORIA", "FUNCIONARIO", "COMUNICADOR"].includes(perfilLogado);
  }

  async function requestJson(url, options = {}) {
    const r = await window.Api.apiFetch(url, options);
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  async function inicializarInformes(perfil) {
    perfilLogado = (perfil || "").toUpperCase();
    const container = document.getElementById("sec-noticias");
    if (!container) return;

    const ehGestao = ehGestaoInformes();

    container.innerHTML = `
      <div class="ui-card">
        <div class="af-standard-header" style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:20px;">
          <div>
            <h2 style="margin:0;">📰 Informes internos</h2>
            <p class="section-subtitle" style="margin:4px 0 0;">Apenas o informe atual pode ser editado. Arquivados ficam imutáveis no acervo.</p>
          </div>
          ${ehGestao ? `<button id="btn-novo-informe" class="ui-button ui-button-secondary">+ Novo informe atual</button>` : ''}
        </div>

        <section style="margin-bottom:16px;">
          <h3 style="margin:0 0 10px; color:#003366;">Informe atual</h3>
          <div id="informe-atual-admin"><p style="color:#666;">Carregando...</p></div>
        </section>

        <section>
          <h3 style="margin:0 0 10px; color:#003366;">Informes arquivados</h3>
          <div id="informes-arquivados-admin"><p style="color:#666;">Carregando...</p></div>
        </section>
      </div>
    `;

    if (ehGestao) {
      document.getElementById("btn-novo-informe").onclick = () => abrirModalInforme();
    }

    await carregarInformes();
  }

  async function carregarInformes(paginaArquivadas = 1) {
    const atualEl = document.getElementById("informe-atual-admin");
    const arquivadasEl = document.getElementById("informes-arquivados-admin");
    if (!atualEl || !arquivadasEl) return;

    // Busca informe atual
    const respAtual = await requestJson("/api/informes?status_editorial=ATUAL");
    informeAtual = (Array.isArray(respAtual.data) ? respAtual.data[0] : respAtual.data.items?.[0]) || null;

    // Busca arquivadas paginadas
    const respArq = await requestJson(`/api/informes?status_editorial=ARQUIVADA&pagina=${paginaArquivadas}`);
    informesArquivados = respArq.data.items || [];
    const pagination = respArq.data.pagination || { page: 1, totalPages: 1 };

    renderizarAtual();
    renderizarArquivadas(pagination);
  }

  function escape(v) {
    return (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : String(v || "");
  }

  function renderCardInforme(n, { mostrarEditar = false, mostrarArquivar = false } = {}) {
    const data = new Date(n.data_noticia || n.published_at || n.created_at).toLocaleDateString("pt-BR");
    return `
      <div class="informe-admin-card" style="border:1px solid #ddd; border-radius:12px; padding:14px; margin-bottom:12px; background:#fff;">
        <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
          <div>
            <h4 style="margin:0 0 4px; color:#003366;">${escape(n.titulo)}</h4>
            ${n.subtitulo ? `<p style="margin:0 0 6px; color:#334155;">${escape(n.subtitulo)}</p>` : ''}
            <small style="color:#64748b;">${data} · ${escape(n.status_editorial)}</small>
          </div>
          ${n.capa_url ? `<img src="${escape(n.capa_url)}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;">` : ''}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="InformesAdmin.abrirVisualizacaoInforme('${n.id}')">📖 Visualizar</button>
          ${mostrarEditar ? `<button class="btn btn-outline btn-sm" onclick="InformesAdmin.abrirModalInforme('${n.id}')">✏️ Editar informe atual</button>` : ''}
          ${mostrarArquivar ? `<button class="btn btn-primary btn-sm" onclick="InformesAdmin.arquivarInformeAtual('${n.id}')">📦 Arquivar informe atual</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderizarAtual() {
    const el = document.getElementById("informe-atual-admin");
    if (!el) return;
    if (!informeAtual) {
      el.innerHTML = `<p style="color:#475569;">Nenhum informe atual ativo. Crie um novo informe para iniciar o ciclo editorial.</p>`;
      return;
    }
    el.innerHTML = renderCardInforme(informeAtual, {
      mostrarEditar: ehGestaoInformes() && informeAtual.is_editable,
      mostrarArquivar: ehGestaoInformes() && informeAtual.is_editable,
    });
  }

  function renderizarArquivadas(pagination) {
    const el = document.getElementById("informes-arquivados-admin");
    if (!el) return;
    if (!informesArquivados.length) {
      el.innerHTML = `<p style="color:#64748b;">Sem informes arquivados até o momento.</p>`;
      return;
    }

    let html = informesArquivados.map((n) => `
      <div style="margin-bottom:16px;">
        ${renderCardInforme(n)}
        <p style="margin:-4px 0 0; font-size:0.85rem; color:#b91c1c;">Este informe está consolidado e não pode mais ser editado.</p>
      </div>
    `).join("");

    if (pagination && pagination.totalPages > 1) {
      html += `
        <div class="cms-pagination" style="display:flex; justify-content:center; gap:8px; margin-top:20px;">
          ${Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => `
            <button class="ui-button ui-button-sm ${p === pagination.page ? 'ui-button-secondary' : 'ui-button-outline'}"
                    onclick="InformesAdmin.carregarInformes(${p})" ${p === pagination.page ? 'disabled' : ''}>
              ${p}
            </button>
          `).join("")}
        </div>
      `;
    }

    el.innerHTML = html;
  }

  async function abrirVisualizacaoInforme(id) {
    const { ok, data } = await requestJson(`/api/informes/${id}`);
    if (!ok) return alert("Não foi possível abrir o informe.");

    const modal = document.getElementById("modal-generic");
    if (!modal) return;
    document.getElementById("modal-generic-titulo").textContent = data.titulo || "Informe";
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

  async function abrirModalInforme(id = null) {
    if (!ehGestaoInformes()) return alert("Apenas gestão pode editar informes.");

    if (!id && informeAtual) {
      return alert("Já existe um informe atual. Arquive o informe atual antes de criar outro.");
    }

    let informe = { titulo: "", subtitulo: "", conteudo: "", capa_url: "", destaque: false };
    if (id) {
      const detalhe = await requestJson(`/api/informes/${id}`);
      if (!detalhe.ok) return alert("Não foi possível carregar o informe para edição.");
      informe = detalhe.data;
    }

    const modal = document.getElementById("modal-generic");
    if (!modal) return;

    document.getElementById("modal-generic-titulo").textContent = id ? "Editar informe atual" : "Novo informe atual";
    document.getElementById("modal-generic-corpo").innerHTML = `
      <form id="form-informe-admin">
        <div class="field-group"><label>Título</label><input class="ui-input" name="titulo" value="${escape(informe.titulo)}" required></div>
        <div class="field-group" style="margin-top:10px;"><label>Subtítulo</label><input class="ui-input" name="subtitulo" value="${escape(informe.subtitulo || "")}"></div>
        <div class="field-group" style="margin-top:10px;"><label>Conteúdo</label><textarea class="ui-textarea" name="conteudo" rows="8" required>${escape(informe.conteudo || "")}</textarea></div>
        <div class="field-group" style="margin-top:10px;"><label>URL da capa</label><input class="ui-input" name="capa_url" value="${escape(informe.capa_url || "")}" placeholder="https://..."></div>
        <div class="field-group" style="margin-top:10px;"><label>Data do informe</label><input class="ui-input" type="datetime-local" name="data_noticia" value="${informe.data_noticia ? new Date(informe.data_noticia).toISOString().slice(0,16) : ""}"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button type="button" class="ui-button ui-button-outline" onclick="Utils.fecharModal('modal-generic')">Cancelar</button>
          <button type="submit" class="ui-button ui-button-secondary">Salvar informe atual</button>
        </div>
      </form>
    `;

    modal.style.display = "flex";

    document.getElementById("form-informe-admin").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const body = {
        titulo: fd.get("titulo"),
        subtitulo: fd.get("subtitulo"),
        conteudo: fd.get("conteudo"),
        capa_url: fd.get("capa_url"),
        data_noticia: fd.get("data_noticia") ? new Date(fd.get("data_noticia")).toISOString() : null,
        audiencia: "INTERNA",
      };

      const endpoint = id ? `/api/informes/${id}` : "/api/informes";
      const method = id ? "PUT" : "POST";
      const resp = await requestJson(endpoint, { method, body });
      if (!resp.ok) {
        return alert(resp.data?.message || "Não foi possível salvar.");
      }
      Utils.fecharModal("modal-generic");
      await carregarInformes();
    };
  }

  async function arquivarInformeAtual(id) {
    if (!ehGestaoInformes()) return;
    if (!confirm("Arquivar informe atual? Esta ação consolida o conteúdo e bloqueia novas edições.")) return;
    const resp = await requestJson(`/api/informes/${id}/arquivar`, { method: "POST" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao arquivar informe atual.");
    await carregarInformes();
    alert("Informe atual arquivado com sucesso. Agora você pode criar um novo informe atual.");
  }

  global.InformesAdmin = {
    inicializarInformes,
    carregarInformes,
    abrirModalInforme,
    abrirVisualizacaoInforme,
    arquivarInformeAtual,
  };
})(window);
