/**
 * Módulo Notícias Admin (área externa/CMS)
 * Regra canônica: apenas 1 notícia atual editável por vez.
 */

(function (global) {
  if (global.NoticiasAdmin) return;

  let perfilLogado = null;
  let noticiaAtual = null;
  let noticiasArquivadas = [];
  let containerConfig = {};

  function ehGestaoNoticias() {
    return ["ADMIN", "DIRETORIA", "FUNCIONARIO", "COMUNICADOR"].includes(perfilLogado);
  }

  function escape(v) {
    return (window.Utils?.escapeHTML) ? window.Utils.escapeHTML(v) : String(v || "");
  }

  function formatDateOnly(value) {
    if (!value) return "";
    const raw = String(value);
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("pt-BR");
  }

  function formatFriendlyRef(ref) {
    if (!ref) return "";
    const match = String(ref).match(/^(\d{4})(\d{2})(\d{2})-(?:noticia|informe)-(\d+)$/i);
    if (!match) return "Notícia do site";
    return `Notícia #${match[4]} de ${match[3]}/${match[2]}/${match[1]}`;
  }

  function formatDatetimeLocalSaoPaulo(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return fmt.format(date).replace(" ", "T");
  }

  function datetimeLocalToSaoPauloIso(value) {
    if (!value) return null;
    return `${value}:00-03:00`;
  }

  function getFriendlyNewsUrl(publicRef) {
    if (!publicRef) return "";
    return `/noticia.html?ref=${encodeURIComponent(publicRef)}`;
  }

  async function requestJson(url, options = {}) {
    const r = await window.Api.apiFetch(url, options);
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  async function inicializarNoticias(perfil, config = {}) {
    perfilLogado = (perfil || "").toUpperCase();
    containerConfig = {
      containerId: "sec-noticias-admin",
      titulo: "📰 Notícias (CMS Público)",
      subtitulo: "Apenas a notícia atual pode ser editada. Arquivadas ficam imutáveis no acervo.",
      esconderCardExterno: false,
      ...config,
    };

    const container = document.getElementById(containerConfig.containerId);
    if (!container) return;

    const ehGestao = ehGestaoNoticias();
    const innerHtml = `
      <div ${containerConfig.esconderCardExterno ? '' : 'class="ui-card"'}>
        <div class="af-standard-header" style="display:flex; justify-content:${ehGestao ? "space-between" : "center"}; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:20px;">
          <div style="${ehGestao ? "" : "width:100%; text-align:center;"}">
            <h2 style="margin:0; text-align:center;">${containerConfig.titulo}</h2>
            <p class="section-subtitle" style="margin:4px 0 0;">${containerConfig.subtitulo}</p>
          </div>
          ${ehGestao ? `<button id="btn-nova-noticia" class="ui-button ui-button-secondary">+ Inserir nova notícia atual</button>` : ''}
        </div>

        <section style="margin-bottom:16px;">
          <h3 style="margin:0 0 10px; color:#003366; text-align:center;">Notícia atual</h3>
          <div id="noticia-atual-admin"><p style="color:#666;">Carregando...</p></div>
        </section>

        <section>
          <h3 style="margin:0 0 10px; color:#003366; text-align:center;">Arquivo de notícias</h3>
          <div id="noticias-arquivadas-admin"><p style="color:#666;">Carregando...</p></div>
        </section>
      </div>
    `;

    container.innerHTML = innerHtml;
    if (ehGestao) {
      document.getElementById("btn-nova-noticia").onclick = () => abrirModalNoticia();
    }

    await carregarNoticias();
  }

  async function carregarNoticias(paginaArquivadas = 1) {
    const atualEl = document.getElementById("noticia-atual-admin");
    const arquivadasEl = document.getElementById("noticias-arquivadas-admin");
    if (!atualEl || !arquivadasEl) return;

    const respAtual = await requestJson("/api/noticias?status_editorial=ATUAL");
    noticiaAtual = (Array.isArray(respAtual.data) ? respAtual.data[0] : respAtual.data.items?.[0]) || null;

    const respArq = await requestJson(`/api/noticias?status_editorial=ARQUIVADA&pagina=${paginaArquivadas}`);
    noticiasArquivadas = respArq.data.items || [];
    const pagination = respArq.data.pagination || { page: 1, totalPages: 1 };

    renderizarAtual();
    renderizarArquivadas(pagination);
  }

  function renderCardNoticia(n, { mostrarEditar = false, mostrarArquivar = false, mostrarPublicar = false, mostrarExcluir = false, mostrarMetadados = false } = {}) {
    const data = formatDateOnly(n.data_noticia || n.published_at || n.created_at);
    const friendlyRef = formatFriendlyRef(n.public_ref);
    const friendlyUrl = getFriendlyNewsUrl(n.public_ref);

    return `
      <div class="noticia-admin-card" style="border:1px solid #ddd; border-radius:12px; padding:14px; margin-bottom:12px; background:#fff;">
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
          <button class="btn btn-outline btn-sm" onclick="NoticiasAdmin.abrirVisualizacaoNoticia('${n.id}')">📖 Visualizar</button>
          ${n.public_ref ? `<a class="btn btn-outline btn-sm" href="${friendlyUrl}" target="_blank" rel="noopener">🔗 Link amigável</a>` : ''}
          ${mostrarEditar ? `<button class="btn btn-outline btn-sm" onclick="NoticiasAdmin.abrirModalNoticia('${n.id}')">✏️ Editar notícia atual</button>` : ''}
          ${mostrarPublicar ? `<button class="btn btn-primary btn-sm" onclick="NoticiasAdmin.publicarNoticiaAtual('${n.id}')">📢 Publicar notícia</button>` : ''}
          ${mostrarArquivar ? `<button class="btn btn-primary btn-sm" onclick="NoticiasAdmin.arquivarNoticiaAtual('${n.id}')">📦 Arquivar notícia atual</button>` : ''}
          ${mostrarExcluir ? `<button class="btn btn-sm" style="background:#d32f2f; color:#fff; border-color:#d32f2f;" onclick="NoticiasAdmin.excluirNoticiaAtual('${n.id}')">Excluir notícia</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderizarAtual() {
    const el = document.getElementById("noticia-atual-admin");
    if (!el) return;
    if (!noticiaAtual) {
      el.innerHTML = ehGestaoNoticias()
        ? `<p style="color:#475569;">Nenhuma notícia atual ativa. Use “Inserir nova notícia atual” para iniciar o ciclo editorial.</p>`
        : `<p style="color:#475569;">Nenhuma notícia disponível no momento.</p>`;
      return;
    }
    el.innerHTML = renderCardNoticia(noticiaAtual, {
      mostrarEditar: ehGestaoNoticias() && noticiaAtual.is_editable,
      mostrarPublicar: ehGestaoNoticias() && noticiaAtual.is_editable && noticiaAtual.status === "RASCUNHO",
      mostrarArquivar: ehGestaoNoticias() && noticiaAtual.is_editable && noticiaAtual.status === "PUBLICADA",
      mostrarExcluir: ehGestaoNoticias() && noticiaAtual.is_editable,
      mostrarMetadados: ehGestaoNoticias(),
    });
  }

  function renderizarArquivadas(pagination) {
    const el = document.getElementById("noticias-arquivadas-admin");
    if (!el) return;
    if (!noticiasArquivadas.length) {
      el.innerHTML = ehGestaoNoticias()
        ? `<p style="color:#64748b;">Sem notícias arquivadas até o momento.</p>`
        : `<p style="color:#64748b;">Não há notícias anteriores disponíveis.</p>`;
      return;
    }

    let html = noticiasArquivadas.map((n) => `
      <div style="margin-bottom:16px;">
        ${renderCardNoticia(n, { mostrarMetadados: ehGestaoNoticias() })}
        ${ehGestaoNoticias() ? '<p style="margin:-4px 0 0; font-size:0.85rem; color:#b91c1c;">Esta notícia está consolidada e não pode mais ser editada.</p>' : ''}
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
    if (!ok) return alert("Não foi possível abrir a notícia.");

    const modal = document.getElementById("modal-generic");
    if (!modal) return;
    document.getElementById("modal-generic-titulo").textContent = data.titulo || "Notícia";
    document.getElementById("modal-generic-corpo").innerHTML = `
      <article>
        ${data.capa_url ? `<img src="${escape(data.capa_url)}" style="width:100%; border-radius:8px; margin-bottom:12px;">` : ''}
        <div class="markdown-body news-markdown"></div>
        <div style="margin-top:14px; text-align:right;"><button class="ui-button ui-button-outline" onclick="Utils.fecharModal('modal-generic')">Fechar</button></div>
      </article>
    `;
    const md = document.querySelector("#modal-generic-corpo .news-markdown");
    if (window.InformesRenderer?.mountRenderedMarkdown) window.InformesRenderer.mountRenderedMarkdown(md, data.conteudo || "");
    modal.style.display = "flex";
  }

  function renderMidiasEdicao(midias, capaUrl) {
    const itens = midias || [];
    if (!itens.length) return `<p style="color:#64748b; margin:6px 0 0;">Nenhuma mídia anexada ainda.</p>`;
    return `
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:12px; margin-top:8px;">
        ${itens.map((m) => `
          <div style="border:1px solid #e2e8f0; border-radius:8px; padding:6px;">
            ${m.tipo === "VIDEO"
              ? `<video src="${escape(m.url)}" controls style="width:100%; height:96px; object-fit:cover; border-radius:6px;"></video>`
              : `<img src="${escape(m.url)}" style="width:100%; height:96px; object-fit:cover; border-radius:6px;">`
            }
            <div style="margin-top:6px; display:flex; flex-direction:column; gap:6px;">
              <small style="color:#475569;">${m.tipo === "VIDEO" ? "🎬 Vídeo" : "🖼️ Imagem"}</small>
              ${m.tipo === "IMAGEM" ? `
                <button
                  type="button"
                  class="ui-button ui-button-sm ${m.url === capaUrl ? "ui-button-secondary" : "ui-button-outline"}"
                  onclick="NoticiasAdmin.definirCapaMidia(decodeURIComponent('${encodeURIComponent(m.url)}'))">
                  ${m.url === capaUrl ? "✅ Capa selecionada" : "Definir como capa"}
                </button>
              ` : '<small style="color:#94a3b8;">Vídeos não podem ser capa.</small>'}
              <button
                type="button"
                class="ui-button ui-button-sm ui-button-outline"
                onclick="NoticiasAdmin.removerMidia('${m.id}')">
                Remover mídia
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function definirCapaMidia(url) {
    const capaInput = document.querySelector('#form-noticia-admin input[name="capa_url"]');
    if (!capaInput) return;
    capaInput.value = url || "";

    const galeria = document.getElementById("noticia-midias-edit");
    if (galeria && noticiaAtual?.midias) {
      galeria.innerHTML = renderMidiasEdicao(noticiaAtual.midias, capaInput.value);
    }
  }

  async function abrirModalNoticia(id = null) {
    if (!ehGestaoNoticias()) return alert("Apenas gestão pode editar notícias.");

    if (!id && noticiaAtual) {
      const confirmar = confirm("Já existe uma notícia atual. Ao inserir uma nova, a atual será arquivada automaticamente e movida para o arquivo de notícias. Deseja continuar?");
      if (!confirmar) return;
    }

    let noticia = { titulo: "", subtitulo: "", conteudo: "", capa_url: "", destaque: false, midias: [] };
    if (id) {
      const detalhe = await requestJson(`/api/noticias/${id}`);
      if (!detalhe.ok) return alert("Não foi possível carregar a notícia para edição.");
      noticia = detalhe.data;
      if (!noticia.is_editable || noticia.status_editorial === "ARQUIVADA") {
        return alert("Esta notícia está arquivada e não pode ser editada.");
      }
    }

    const modal = document.getElementById("modal-generic");
    if (!modal) return;

    document.getElementById("modal-generic-titulo").textContent = id ? "Editar notícia atual" : "Inserir nova notícia atual";
    document.getElementById("modal-generic-corpo").innerHTML = `
      <form id="form-noticia-admin">
        <div class="field-group"><label>Título</label><input class="ui-input" name="titulo" value="${escape(noticia.titulo)}" required></div>
        <div class="field-group" style="margin-top:10px;"><label>Subtítulo</label><input class="ui-input" name="subtitulo" value="${escape(noticia.subtitulo || "")}"></div>
        <div class="field-group" style="margin-top:10px;"><label>Conteúdo</label><textarea class="ui-textarea" name="conteudo" rows="8" required>${escape(noticia.conteudo || "")}</textarea></div>
        <div class="field-group" style="margin-top:10px;"><label>URL da capa</label><input class="ui-input" name="capa_url" value="${escape(noticia.capa_url || "")}" placeholder="https://..."></div>
        ${id ? `
          <div class="field-group" style="margin-top:10px;">
            <label>Upload de mídia (imagem ou vídeo)</label>
            <input class="ui-input" type="file" id="noticia-upload-midia" accept="image/*,video/*">
            <small style="color:#64748b;">Envie arquivos para compor a matéria sem depender apenas de URL externa.</small>
          </div>
          <div class="field-group" style="margin-top:10px;">
            <label>Mídias anexadas</label>
            <div id="noticia-midias-edit">${renderMidiasEdicao(noticia.midias, noticia.capa_url || "")}</div>
          </div>
        ` : '<p style="margin-top:10px; color:#64748b;">Após criar a notícia, você poderá anexar imagens e vídeos por upload.</p>'}
        <div class="field-group" style="margin-top:10px;"><label>Data da notícia</label><input class="ui-input" type="datetime-local" name="data_noticia" value="${formatDatetimeLocalSaoPaulo(noticia.data_noticia)}"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button type="button" class="ui-button ui-button-outline" onclick="Utils.fecharModal('modal-generic')">Cancelar</button>
          <button type="submit" class="ui-button ui-button-secondary">Salvar notícia atual</button>
        </div>
      </form>
    `;

    modal.style.display = "flex";

    document.getElementById("form-noticia-admin").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const btnSubmit = form.querySelector('button[type="submit"]');
      const originalHtml = btnSubmit?.innerHTML;

      const fd = new FormData(form);
      const body = {
        titulo: fd.get("titulo"),
        subtitulo: fd.get("subtitulo"),
        conteudo: fd.get("conteudo"),
        capa_url: fd.get("capa_url"),
        data_noticia: datetimeLocalToSaoPauloIso(fd.get("data_noticia"))
      };

      try {
        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.setAttribute('aria-busy', 'true');
          btnSubmit.innerHTML = '<span class="ui-spinner" aria-hidden="true"></span> Salvando...';
        }

        const endpoint = id ? `/api/noticias/${id}` : "/api/noticias";
        const method = id ? "PUT" : "POST";
        const resp = await requestJson(endpoint, { method, body });

        if (!resp.ok) {
          alert(resp.data?.message || "Não foi possível salvar.");
          return;
        }

        const noticiaPersistida = resp.data || {};
        if (!id) {
          const verificacao = await requestJson("/api/noticias?status_editorial=ATUAL");
          const atual = Array.isArray(verificacao.data) ? verificacao.data[0] : verificacao.data.items?.[0];
          if (!atual || atual.id !== noticiaPersistida.id) {
            alert("A notícia foi salva, mas não foi confirmada como notícia atual. A operação foi interrompida para evitar falso positivo.");
            return;
          }
        }

        Utils.fecharModal("modal-generic");
        await carregarNoticias();
      } catch (err) {
        console.error('NoticiasAdmin.save.Error', err);
        alert("Erro inesperado ao salvar notícia.");
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.removeAttribute('aria-busy');
          btnSubmit.innerHTML = originalHtml;
        }
      }
    };

    if (id) {
      noticiaAtual = noticia;
      const input = document.getElementById("noticia-upload-midia");
      if (input) {
        input.addEventListener("change", async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          const fd = new FormData();
          fd.append("file", file);
          fd.append("tipo", file.type.startsWith("video/") ? "VIDEO" : "IMAGEM");
          const r = await requestJson(`/api/noticias/${id}/midias`, { method: "POST", body: fd });
          if (!r.ok) return alert(r.data?.message || "Falha ao anexar mídia.");
          await abrirModalNoticia(id);
          await carregarNoticias();
        });
      }
    }
  }

  async function publicarNoticiaAtual(id) {
    if (!ehGestaoNoticias()) return;
    if (!confirm("Publicar notícia atual? O link amigável será gerado neste momento.")) return;
    const resp = await requestJson(`/api/noticias/${id}/publicar`, { method: "POST" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao publicar notícia atual.");
    await carregarNoticias();
    const link = resp.data?.public_ref ? getFriendlyNewsUrl(resp.data.public_ref) : '';
    alert(link ? `Notícia publicada com sucesso! Link amigável: ${window.location.origin}${link}` : "Notícia publicada com sucesso.");
  }

  async function arquivarNoticiaAtual(id) {
    if (!ehGestaoNoticias()) return;
    if (!confirm("Arquivar notícia atual? Esta ação consolida o conteúdo e bloqueia novas edições.")) return;
    const resp = await requestJson(`/api/noticias/${id}/arquivar`, { method: "POST" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao arquivar notícia atual.");
    await carregarNoticias();
    alert("Notícia arquivada com sucesso. Agora você pode criar uma nova notícia atual.");
  }

  async function excluirNoticiaAtual(id) {
    if (!ehGestaoNoticias()) return;
    if (!confirm("Excluir notícia atual? Esta ação remove o rascunho atual permanentemente.")) return;
    const resp = await requestJson(`/api/noticias/${id}`, { method: "DELETE" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao excluir notícia atual.");
    await carregarNoticias();
    alert("Notícia excluída com sucesso.");
  }

  async function removerMidia(midiaId) {
    if (!ehGestaoNoticias()) return;
    if (!noticiaAtual?.id) return;
    if (!confirm("Remover esta mídia da notícia?")) return;
    const resp = await requestJson(`/api/noticias/midias/${midiaId}`, { method: "DELETE" });
    if (!resp.ok) return alert(resp.data?.message || "Falha ao remover mídia.");
    await abrirModalNoticia(noticiaAtual.id);
    await carregarNoticias();
  }

  global.NoticiasAdmin = {
    inicializarNoticias,
    carregarNoticias,
    abrirModalNoticia,
    definirCapaMidia,
    abrirVisualizacaoNoticia,
    removerMidia,
    publicarNoticiaAtual,
    arquivarNoticiaAtual,
    excluirNoticiaAtual,
  };
})(window);
