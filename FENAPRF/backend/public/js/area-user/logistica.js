/**
 * Módulo Logística (Página Inicial)
 * Carregado como script clássico (window.Logistica)
 */

(function (global) {
  if (global.Logistica) return;

  async function inicializarLogistica(perfil) {
    const secLog = document.getElementById("sec-logistica");
    if (!secLog) return;

    const isGestor = ["ADMIN", "DIRETORIA", "COLABORADOR"].includes(perfil);

    secLog.innerHTML = `
        <div class="af-standard-header">
            <h2>🚚 Módulo de Logística</h2>
            <p class="section-subtitle">Gestão de viagens, hospedagem e transporte para eventos.</p>
            ${isGestor ? '<button id="btn-novo-evento" class="btn btn-primary" style="margin-top: 15px;">➕ Novo Evento</button>' : ''}
        </div>
        <div id="logistica-lista-eventos" class="pub-grid" style="margin-top: 20px;">
            <p style="text-align:center; padding: 20px;">Carregando eventos...</p>
        </div>
        <div id="logistica-detalhe-evento" style="display:none; margin-top: 20px;">
            <!-- Carregado dinamicamente -->
        </div>
    `;

    if (isGestor) {
      document.getElementById("btn-novo-evento").onclick = () => abrirModalEvento();
    }

    carregarEventos();
  }

  async function carregarEventos() {
    const container = document.getElementById("logistica-lista-eventos");
    try {
      const r = await window.Api.apiFetch("/api/logistica/eventos");
      const eventos = await r.json();

      if (!eventos || eventos.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding: 40px; color:#666;">Nenhum evento logístico cadastrado.</p>`;
        return;
      }

      container.innerHTML = eventos.map(ev => {
        const tituloEscaped = window.Utils.escapeHTML(ev.titulo);
        return `
        <div class="pub-card" onclick="Logistica.exibirDetalheEvento(${ev.id})">
            <div class="pub-icon">📅</div>
            <h3 class="pub-title">${tituloEscaped}</h3>
            <p class="pub-meta">${new Date(ev.data_inicio).toLocaleDateString()} a ${new Date(ev.data_fim).toLocaleDateString()}</p>
            <div class="btn-action">Ver Detalhes</div>
        </div>
      `}).join("");
    } catch (e) {
      container.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar eventos.</p>`;
    }
  }

  async function exibirDetalheEvento(id) {
    const lista = document.getElementById("logistica-lista-eventos");
    const detalhe = document.getElementById("logistica-detalhe-evento");
    const header = document.querySelector("#sec-logistica .af-standard-header");

    lista.style.display = 'none';
    detalhe.style.display = 'block';
    if(header) header.style.display = 'none';

    detalhe.innerHTML = `<p style="text-align:center; padding: 40px;">Carregando detalhes...</p>`;

    try {
      const [rEv, rIns] = await Promise.all([
        window.Api.apiFetch(`/api/logistica/eventos/${id}`),
        window.Api.apiFetch(`/api/logistica/eventos/${id}/inscricoes`)
      ]);

      const evento = await rEv.json();
      const inscricoes = await rIns.json();
      const userInfo = window.Utils.obterUserInfo();
      const minhaInscricao = inscricoes.find(i => String(i.user_id) === String(userInfo.id));
      const isGestor = ["ADMIN", "DIRETORIA", "COLABORADOR"].includes((userInfo.perfil_acesso || "").toUpperCase());

      detalhe.innerHTML = `
        <button class="btn btn-outline" onclick="Logistica.voltarParaLista()" style="margin-bottom: 20px;">⬅️ Voltar para Lista</button>

        <div class="section-card">
            <div style="display:flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h2>${window.Utils.escapeHTML(evento.titulo)}</h2>
                    <p class="section-subtitle">${window.Utils.escapeHTML(evento.descricao || 'Sem descrição')}</p>
                    <p><strong>Período:</strong> ${new Date(evento.data_inicio).toLocaleDateString()} a ${new Date(evento.data_fim).toLocaleDateString()}</p>
                    ${evento.documento_link ? `<button class="btn btn-outline btn-sm" onclick="Logistica.abrirDoc('${evento.documento_link}')" style="margin-top:10px;">📄 Ver Documento Oficial</button>` : ''}
                </div>
                <div>
                    ${isGestor ? `<button class="btn btn-outline" onclick="Logistica.abrirModalEvento(${JSON.stringify(evento).replace(/"/g, '&quot;')})">⚙️ Editar Evento</button>` : ''}
                </div>
            </div>

            <div style="margin-top: 30px; padding: 20px; background: #f0f7ff; border-radius: 12px; border: 1px solid #cce3ff;">
                <h3>${minhaInscricao ? '✅ Minha Inscrição' : '📝 Realizar Inscrição'}</h3>
                <form id="form-inscricao" style="margin-top: 15px;">
                    <div class="field-row">
                        <div class="field-group">
                            <label>Data/Hora de Chegada</label>
                            <input type="datetime-local" id="data_chegada" value="${minhaInscricao ? new Date(new Date(minhaInscricao.data_chegada).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''}" required />
                        </div>
                        <div class="field-group">
                            <label>Data/Hora de Saída</label>
                            <input type="datetime-local" id="data_saida" value="${minhaInscricao ? new Date(new Date(minhaInscricao.data_saida).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''}" required />
                        </div>
                    </div>
                    <div class="field-group">
                        <label>Observações</label>
                        <textarea id="observacoes" rows="2" placeholder="Informações de voo, hotel ou necessidades especiais...">${minhaInscricao ? minhaInscricao.observacoes || '' : ''}</textarea>
                    </div>
                    <div style="display:flex; gap: 10px; margin-top: 15px;">
                        <button type="button" class="btn btn-primary" onclick="Logistica.salvarInscricao(${id}, ${minhaInscricao ? minhaInscricao.id : 'null'})">
                            ${minhaInscricao ? 'Atualizar Inscrição' : 'Confirmar Inscrição'}
                        </button>
                        ${minhaInscricao ? `<button type="button" class="btn btn-danger" onclick="Logistica.cancelarInscricao(${minhaInscricao.id})">Cancelar Inscrição</button>` : ''}
                    </div>
                </form>
            </div>
        </div>

        <div class="section-card" style="margin-top: 20px; overflow-x: auto;">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3>📋 Tabela de Inscritos</h3>
                ${isGestor ? `
                    <div style="display:flex; gap: 10px;">
                        <button class="btn btn-sm" onclick="Logistica.exportar(${id}, 'pdf')" style="background:#d32f2f; color:white;">📄 PDF</button>
                        <button class="btn btn-sm" onclick="Logistica.exportar(${id}, 'xls')" style="background:#2e7d32; color:white;">📊 Excel</button>
                    </div>
                ` : ''}
            </div>
            <table class="af-table">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Cargo/UF</th>
                        <th>CPF</th>
                        <th>Telefone</th>
                        <th>Chegada</th>
                        <th>Saída</th>
                        <th>Obs.</th>
                        ${isGestor ? '<th>Ações</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${inscricoes.map(i => {
                        let alertClass = '';
                        const hasConflict = inscricoes.some(other => i.id !== other.id && LogisticaConstants.checkConflict(i.cargo, i.uf, other.cargo, other.uf));
                        if(hasConflict) alertClass = 'style="background-color: #fff4e5;"'; // Amarelo suave para conflito

                        return `
                        <tr ${alertClass}>
                            <td><strong>${window.Utils.escapeHTML(i.name)}</strong></td>
                            <td>${window.Utils.escapeHTML(i.cargo || '-')}/${window.Utils.escapeHTML(i.uf || '-')}</td>
                            <td>${window.Formatters ? window.Formatters.formatCpf(i.cpf) : i.cpf}</td>
                            <td>${window.Formatters ? window.Formatters.formatTelefone(i.telefone) : i.telefone}</td>
                            <td>${new Date(i.data_chegada).toLocaleString('pt-BR')}</td>
                            <td>${new Date(i.data_saida).toLocaleString('pt-BR')}</td>
                            <td><small>${window.Utils.escapeHTML(i.observacoes || '-')}</small></td>
                            ${isGestor ? `<td>
                                <button class="btn btn-sm btn-outline" onclick="Logistica.abrirModalEdicaoGestor(${JSON.stringify(i).replace(/"/g, '&quot;')})">✏️</button>
                            </td>` : ''}
                        </tr>
                    `}).join("")}
                </tbody>
            </table>
        </div>
      `;
    } catch (e) {
      console.error(e);
      detalhe.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar detalhes do evento.</p>`;
    }
  }

  function voltarParaLista() {
    document.getElementById("logistica-lista-eventos").style.display = 'grid';
    document.getElementById("logistica-detalhe-evento").style.display = 'none';
    const header = document.querySelector("#sec-logistica .af-standard-header");
    if(header) header.style.display = 'block';
  }

  function abrirModalEvento(evento = null) {
    const modal = document.getElementById("modal-generic");
    const titulo = document.getElementById("modal-generic-titulo");
    const corpo = document.getElementById("modal-generic-corpo");

    titulo.innerText = evento ? "Editar Evento Logístico" : "Novo Evento Logístico";
    corpo.innerHTML = `
        <form id="form-evento">
            <div class="field-group">
                <label>Título</label>
                <input type="text" id="ev-titulo" value="${evento ? window.Utils.escapeHTML(evento.titulo) : ''}" required />
            </div>
            <div class="field-group">
                <label>Descrição</label>
                <textarea id="ev-descricao" rows="3">${evento ? window.Utils.escapeHTML(evento.descricao || '') : ''}</textarea>
            </div>
            <div class="field-row">
                <div class="field-group">
                    <label>Data Início</label>
                    <input type="date" id="ev-data-inicio" value="${evento ? evento.data_inicio.split('T')[0] : ''}" required />
                </div>
                <div class="field-group">
                    <label>Data Fim</label>
                    <input type="date" id="ev-data-fim" value="${evento ? evento.data_fim.split('T')[0] : ''}" required />
                </div>
            </div>
            <div class="field-row">
                <div class="field-group">
                    <label>Status</label>
                    <select id="ev-status">
                        <option value="ativo" ${evento && evento.status === 'ativo' ? 'selected' : ''}>Ativo</option>
                        <option value="encerrado" ${evento && evento.status === 'encerrado' ? 'selected' : ''}>Encerrado</option>
                    </select>
                </div>
            </div>
            <div class="field-group">
                <label>Documento Vinculado (Google Drive)</label>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="ev-doc-link" value="${evento ? window.Utils.escapeHTML(evento.documento_link || '') : ''}" readonly placeholder="Selecione um documento..." />
                    <button type="button" class="btn btn-outline" onclick="Logistica.selecionarDocumento()">Selecionar</button>
                </div>
            </div>
            <div style="margin-top: 20px; text-align: right;">
                <button type="submit" class="btn btn-primary">${evento ? 'Salvar Alterações' : 'Criar Evento'}</button>
            </div>
        </form>
    `;

    document.getElementById("form-evento").onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        titulo: document.getElementById("ev-titulo").value,
        descricao: document.getElementById("ev-descricao").value,
        data_inicio: document.getElementById("ev-data-inicio").value,
        data_fim: document.getElementById("ev-data-fim").value,
        status: document.getElementById("ev-status").value,
        documento_link: document.getElementById("ev-doc-link").value,
      };

      try {
        const url = evento ? `/api/logistica/eventos/${evento.id}` : "/api/logistica/eventos";
        const method = evento ? "PUT" : "POST";
        const r = await window.Api.apiFetch(url, {
          method,
          body: JSON.stringify(payload)
        });
        if (!r.ok) throw new Error("Erro API");
        modal.style.display = 'none';
        carregarEventos();
      } catch (err) {
        alert("Erro ao salvar evento.");
      }
    };

    modal.style.display = 'block';
  }

  function selecionarDocumento() {
    const modalPub = document.createElement('div');
    modalPub.id = "modal-picker-publicacoes";
    modalPub.className = "modal";
    modalPub.style.zIndex = "10001";
    modalPub.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
                <h2>Selecionar Documento</h2>
                <button type="button" class="modal-close" onclick="document.getElementById('modal-picker-publicacoes').remove()">×</button>
            </div>
            <div class="modal-body" id="picker-pub-container" style="max-height: 70vh; overflow-y: auto;">
            </div>
        </div>
    `;
    document.body.appendChild(modalPub);
    modalPub.style.display = 'block';

    window.Publicacoes.inicializarPublicacoes(null, {
        containerId: "picker-pub-container",
        isPicker: true,
        onSelectFile: (file) => {
            document.getElementById("ev-doc-link").value = file.id;
            modalPub.remove();
        }
    });
  }

  async function salvarInscricao(eventoId, inscricaoId) {
    const payload = {
      data_chegada: document.getElementById("data_chegada").value,
      data_saida: document.getElementById("data_saida").value,
      observacoes: document.getElementById("observacoes").value,
    };

    try {
      const url = inscricaoId ? `/api/logistica/inscricoes/${inscricaoId}` : `/api/logistica/eventos/${eventoId}/inscrever`;
      const method = inscricaoId ? "PUT" : "POST";
      const r = await window.Api.apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Erro API");
      }
      alert("Inscrição salva com sucesso!");
      exibirDetalheEvento(eventoId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function cancelarInscricao(id) {
    if(!confirm("Deseja realmente cancelar sua inscrição?")) return;
    try {
      const r = await window.Api.apiFetch(`/api/logistica/inscricoes/${id}`, { method: "DELETE" });
      if(!r.ok) throw new Error("Erro API");
      alert("Inscrição cancelada.");
      const detalhe = document.getElementById("logistica-detalhe-evento");
      // Recarrega o detalhe (precisamos do eventoId, pegamos do HTML se necessário ou passamos por param)
      // Aqui vou apenas voltar para a lista para simplificar ou recarregar
      voltarParaLista();
      carregarEventos();
    } catch (e) {
      alert("Erro ao cancelar.");
    }
  }

  function abrirModalEdicaoGestor(inscricao) {
    const modal = document.getElementById("modal-generic");
    const titulo = document.getElementById("modal-generic-titulo");
    const corpo = document.getElementById("modal-generic-corpo");

    titulo.innerText = `Editar Inscrição: ${inscricao.name}`;
    corpo.innerHTML = `
        <form id="form-gestao-inscricao">
            <div class="field-row">
                <div class="field-group">
                    <label>Data/Hora de Chegada</label>
                    <input type="datetime-local" id="g-data_chegada" value="${new Date(new Date(inscricao.data_chegada).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)}" required />
                </div>
                <div class="field-group">
                    <label>Data/Hora de Saída</label>
                    <input type="datetime-local" id="g-data_saida" value="${new Date(new Date(inscricao.data_saida).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)}" required />
                </div>
            </div>
            <div class="field-group">
                <label>Observações</label>
                <textarea id="g-observacoes" rows="2">${window.Utils.escapeHTML(inscricao.observacoes || '')}</textarea>
            </div>
            <div class="field-group" style="background: #fff4f4; padding: 10px; border-radius: 8px; border: 1px solid #ffcccc;">
                <label style="color: #d32f2f; font-weight: bold;">Justificativa (Obrigatório para Gestão) *</label>
                <textarea id="g-justificativa" rows="2" placeholder="Ex: Solicitado pelo próprio conselheiro..." required></textarea>
            </div>
            <div style="margin-top: 20px; display:flex; justify-content: space-between;">
                <button type="button" class="btn btn-danger" onclick="Logistica.cancelarGestor(${inscricao.id}, ${inscricao.evento_id})">Cancelar Inscrição</button>
                <button type="submit" class="btn btn-primary">Salvar Alterações</button>
            </div>
        </form>
    `;

    document.getElementById("form-gestao-inscricao").onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        data_chegada: document.getElementById("g-data_chegada").value,
        data_saida: document.getElementById("g-data_saida").value,
        observacoes: document.getElementById("g-observacoes").value,
        justificativa: document.getElementById("g-justificativa").value,
      };

      try {
        const r = await window.Api.apiFetch(`/api/logistica/inscricoes/${inscricao.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        if (!r.ok) throw new Error("Erro API");
        modal.style.display = 'none';
        exibirDetalheEvento(inscricao.evento_id);
      } catch (err) {
        alert("Erro ao salvar.");
      }
    };

    modal.style.display = 'block';
  }

  async function cancelarGestor(id, eventoId) {
    const justificativa = document.getElementById("g-justificativa").value;
    if(!justificativa) {
        alert("Justificativa é obrigatória para cancelamento pela gestão.");
        return;
    }
    if(!confirm("Deseja realmente cancelar esta inscrição?")) return;

    try {
      const r = await window.Api.apiFetch(`/api/logistica/inscricoes/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ justificativa })
      });
      if(!r.ok) throw new Error("Erro API");
      document.getElementById("modal-generic").style.display = 'none';
      exibirDetalheEvento(eventoId);
    } catch (e) {
      alert("Erro ao cancelar.");
    }
  }

  function exportar(id, format) {
    const token = localStorage.getItem("token");
    window.open(`/api/logistica/eventos/${id}/exportar?format=${format}&token=${token}`, '_blank');
  }

  function abrirDoc(idArquivo) {
    window.Publicacoes.inicializarPublicacoes(null, { isPicker: false }); // Apenas para garantir que o modal está pronto
    // Usamos o método interno do módulo Publicações que já criamos
    // Mas ele não está exportado individualmente.
    // Vou usar uma alternativa: disparar o clique em um card oculto ou apenas chamar a API
    // Na verdade, vou apenas abrir no visualizador padrão
    window.open(`/api/publicacoes/arquivo/${idArquivo}?token=${localStorage.getItem("token")}`, '_blank');
  }

  global.Logistica = {
    inicializarLogistica,
    exibirDetalheEvento,
    voltarParaLista,
    abrirModalEvento,
    selecionarDocumento,
    salvarInscricao,
    cancelarInscricao,
    abrirModalEdicaoGestor,
    cancelarGestor,
    exportar,
    abrirDoc
  };

})(typeof window !== 'undefined' ? window : global);
