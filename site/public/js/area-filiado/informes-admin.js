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

  function formatDateOnly(value) {
    if (!value) return "";
    const raw = String(value);
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return raw;
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
        <div class="af-standard-header" style="display:flex; justify-content:${ehGestao ? "space-between" : "center"}; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:20px;">
          <div style="${ehGestao ? "" : "width:100%; text-align:center;"}">
            <h2 style="margin:0; text-align:center;">📰 Informes internos</h2>
            ${ehGestao ? '<p class="section-subtitle" style="margin:4px 0 0;">Apenas o informe atual pode ser editado. Arquivados ficam imutáveis no acervo.</p>' : ''}
          </div>
          ${ehGestao ? `<button id="btn-novo-informe" class="ui-button ui-button-secondary">+ Novo rascunho de informe</button>` : ''}
        </div>

        <section style="margin-bottom:16px;">
          <h3 style="margin:0 0 10px; color:#003366;">Informe atual</h3>
          <div id="informe-atual-admin"><p style="color:#666;">Carregando...</p></div>
        </section>

        <section>
          <h3 style="margin:0 0 10px; color:#003366;">Arquivo de informes</h3>
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

    const filtroConsumo = ehGestaoInformes() ? "" : "&status=PUBLICADA";
    const respAtual = await requestJson(`/api/informes?status_editorial=ATUAL${filtroConsumo}`);
    informeAtual = (Array.isArray(respAtual.data) ? respAtual.data[0] : respAtual.data.items?.[0]) || null;

    const respArq = await requestJson(`/api/informes?status_editorial=ARQUIVADA${filtroConsumo}&pagina=${paginaArquivadas}`);
    informesArquivados = respArq.data.items || [];
    const pagination = respArq.data.pagination || { page: 1, totalPages: 1 };

    renderizarAtual();
    renderizarArquivadas(pagination);
  }

  function escape(v) {
    return (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : String(v || "");
  }

  function renderCardInforme(n, { mostrarEditar = false, mostrarArquivar = false, mostrarPublicar = false, mostrarExcluir = false, mostrarMetadados = false } = {}) {
    const data = formatDateOnly(n.data_informe || n.data_noticia || n.published_at || n.created_at);
    return `
      <div class="informe-admin-card" style="border:1px solid #ddd; border-radius:12px; padding:14px; margin-bottom:12px; background:#fff;">
        <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
          <div>
            <h4 style="margin:0 0 4px; color:#003366;">${escape(n.titulo)}</h4>
            ${n.subtitulo ? `<p style="margin:0 0 6px; color:#334155;">${escape(n.subtitulo)}</p>` : ''}
            <small style="color:#64748b;">${mostrarMetadados ? `${data} · ${escape(n.status)} · ${escape(n.status_editorial)}` : data}</small>
          </div>
          ${n.capa_url ? `<img src="${escape(n.capa_url)}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;">` : ''}
        </div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="InformesAdmin.abrirVisualizacaoInforme('${n.id}')">📖 Visualizar</button>
          ${mostrarEditar ? `<button class="btn btn-outline btn-sm" onclick="InformesAdmin.abrirModalInforme('${n.id}')">✏️ Editar informe atual</button>` : ''}
          ${mostrarPublicar ? `<button class="btn btn-primary btn-sm" onclick="InformesAdmin.publicarInformeAtual('${n.id}')">📢 Publicar informe</button>` : ''}
          ${mostrarArquivar ? `<button class="btn btn-primary btn-sm" onclick="InformesAdmin.arquivarInformeAtual('${n.id}')">📦 Arquivar informe atual</button>` : ''}
          ${mostrarExcluir ? `<button class="btn btn-sm" style="background:#d32f2f; color:#fff; border-color:#d32f2f;" onclick="InformesAdmin.excluirInformeAtual('${n.id}')">Excluir Informe</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderizarAtual() {
    const el = document.getElementById("informe-atual-admin");
    if (!el) return;
    if (!informeAtual) {
      el.innerHTML = ehGestaoInformes()
        ? `<p style="color:#475569;">Nenhum informe atual ativo. Crie um novo informe para iniciar o ciclo editorial.</p>`
        : `<p style="color:#475569;">Nenhum informe disponível no momento.</p>`;
      return;
    }
    el.innerHTML = renderCardInforme(informeAtual, {
      mostrarEditar: ehGestaoInformes() && informeAtual.is_editable,
      mostrarPublicar: ehGestaoInformes() && informeAtual.is_editable && informeAtual.status === "RASCUNHO",
      mostrarArquivar: ehGestaoInformes() && informeAtual.is_editable && informeAtual.status === "PUBLICADA",
      mostrarExcluir: ehGestaoInformes() && informeAtual.is_editable,
      mostrarMetadados: ehGestaoInformes(),
    });
  }

  function renderizarArquivadas(pagination) {
    const el = document.getElementById("informes-arquivados-admin");
    if (!el) return;
    if (!informesArquivados.length) {
      el.innerHTML = ehGestaoInformes()
        ? `<p style="color:#64748b;">Sem informes arquivados até o momento.</p>`
        : `<p style="color:#64748b;">Não há informes anteriores disponíveis.</p>`;
      return;
    }

    let html = informesArquivados.map((n) => `
      <div style="margin-bottom:16px;">
        ${renderCardInforme(n, { mostrarMetadados: ehGestaoInformes() })}
        ${ehGestaoInformes() ? '<p style="margin:-4px 0 0; font-size:0.85rem; color:#b91c1c;">Este informe está consolidado e não pode mais ser editado.</p>' : ''}
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

  function renderGaleriaEdicao(midias, capaMidiaId) {
    const imagens = (midias || []).filter((m) => m.tipo === "IMAGEM");
    if (!imagens.length) return `<p style="color:#64748b; margin:6px 0 0;">Nenhuma imagem anexada ainda.</p>`;
    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:12px; margin-top:8px;">
        ${imagens.map((m) => `
          <div style="border:1px solid #e2e8f0; border-radius:8px; padding:6px;">
            <img src="${escape(m.url)}" style="width:100%; height:90px; object-fit:cover; border-radius:6px;">
            <div style="margin-top:6px; display:flex; flex-direction:column; gap:6px;">
              <button type="button" class="ui-button ui-button-sm ${m.id === capaMidiaId ? 'ui-button-secondary' : 'ui-button-outline'}" onclick="InformesAdmin.definirCapaMidia('${m.id}')">
                ${m.id === capaMidiaId ? '✅ Capa' : 'Definir capa'}
              </button>
              <button type="button" class="ui-button ui-button-sm ui-button-outline" onclick="InformesAdmin.removerMidia('${m.id}')">Remover</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  async function abrirModalInforme(id = null) {
    if (!ehGestaoInformes()) return alert("Apenas gestão pode editar informes.");

    if (!id && informeAtual) {
      return alert("Já existe um informe no ciclo atual. Publique ou arquive o informe atual antes de criar outro.");
    }

    let informe = { titulo: "", subtitulo: "", conteudo: "", capa_url: "", midias: [], capa_midia_id: null, data_informe: "" };
    if (id) {
      const detalhe = await requestJson(`/api/informes/${id}`);
      if (!detalhe.ok) return alert("Não foi possível carregar o informe para edição.");
      informe = detalhe.data;
      if (!informe.is_editable || informe.status_editorial === "ARQUIVADA") {
        return alert("Este informe está arquivado e não pode ser editado.");
      }
    }

    const modal = document.getElementById("modal-generic");
    if (!modal) return;

    document.getElementById("modal-generic-titulo").textContent = id ? "Editar informe atual" : "Novo rascunho de informe";
    document.getElementById("modal-generic-corpo").innerHTML = `
      <form id="form-informe-admin">
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

    document.getElementById("form-informe-admin").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const body = {
        titulo: fd.get("titulo"),
        subtitulo: fd.get("subtitulo"),
        conteudo: fd.get("conteudo"),
        data_informe: fd.get("data_informe") || null
      };

      const endpoint = id ? `/api/informes/${id}` : "/api/informes";
      const method = id ? "PUT" : "POST";
      const resp = await requestJson(endpoint, { method, body });
      if (!resp.ok) return alert(resp.data?.message || "Não foi possível salvar.");

      Utils.fecharModal("modal-generic");
      await carregarInformes();
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
          const r = await requestJson(`/api/informes/${id}/midias`, { method: "POST", body: fd });
          if (!r.ok) return alert(r.data?.message || "Falha ao anexar imagem.");
          await abrirModalInforme(id);
        });
      }
    }
  }

  async function definirCapaMidia(midiaId) {
    if (!informeAtual?.id) return;
    const resp = await requestJson(`/api/informes/${informeAtual.id}/capa`, {
      method: "PUT",
      body: { coverMediaId: midiaId },
    });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao definir capa.");
    await abrirModalInforme(informeAtual.id);
    await carregarInformes();
  }

  async function removerMidia(midiaId) {
    if (!confirm("Remover esta imagem anexada?")) return;
    const resp = await requestJson(`/api/informes/midias/${midiaId}`, { method: "DELETE" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao remover mídia.");
    if (informeAtual?.id) await abrirModalInforme(informeAtual.id);
    await carregarInformes();
  }


  async function publicarInformeAtual(id) {
    if (!ehGestaoInformes()) return;
    if (!confirm("Publicar informe atual? Após publicar ele ficará visível para filiados.")) return;
    const resp = await requestJson(`/api/informes/${id}/publicar`, { method: "POST" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao publicar informe atual.");
    await carregarInformes();
    alert("Informe publicado com sucesso.");
  }

  async function arquivarInformeAtual(id) {
    if (!ehGestaoInformes()) return;
    if (!confirm("Arquivar informe atual? Esta ação consolida o conteúdo e bloqueia novas edições.")) return;
    const resp = await requestJson(`/api/informes/${id}/arquivar`, { method: "POST" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao arquivar informe atual.");
    await carregarInformes();
    alert("Informe atual arquivado com sucesso. Agora você pode criar um novo informe atual.");
  }

  async function excluirInformeAtual(id) {
    if (!ehGestaoInformes()) return;
    if (!confirm("Deseja EXCLUIR permanentemente este informe?")) return;
    const resp = await requestJson(`/api/informes/${id}`, { method: "DELETE" });
    if (!resp.ok) return alert(resp.data?.message || "Erro ao excluir informe.");
    Utils.fecharModal("modal-generic");
    await carregarInformes();
  }

  global.InformesAdmin = {
    inicializarInformes,
    carregarInformes,
    abrirModalInforme,
    abrirVisualizacaoInforme,
    publicarInformeAtual,
    arquivarInformeAtual,
    excluirInformeAtual,
    definirCapaMidia,
    removerMidia,
  };
})(window);
