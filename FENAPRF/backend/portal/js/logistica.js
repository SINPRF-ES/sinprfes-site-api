/**
 * Módulo de Logística (Página Inicial)
 * Gerencia Eventos e Inscrições.
 */

(function (global) {
    if (global.Logistica) return;

    function inicializarLogistica(perfil) {
        const secLogistica = document.getElementById("sec-logistica");
        if (!secLogistica) return;

        const isManager = window.Utils.isGestao(perfil);

        if (!document.getElementById('style-logistica')) {
            const s = document.createElement('style');
            s.id = 'style-logistica';
            s.textContent = `
                .log-card { background: #fff; border-radius: 12px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 25px; }
                .log-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
                .log-event-item { border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; transition: 0.2s; }
                .log-event-item:hover { border-color: #003366; background: #f9f9f9; }
                .log-event-title { font-weight: bold; font-size: 1.2rem; color: #003366; }
                .log-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
                .log-badge-ativo { background: #d4edda; color: #155724; }
                .log-badge-encerrado { background: #f8d7da; color: #721c24; }
                .log-form-group { margin-bottom: 15px; }
                .log-form-group label { display: block; font-weight: bold; margin-bottom: 5px; font-size: 0.9rem; }
                .log-form-group input, .log-form-group textarea, .log-form-group select { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; }
                .log-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.85rem; }
                .log-table th, .log-table td { border: 1px solid #eee; padding: 10px; text-align: left; }
                .log-table th { background: #f8f9fa; color: #003366; }
                .log-row-conflict { background: #fff3cd !important; }
                .btn-log { padding: 10px 20px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; }
                .btn-log-primary { background: #003366; color: #fff; }
                .btn-log-outline { background: transparent; border: 1px solid #003366; color: #003366; }
                .btn-log-danger { background: #d32f2f; color: #fff; }
            `;
            document.head.appendChild(s);
        }

        renderizarBase();

        async function renderizarBase() {
            secLogistica.innerHTML = `
                <div class="log-header" style="border-bottom: 2px solid var(--amarelo);">
                    <h2 style="color:var(--amarelo);">🚚 Logística</h2>
                    ${isManager ? '<button id="btn-novo-evento" class="btn btn-primary">+ Novo Evento</button>' : ''}
                </div>
                <div id="log-lista-eventos">Carregando eventos...</div>
                <div id="log-detalhe-evento" style="display:none;"></div>
            `;

            if (isManager) {
                document.getElementById("btn-novo-evento").addEventListener("click", () => abrirModalEvento());
            }

            carregarEventos();
        }

        async function carregarEventos() {
            try {
                const resp = await window.Api.apiFetch("/api/logistica/eventos");
                const eventos = await resp.json();
                const container = document.getElementById("log-lista-eventos");

                if (eventos.length === 0) {
                    container.innerHTML = "<p>Nenhum evento logístico encontrado.</p>";
                    return;
                }

                if (!container._hasListener) {
                    container.addEventListener("click", (e) => {
                        const item = e.target.closest(".log-event-item");
                        if (item) verDetalhe(item.dataset.id);
                    });
                    container._hasListener = true;
                }

                container.innerHTML = eventos.map(e => `
                    <div class="log-event-item" data-id="${e.id}" style="cursor:pointer; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);">
                        <div style="display:flex; justify-content:space-between;">
                            <span class="log-event-title" style="color:var(--amarelo);">${e.titulo}</span>
                            <span class="log-badge log-badge-${e.status}">${e.status}</span>
                        </div>
                        <p style="margin: 10px 0; color: rgba(255,255,255,0.9);">${e.descricao || 'Sem descrição'}</p>
                        <small style="color:rgba(255,255,255,0.6);">📅 ${new Date(e.data_inicio).toLocaleString()} até ${new Date(e.data_fim).toLocaleString()}</small>
                    </div>
                `).join("");
            } catch (err) {
                console.error(err);
            }
        }

        async function verDetalhe(id) {
            const container = document.getElementById("log-lista-eventos");
            const detalhe = document.getElementById("log-detalhe-evento");
            container.style.display = "none";
            detalhe.style.display = "block";

            try {
                const respE = await window.Api.apiFetch(`/api/logistica/eventos`);
                const eventos = await respE.json();
                const evento = eventos.find(e => e.id === id);
                if (!evento) return;

                const respI = await window.Api.apiFetch(`/api/logistica/eventos/${id}/inscricoes`);
                const inscricoes = await respI.json();

                if (!detalhe._hasListener) {
                    detalhe.addEventListener("click", (e) => {
                        const btn = e.target.closest("[data-action]");
                        if (!btn) return;
                        const action = btn.dataset.action;
                        const eid = btn.dataset.eid;
                        const iid = btn.dataset.iid;
                        const type = btn.dataset.type;

                        if (action === "voltar") voltarLista();
                        else if (action === "editar-evento") abrirModalEvento(eid);
                        else if (action === "exportar") exportar(eid, type);
                        else if (action === "gerenciar-inscricao") abrirModalInscricao(iid);
                    });
                    detalhe._hasListener = true;
                }

                detalhe.innerHTML = `
                    <button class="btn-log btn-log-outline" data-action="voltar" style="margin-bottom:20px;">← Voltar</button>
                    <div class="log-card">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <h3 style="color:#003366; margin:0;">${evento.titulo}</h3>
                                <p>${evento.descricao || ''}</p>
                                <small>Período: ${new Date(evento.data_inicio).toLocaleString()} - ${new Date(evento.data_fim).toLocaleString()}</small>
                            </div>
                            <div style="display:flex; gap:10px;">
                                ${isManager ? `
                                    <button class="btn-log btn-log-outline" data-action="editar-evento" data-eid="${evento.id}">Editar</button>
                                    <button class="btn-log btn-log-danger" data-action="exportar" data-eid="${evento.id}" data-type="pdf">PDF</button>
                                    <button class="btn-log btn-log-primary" data-action="exportar" data-eid="${evento.id}" data-type="xls" style="background:#27ae60;">XLS</button>
                                ` : ''}
                            </div>
                        </div>

                        <hr style="margin:20px 0; border:0; border-top:1px solid #eee;">

                        <div id="area-minha-inscricao"></div>

                        <h4 style="margin-top:30px; color:#003366;">📋 Inscrições Confirmadas</h4>
                        <div style="overflow-x:auto;">
                            <table class="log-table" id="tabela-logistica">
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Cargo</th>
                                        <th>UF</th>
                                        <th>Chegada</th>
                                        <th>Saída</th>
                                        ${isManager ? '<th>Ações</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${inscricoes.map(i => {
                                        // Simulação simples de conflito no frontend web
                                        const conflitos = verificarConflitosSimples(i, inscricoes);
                                        return `
                                            <tr class="${conflitos ? 'log-row-conflict' : ''}">
                                                <td><strong>${i.nome}</strong></td>
                                                <td>${i.cargo || '-'}</td>
                                                <td>${i.uf || '-'}</td>
                                                <td>${new Date(i.data_chegada).toLocaleString()}</td>
                                                <td>${new Date(i.data_saida).toLocaleString()}</td>
                                                ${isManager ? `
                                                    <td>
                                                        <button class="btn-log btn-log-outline" style="padding:4px 8px; font-size:0.7rem;" data-action="gerenciar-inscricao" data-iid="${i.id}">Gerenciar</button>
                                                    </td>
                                                ` : ''}
                                            </tr>
                                        `;
                                    }).join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            } catch (err) { console.error(err); }
        }

        function verificarConflitosSimples(item, todas) {
            const daMesmaUF = todas.filter(t => t.uf === item.uf && t.id !== item.id);
            if (daMesmaUF.length === 0) return false;

            const grupo1 = ['Presidente', 'Vice-Presidente'];
            const grupo2 = ['Delegado Representante', 'Delegado Substituto'];

            if (grupo1.includes(item.cargo)) {
                if (daMesmaUF.some(t => grupo1.includes(t.cargo))) return true;
            }
            if (grupo2.includes(item.cargo)) {
                if (daMesmaUF.some(t => grupo2.includes(t.cargo))) return true;
            }
            if (daMesmaUF.some(t => t.cargo === item.cargo)) return true; // Duplicidade

            return false;
        }

        function abrirModalInscricao(id) {
            alert("Gerenciamento de Inscrição: Use o App Mobile para controle total de entrada/saída.");
        }

        function abrirModalEvento(id = null) {
            // Implementação simplificada de modal via alert/prompt ou injetando HTML
            // Para brevidade, usaremos window.Utils.abrirModalGenerico se existir
            alert("Gestão de Eventos: Use o App Mobile para uma experiência completa de criação/edição com seleção de documentos.");
        }

        function exportar(eventoId, tipo) {
            const token = localStorage.getItem("token");
            window.open(`/api/logistica/eventos/${eventoId}/exportar/${tipo}?token=${token}`);
        }

        function voltarLista() {
            document.getElementById("log-lista-eventos").style.display = "block";
            document.getElementById("log-detalhe-evento").style.display = "none";
            carregarEventos();
        }
    }

    global.Logistica = {
        inicializarLogistica
    };

})(typeof window !== 'undefined' ? window : global);
