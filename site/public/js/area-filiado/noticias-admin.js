/**
 * Módulo Informes Admin (área externa)
 * Regra canônica: apenas 1 informe externo atual editável por vez.
 */

(function (global) {
  if (global.NoticiasAdmin) return;

  let perfilLogado = null;
  let noticiaAtual = null;
  let noticiasArquivadas = [];

  function ehGestaoNoticias() {
    return ["ADMIN", "DIRETORIA", "FUNCIONARIO", "COMUNICADOR"].includes(perfilLogado);
  }

  async function requestJson(url, options = {}) {
    const r = await window.Api.apiFetch(url, options);
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  async function inicializarNoticias(perfil) {
    perfilLogado = (perfil || "").toUpperCase();
    const container = document.getElementById("sec-noticias");
    if (!container) return;

    const ehGestao = ehGestaoNoticias();

    container.innerHTML = `
      <div class="ui-card">
        <div class="af-standard-header" style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:20px;">
          <div>
            <h2 style="margin:0;">📰 Informes externos (CMS)</h2>
            <p class="section-subtitle" style="margin:4px 0 0;">Apenas o informe atual pode ser editado. Arquivados ficam imutáveis no acervo.</p>
          </div>
          ${ehGestao ? `<button id="btn-nova-noticia" class="ui-button ui-button-secondary">+ Inserir nova notícia atual</button>` : ''}
        </div>

        <section style="margin-bottom:16px;">
          <h3 style="margin:0 0 10px; color:#003366;">Informe externo atual</h3>
          <div id="noticia-atual-admin"><p style="color:#666;">Carregando...</p></div>
        </section>

        <section>
          <h3 style="margin:0 0 10px; color:#003366;">Informes externos arquivados</h3>
          <div id="noticias-arquivadas-admin"><p style="color:#666;">Carregando...</p></div>
        </section>
      </div>
    `;

    if (ehGestao) {
      document.getElementById("btn-nova-noticia").onclick = () => abrirModalNoticia();
    }

    await carregarNoticias();
  }

  async function carregarNoticias(paginaArquivadas = 1) {
    const atualEl = document.getElementById("noticia-atual-admin");
    const arquivadasEl = document.getElementById("noticias-arquivadas-admin");
    if (!atualEl || !arquivadasEl) return;

    // Busca informe externo atual
    const respAtual = await requestJson("/api/noticias?status_editorial=ATUAL");
    noticiaAtual = (Array.isArray(respAtual.data) ? respAtual.data[0] : respAtual.data.items?.[0]) || null;

    // Busca arquivadas paginadas
    const respArq = await requestJson(`/api/noticias?status_editorial=ARQUIVADA&pagina=${paginaArquivadas}`);
    noticiasArquivadas = respArq.data.items || [];
    const pagination = respArq.data.pagination || { page: 1, totalPages: 1 };

    renderizarAtual();
    renderizarArquivadas(pagination);
  }

  function escape(v) {
    return (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : String(v || "");
  }

  function renderCardNoticia(n, { mostrarEditar = false, mostrarArquivar = false } = {}) {
    const data = new Date(n.data_noticia || n.published_at || n.created_at).toLocaleDateString("pt-BR");
    return `
      <div class="noticia-admin-card" style="border:1px solid #ddd; border-radius:12px; padding:14px; margin-bottom:12px; background:#fff;">
        <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
          <div>
            <h4 style="margin:0 0 4px; color:#003366;">${escape(n.titulo)}</h4>
            ${n.subtitulo ? `<p style="margin:0 0 6px; color:#334155;">${escape(n.subtitulo)}</p>` : ''}
            <small style="color:#64748b;">${data} · ${escape(n.status_editorial)}</small>
          </div>
          ${n.capa_url ? `<img src="${escape(n.capa_url)}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;">` : ''}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="NoticiasAdmin.abrirVisualizacaoNoticia('${n.id}')">📖 Visualizar</button>
          ${mostrarEditar ? `<button class="btn btn-outline btn-sm" onclick="NoticiasAdmin.abrirModalNoticia('${n.id}')">✏️ Editar notícia atual</button>` : ''}
          ${mostrarArquivar ? `<button class="btn btn-primary btn-sm" onclick="NoticiasAdmin.arquivarNoticiaAtual('${n.id}')">📦 Arquivar informe externo atual</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderizarAtual() {
    const el = document.getElementById("noticia-atual-admin");
    if (!el) return;
    if (!noticiaAtual) {
      el.innerHTML = `<p style="color:#475569;">Nenhuma notícia externa atual ativa. Use “Inserir nova notícia atual” para iniciar o ciclo editorial.</p>`;
      return;
    }
    el.innerHTML = renderCardNoticia(noticiaAtual, {
      mostrarEditar: ehGestaoNoticias() && noticiaAtual.is_editable,
      mostrarArquivar: ehGestaoNoticias() && noticiaAtual.is_editable,
    });
  }

  function renderizarArquivadas(pagination) {
    const el = document.getElementById("noticias-arquivadas-admin");
    if (!el) return;
    if (!noticiasArquivadas.length) {
      el.innerHTML = `<p style="color:#64748b;">Sem informes externos arquivados até o momento.</p>`;
      return;
    }

    let html = noticiasArquivadas.map((n) => `
      <div style="margin-bottom:16px;">
        ${renderCardNoticia(n)}
        <p style="margin:-4px 0 0; font-size:0.85rem; color:#b91c1c;">Esta informe está consolidada e não pode mais ser editada.</p>
      </div>
    `).join("");

    if (pagination && pagination.totalPages > 1) {
      html += `
        <div class="cms-pagination" style="display:flex; justify-content:center; gap:8px; margin-top:20px;">
          ${Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => `
            <button class="ui-button ui-button-sm ${p === pagination.page ? 'ui-button-secondary' : 'ui-button-outline'}"
                    onclick="NoticiasAdmin.carregarNoticias(${p})" ${p === pagination.page ? 'disabled' : ''}>
              ${p}
            </button>
          `).join("")}
        </div>
      `;
    }

    el.innerHTML = html;
  }

  async function abrirVisualizacaoNoticia(id) {
    const { ok, data } = await requestJson(`/api/noticias/${id}`);
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

  async function abrirModalNoticia(id = null) {
    if (!ehGestaoNoticias()) return alert("Apenas gestão pode editar informes.");

    if (!id && noticiaAtual) {
      const confirmar = confirm("Já existe uma notícia atual. Ao inserir uma nova, a atual será arquivada automaticamente e movida para o arquivo de notícias. Deseja continuar?");
      if (!confirmar) return;
    }

    let noticia = { titulo: "", subtitulo: "", conteudo: "", capa_url: "", destaque: false };
    if (id) {
      const detalhe = await requestJson(`/api/noticias/${id}`);
      if (!detalhe.ok) return alert("Não foi possível carregar a informe para edição.");
      noticia = detalhe.data;
    }

    const modal = document.getElementById("modal-generic");
    if (!modal) return;

    document.getElementById("modal-generic-titulo").textContent = id ? "Editar notícia externa atual" : "Inserir nova notícia externa atual";
    document.getElementById("modal-generic-corpo").innerHTML = `
      <form id="form-noticia-admin">
        <div class="field-group"><label>Título</label><input class="ui-input" name="titulo" value="${escape(noticia.titulo)}" required></div>
        <div class="field-group" style="margin-top:10px;"><label>Subtítulo</label><input class="ui-input" name="subtitulo" value="${escape(noticia.subtitulo || "")}"></div>
        <div class="field-group" style="margin-top:10px;"><label>Conteúdo</label><textarea class="ui-textarea" name="conteudo" rows="8" required>${escape(noticia.conteudo || "")}</textarea></div>
        <div class="field-group" style="margin-top:10px;"><label>URL da capa</label><input class="ui-input" name="capa_url" value="${escape(noticia.capa_url || "")}" placeholder="https://..."></div>
        <div class="field-group" style="margin-top:10px;"><label>Data da informe</label><input class="ui-input" type="datetime-local" name="data_noticia" value="${noticia.data_noticia ? new Date(noticia.data_noticia).toISOString().slice(0,16) : ""}"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button type="button" class="ui-button ui-button-outline" onclick="Utils.fecharModal('modal-generic')">Cancelar</button>
          <button type="submit" class="ui-button ui-button-secondary">Salvar notícia atual</button>
        </div>
      </form>
    `;

    modal.style.display = "flex";

    document.getElementById("form-noticia-admin").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const body = {
        titulo: fd.get("titulo"),
        subtitulo: fd.get("subtitulo"),
        conteudo: fd.get("conteudo"),
        capa_url: fd.get("capa_url"),
        data_noticia: fd.get("data_noticia") ? new Date(fd.get("data_noticia")).toISOString() : null,
        audiencia: "PUBLICA",
      };

      const endpoint = id ? `/api/noticias/${id}` : "/api/noticias";
      const method = id ? "PUT" : "POST";
      const resp = await requestJson(endpoint, { method, body });
      if (!resp.ok) {
        return alert(resp.data?.message || "Não foi possível salvar.");
      }

      const noticiaPersistida = resp.data || {};
      if (!id) {
        const verificacao = await requestJson("/api/noticias?status_editorial=ATUAL");
        const atual = Array.isArray(verificacao.data) ? verificacao.data[0] : verificacao.data.items?.[0];
        if (!atual || atual.id !== noticiaPersistida.id) {
          return alert("A notícia foi salva, mas não foi confirmada como notícia atual. A operação foi interrompida para evitar falso positivo.");
        }
      }

      Utils.fecharModal("modal-generic");
      await carregarNoticias();
    };
  }

  async function arquivarNoticiaAtual(id) {
    if (!ehGestaoNoticias()) return;
    if (!confirm("Arquivar informe atual? Esta ação consolida o conteúdo e bloqueia novas edições.")) return;
    const resp = await requestJson(`/api/noticias/${id}/arquivar`, { method: "POST" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao arquivar informe externo atual.");
    await carregarNoticias();
    alert("Informe externo arquivado com sucesso. Agora você pode criar um novo informe externo.");
  }

  global.NoticiasAdmin = {
    inicializarNoticias,
    abrirModalNoticia,
    abrirVisualizacaoNoticia,
    arquivarNoticiaAtual,
  };
})(window);
