/**
 * Módulo Filiados Admin (Área do Filiado)
 * Carregado como script clássico (window.FiliadosAdmin)
 */

(function (global) {
    if (global.FiliadosAdminLoaded) return;
    global.FiliadosAdminLoaded = true;

    let cacheLista = [];
    const SITUACAO_OPCOES = ["ATIVO", "VETERANO", "PENSIONISTA"];

    const LOTACAO_OPCOES = [
      "SEDE",
      "DEL 01 - Viana",
      "DEL 02 - Serra",
      "DEL 03 - Guarapari",
      "DEL 04 - Linhares",
      "DEL 05 - Cachoeiro",
      "DEL 06 - Colatina",
      "DEL 07 - São Mateus",
      "OUTRA"
    ];

    let perfilAtual = "FILIADO";
    let handlersConfigurados = false;

    function toDateInputValue(v) {
        if (global.Formatters) return global.Formatters.toDateInputValue(v);
        if (!v) return "";
        const s = String(v).trim();
        const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (mBr) return `${mBr[3]}-${mBr[2]}-${mBr[1]}`;
        const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
        return "";
    }

    async function inicializarFiliados(perfil) {
        perfilAtual = (perfil || "FILIADO").toUpperCase();
        const sec = document.getElementById("sec-filiados");
        if (!sec) return;

        const isGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);
        if (!isGestao) {
            sec.innerHTML = `<div class="section-card"><p style="text-align:center; padding:40px;">Acesso restrito à gestão.</p></div>`;
            return;
        }

        if (!sec.querySelector(".admin-container")) {
            sec.innerHTML = `
                <div class="admin-controls section-card" style="margin-bottom:20px; display:flex; gap:15px; flex-wrap:wrap; align-items:center;">
                    <div style="flex:1; min-width:200px;">
                        <input type="text" id="filtro-busca-filiado" placeholder="Buscar por nome ou CPF..." style="width:100%; padding:10px; border-radius:6px; border:1px solid #ccc;">
                    </div>
                    <div>
                        <select id="filtro-situacao-filiado" style="padding:10px; border-radius:6px; border:1px solid #ccc;">
                            <option value="TODOS">Todas Situações</option>
                            <option value="ATIVO">Ativo</option>
                            <option value="VETERANO">Veterano</option>
                            <option value="PENSIONISTA">Pensionista</option>
                        </select>
                    </div>
                    <div>
                        <button id="btn-abrir-novo-filiado" class="btn btn-primary">+ Novo Filiado</button>
                    </div>
                </div>
                <div id="container-novo-filiado" style="display:none; margin-bottom:25px;"></div>
                <div id="lista-filiados-gestao" class="admin-container">
                    <p style="text-align:center; padding:40px;">Carregando lista de filiados...</p>
                </div>
            `;

            document.getElementById("filtro-busca-filiado").addEventListener("input", renderizarListaFiliados);
            document.getElementById("filtro-situacao-filiado").addEventListener("change", renderizarListaFiliados);
            
            const btnNovo = document.getElementById("btn-abrir-novo-filiado");
            const containerNovo = document.getElementById("container-novo-filiado");
            btnNovo.addEventListener("click", () => {
                renderizarFormularioNovoFiliado(containerNovo);
                containerNovo.style.display = containerNovo.style.display === "none" ? "block" : "none";
            });
        }

        await carregarLista();
    }

    async function carregarLista() {
        const { apiFetch } = global.Utils || {};
        if (!apiFetch) return;

        try {
            const r = await apiFetch("/api/filiados?incluirArquivados=true");
            if (r && r.ok) {
                const dados = await r.json();
                cacheLista = dados.filiados || dados || [];
                renderizarListaFiliados();
            }
        } catch (e) {
            console.error(e);
        }
    }

    function renderizarListaFiliados() {
        const container = document.getElementById("lista-filiados-gestao");
        if (!container) return;

        const busca = (document.getElementById("filtro-busca-filiado")?.value || "").toLowerCase();
        const situacaoFiltro = document.getElementById("filtro-situacao-filiado")?.value || "TODOS";

        const { normalizarTextoBusca, formatarCPF, formatarTelefoneTexto } = global.Utils || {};

        const filtrados = cacheLista.filter(f => {
            const matchBusca = !busca ||
                (f.nome || "").toLowerCase().includes(busca) ||
                (f.cpf || "").replace(/\D/g, "").includes(busca.replace(/\D/g, ""));

            const situacaoF = (f.situacao_funcional || f.situacao || "ATIVO").toUpperCase();
            const matchSituacao = situacaoFiltro === "TODOS" || situacaoF === situacaoFiltro;

            return matchBusca && matchSituacao;
        });

        if (filtrados.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:40px;">Nenhum filiado encontrado.</p>`;
            return;
        }

        container.innerHTML = filtrados.map(f => {
            const situacao = (f.situacao_funcional || f.situacao || 'ATIVO').toUpperCase();
            const classeStatus = situacao === 'ATIVO' ? 'status-ativo' : (situacao === 'VETERANO' ? 'status-veterano' : 'status-pensionista');
            const isArquivado = !!f.arquivado_em;

            const tel1 = (f.telefone1 || "");
            const tel2 = (f.telefone2 || "");
            const tels = [tel1, tel2].filter(Boolean).map(t => formatarTelefoneTexto ? formatarTelefoneTexto(t) : t).join(" / ");

            return `
                <div class="filiado-card ${classeStatus} ${isArquivado ? 'arquivado' : ''}" data-id="${f.id}">
                    <div class="filiado-header">
                        <div class="filiado-info">
                            <div class="filiado-nome">${f.nome} ${isArquivado ? '<span class="badge-arquivado">ARQUIVADO</span>' : ''}</div>
                            <div class="filiado-meta">
                                ${f.cpf ? `CPF: ${formatarCPF ? formatarCPF(f.cpf) : f.cpf} | ` : ''}
                                Lotação: ${f.lotacao || 'SEDE'}
                            </div>
                            <div class="filiado-meta">Tel: ${tels || 'Não informado'}</div>
                        </div>
                        <div class="filiado-actions">
                            <button class="btn btn-sm btn-outline btn-editar-filiado" data-id="${f.id}">Editar</button>
                            ${isArquivado
                                ? `<button class="btn btn-sm btn-success btn-desarquivar-filiado" data-id="${f.id}">Desarquivar</button>`
                                : `<button class="btn btn-sm btn-danger btn-arquivar-filiado" data-id="${f.id}">Arquivar</button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        configurarEventosLista(container);
    }

    function configurarEventosLista(root) {
        root.querySelectorAll(".btn-editar-filiado").forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const filiado = cacheLista.find(x => x.id == id);
                if (filiado) abrirModalEdicao(filiado);
            };
        });

        root.querySelectorAll(".btn-arquivar-filiado").forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                const motivo = prompt("Informe a justificativa para arquivar:");
                if (motivo) await arquivarFiliado(id, motivo);
            };
        });

        root.querySelectorAll(".btn-desarquivar-filiado").forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                const motivo = prompt("Informe a justificativa para desarquivar (opcional):");
                await desarquivarFiliado(id, motivo || "Reativação");
            };
        });
    }

    async function arquivarFiliado(id, motivo) {
        const { apiFetch } = global.Utils || {};
        try {
            const r = await apiFetch(`/api/filiados/${id}/arquivar`, {
                method: "POST",
                body: { motivo }
            });
            if (r.ok) {
                alert("Arquivado com sucesso.");
                await carregarLista();
            }
        } catch (e) { alert("Erro ao arquivar."); }
    }

    async function desarquivarFiliado(id, motivo) {
        const { apiFetch } = global.Utils || {};
        try {
            const r = await apiFetch(`/api/filiados/${id}/desarquivar`, {
                method: "POST",
                body: { motivo }
            });
            if (r.ok) {
                alert("Desarquivado com sucesso.");
                await carregarLista();
            }
        } catch (e) { alert("Erro ao desarquivar."); }
    }

    function abrirModalEdicao(filiado) {
        alert("Edição completa via modal (implementação resumida para correção de scripts).");
        console.log("Editando:", filiado);
    }

    function renderizarFormularioNovoFiliado(container) {
        if (container.dataset.rendered === "1") return;
        container.dataset.rendered = "1";
        container.innerHTML = `<div class="section-card"><h4>Novo Filiado</h4><p>Formulário de criação...</p></div>`;
    }

    global.FiliadosAdmin = {
        inicializarFiliados
    };

})(typeof window !== 'undefined' ? window : global);
