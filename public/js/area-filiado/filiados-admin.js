import {
  apiFetch,
  aplicarMascaraTelefone,
  formatarCPF,
  normalizarTextoBusca,
  formatarTelefoneTexto,
  aplicarMascaraCPF,
  aplicarMascaraCEP,
  gerarCamposDependentes
} from './utils.js';

let cacheLista = [];
const SITUACAO_OPCOES = ["ATIVO", "VETERANO", "PENSIONISTA"];

// opções fixas de lotação (select)
const LOTACAO_OPCOES = [
  "SEDE",
  "DEL 01 - Viana",
  "DEL 02 - Serra",
  "DEL 03 - Guarapari",
  "DEL 04 - Linhares."
];

// Variáveis de estado
let perfilAtual = null;
let handlersConfigurados = false;

function toDateInputValue(v) {
    // Aceita: yyyy-MM-dd, yyyy-MM-ddTHH:mm..., dd/MM/yyyy ou null
    if (!v) return "";
    const s = String(v).trim();
    // dd/MM/yyyy
    const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (mBr) return `${mBr[3]}-${mBr[2]}-${mBr[1]}`;
    // yyyy-MM-dd
    const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
    return "";
}

function avatarHtml(avatarUrl, nome) {
    const safeNome = (nome || "").toString();
    const src = avatarUrl ? avatarUrl : "/img/avatar-placeholder.png";
    return `<img class="avatar-mini" src="${src}" alt="Avatar ${safeNome}" onerror="this.src='/img/avatar-placeholder.png'">`;
}

export async function inicializarFiliados(perfil) {
    const listaEl = document.getElementById("lista-filiados");
    if (!listaEl) return;

    perfilAtual = (perfil || "").toUpperCase();

    // 1. CSS
    // Estilos do módulo foram movidos para o arquivo global style.css (seção "FILIADOS ADMIN").
    // 2. CONFIGURAÇÃO DE LISTENERS
    if (!handlersConfigurados) {
        const btnNovo = document.getElementById("btn-novo-filiado");
        const containerNovo = document.getElementById("novo-filiado-container");

        if (btnNovo) {
            if (["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual)) {
                btnNovo.style.display = "inline-block";
                const novoBtn = btnNovo.cloneNode(true);
                btnNovo.parentNode.replaceChild(novoBtn, btnNovo);

                // ✅ Renderiza form de novo filiado (uma vez) e só alterna visibilidade no click
                if (containerNovo) {
                    renderizarFormularioNovoFiliado(containerNovo);
                    containerNovo.style.display = "none";
                }

                novoBtn.addEventListener("click", () => abrirNovoFiliado(containerNovo));
            } else {
                btnNovo.style.display = 'none';
            }
        }

        const campoBusca = document.getElementById("busca-filiados");
        if (campoBusca) {
            const novoInput = campoBusca.cloneNode(true);
            campoBusca.parentNode.replaceChild(novoInput, campoBusca);

            // Busca por nome/CPF
            novoInput.addEventListener("input", (e) => filtrarLista(e.target.value));
            if (novoInput.value) setTimeout(() => filtrarLista(novoInput.value), 100);

            // Filtros (injeção garantida)
            if (!document.getElementById("filtro-estado-cadastro")) {
                const filtros = document.createElement("div");
                filtros.className = "row-filtros";
                filtros.innerHTML = `
                    <label>
                        Estado do cadastro:
                        <select id="filtro-estado-cadastro" style="padding:6px; border-radius:6px; border:1px solid #ccc; margin-left:6px;">
                            <option value="CADASTRO_ATIVO" selected>Cadastro ativo</option>
                            <option value="ARQUIVADOS">Arquivados</option>
                            <option value="TODOS">Todos</option>
                        </select>
                    </label>

                    <label>
                        Situação funcional:
                        <select id="filtro-situacao-funcional" style="padding:6px; border-radius:6px; border:1px solid #ccc; margin-left:6px;">
                            <option value="TODOS" selected>Todos</option>
                            <option value="ATIVO">Ativo</option>
                            <option value="VETERANO">Veterano</option>
                            <option value="PENSIONISTA">Pensionista</option>
                        </select>
                    </label>
                `;

                novoInput.insertAdjacentElement("afterend", filtros);

                // Estado do cadastro: precisa recarregar da API (para incluir/filtrar arquivados)
                filtros.querySelector("#filtro-estado-cadastro").addEventListener("change", () => {
                    carregarLista();
                });

                // Situação funcional: filtro client-side (sem reload)
                filtros.querySelector("#filtro-situacao-funcional").addEventListener("change", () => {
                    filtrarLista(document.getElementById("busca-filiados")?.value || "");
                });
            }
        }

        handlersConfigurados = true;
    }

    // 3. CARREGAMENTO DE DADOS
    await carregarLista();
}

async function carregarLista() {
    const listaEl = document.getElementById("lista-filiados");
    if (!listaEl) return;

    try {
        listaEl.innerHTML = `<p style="color:#fff; text-align:center;">Carregando base de dados...</p>`;
        const estado = (document.getElementById("filtro-estado-cadastro")?.value || "CADASTRO_ATIVO").toUpperCase();

        let url = "/api/filiados";
        if (estado === "TODOS") url = "/api/filiados?incluirArquivados=1";
        if (estado === "ARQUIVADOS") url = "/api/filiados?incluirArquivados=1";

        const r = await apiFetch(url);
        if (r && r.ok) {
            const d = await r.json();
            cacheLista = d.filiados || d || [];
            filtrarLista(document.getElementById("busca-filiados")?.value || "");
        } else {
            listaEl.innerHTML = `<p style="color:#e74c3c; text-align:center;">Erro ao carregar lista.</p>`;
        }
    } catch (e) {
        console.error(e);
        listaEl.innerHTML = `<p style="color:#e74c3c; text-align:center;">Erro de conexão.</p>`;
    }
}

function filtrarLista(termo) {
    const el = document.getElementById("lista-filiados");
    if (!el) return;

    const t = normalizarTextoBusca(termo || "");

    // 1) Filtro por texto (nome/CPF)
    let res = cacheLista.filter((f) => {
        const nome = normalizarTextoBusca(f?.nome || "");
        const cpf = normalizarTextoBusca(f?.cpf || "");
        return nome.includes(t) || cpf.includes(t);
    });

    // 2) Filtros adicionais
    const filtroSituacao = (document.getElementById("filtro-situacao-funcional")?.value || "TODOS").toUpperCase();
    const filtroEstado = (document.getElementById("filtro-estado-cadastro")?.value || "VIGENTES").toUpperCase();

    if (filtroSituacao !== "TODOS") {
        res = res.filter((f) => String((f?.situacao || "ATIVO")).toUpperCase() === filtroSituacao);
    }

    if (filtroEstado === "ARQUIVADOS") {
        res = res.filter((f) => String((f?.estado_cadastro || (f?.arquivado_em ? "ARQUIVADO" : "CADASTRO_ATIVO"))).toUpperCase() === "ARQUIVADO");
    } else if (filtroEstado === "CADASTRO_ATIVO") {
        res = res.filter((f) => String((f?.estado_cadastro || (f?.arquivado_em ? "ARQUIVADO" : "CADASTRO_ATIVO"))).toUpperCase() === "CADASTRO_ATIVO");
    }

    if (!res.length) {
        el.innerHTML = `<div style="background:#fff; color:#333; padding:20px; border-radius:8px; text-align:center;">Nenhum filiado encontrado.</div>`;
        return;
    }

    const podeEditar = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAtual);
    const ehAdmin = perfilAtual === "ADMIN";
    const podeEditarCpf = ["ADMIN", "FUNCIONARIO", "DIRETORIA"].includes(perfilAtual);

    el.innerHTML = res.map(f => {
        const situacao = (f.situacao || 'ATIVO').toUpperCase();
        const classeStatus = situacao === 'ATIVO' ? 'status-ativo' : (situacao === 'VETERANO' ? 'status-veterano' : 'status-pensionista');

        const tel1Raw = (f.telefone1 || "").toString().replace(/\D/g, "");
        const tel2Raw = (f.telefone2 || "").toString().replace(/\D/g, "");
        const tels = [tel1Raw, tel2Raw].filter(Boolean).map(formatarTelefoneTexto).join(" / ");

        const header = `
            <div class="filiado-header">
                <div class="filiado-left">
                    ${avatarHtml(f.avatar_url, f.nome)}
                    <div>
                        <div class="filiado-nome">${f.nome}</div>
                        <div class="filiado-meta">CPF: ${formatarCPF(f.cpf)} &bull; ${f.lotacao || 'SEDE'}</div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span class="filiado-badge" style="background:${classeStatus === 'status-ativo' ? '#e8f8f5' : '#fef9e7'}; color:#333;">${situacao}</span>
                    <div style="margin-top:5px; font-size:0.9rem; color:#555;">📞 ${tels || '-'}</div>
                </div>
            </div>`;

        const isArquivado = String((f?.estado_cadastro || (f?.arquivado_em ? "ARQUIVADO" : "CADASTRO_ATIVO"))).toUpperCase() === "ARQUIVADO";
        const arquivadoInfo = isArquivado ? `
            <div class="af-archived-banner" style="margin-top:10px; padding:10px 12px; background:#fff3cd; border:1px solid #ffeeba; border-radius:8px; color:#5a4a00;">
                <strong>Cadastro arquivado</strong>${f?.arquivado_em ? ` • ${new Date(f.arquivado_em).toLocaleString('pt-BR')}` : ``}
                ${f?.arquivado_motivo ? `<div style="margin-top:6px; font-size:12px;"><strong>Motivo:</strong> ${String(f.arquivado_motivo)}</div>` : ``}
            </div>` : ``;

        // Ações (somente para quem pode editar)
        const acoesArquivamento = podeEditar ? `
            <div class="af-archive-actions" style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                ${isArquivado
                    ? `<button type="button" class="btn btn-outline btn-desarquivar-filiado" data-id="${f.id}">📤 Desarquivar</button>`
                    : `<button type="button" class="btn btn-outline btn-arquivar-filiado" data-id="${f.id}">📥 Arquivar</button>`
                }
            </div>` : ``;

        if (!podeEditar) return `<div class="filiado-card ${classeStatus}">${header}${arquivadoInfo}</div>`;

        const attrCpf = podeEditarCpf ? '' : 'disabled style="background:#eee; cursor:not-allowed;"';

        const adminSection = ehAdmin ? `
            <div class="edit-group admin-field">
                <label>Perfil de Acesso (ADMIN)</label>
                <select name="perfil_acesso">
                    <option value="FILIADO" ${f.perfil_acesso === 'FILIADO' ? 'selected' : ''}>FILIADO</option>
                    <option value="ORGANIZADOR" ${f.perfil_acesso === 'ORGANIZADOR' ? 'selected' : ''}>ORGANIZADOR</option>
                    <option value="FUNCIONARIO" ${f.perfil_acesso === 'FUNCIONARIO' ? 'selected' : ''}>FUNCIONARIO</option>
                    <option value="DIRETORIA" ${f.perfil_acesso === 'DIRETORIA' ? 'selected' : ''}>DIRETORIA</option>
                    <option value="ADMIN" ${f.perfil_acesso === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                </select>
            </div>` : '';

        const lotacaoAtual = (f.lotacao || "SEDE").toString();

        const editForm = `
            <details class="edit-area">
                <summary class="btn-editar-toggle">✏️ Editar dados completos <span class="seta">▲</span></summary>

                ${arquivadoInfo}
                ${acoesArquivamento}

                <form class="edit-form" data-id="${f.id}">
                    <div class="edit-grid">
                        <div class="edit-group">
                            <label>Nome</label>
                            <input name="nome" value="${escapeHtml(f.nome || '')}">
                        </div>

                        <div class="edit-group">
                            <label>CPF</label>
                            <input name="cpf" value="${escapeHtml(f.cpf || '')}" ${attrCpf}>
                        </div>

                        <div class="edit-group">
                            <label>Data de Nascimento</label>
                            <input type="date" name="data_nascimento" value="${escapeHtml(toDateInputValue(f.data_nascimento))}">
                        </div>

                        <div class="edit-group">
                            <label>E-mail 1</label>
                            <input name="email1" value="${escapeHtml(f.email1 || '')}">
                        </div>

                        <div class="edit-group">
                            <label>E-mail 2</label>
                            <input name="email2" value="${escapeHtml(f.email2 || '')}">
                        </div>

                        <div class="edit-group">
                            <label>Tel 1</label>
                            <input name="telefone1" value="${escapeHtml(f.telefone1 || '')}" class="campo-telefone">
                        </div>

                        <div class="edit-group">
                            <label>Tel 2</label>
                            <input name="telefone2" value="${escapeHtml(f.telefone2 || '')}" class="campo-telefone">
                        </div>

                        <div class="edit-group">
                            <label>Lotação</label>
                            <select name="lotacao">
                                ${LOTACAO_OPCOES.map(op => {
                                    const selected = (lotacaoAtual === op) ? 'selected' : '';
                                    return `<option value="${escapeHtml(op)}" ${selected}>${escapeHtml(op)}</option>`;
                                }).join("")}
                            </select>
                        </div>

                        <div class="edit-group">
                            <label>Situação</label>
                            <select name="situacao">
                                ${SITUACAO_OPCOES.map(op => `<option value="${op}" ${(f.situacao || 'ATIVO').toUpperCase() === op ? 'selected' : ''}>${op}</option>`).join("")}
                            </select>
                        </div>

                        ${adminSection}

                        <div class="edit-group span-2">
                            <label>Logradouro</label>
                            <input name="endereco" value="${escapeHtml(f.endereco || '')}">
                        </div>

                        <div class="edit-group">
                            <label>Bairro</label>
                            <input name="bairro" value="${escapeHtml(f.bairro || '')}">
                        </div>

                        <div class="edit-group">
                            <label>Perfil</label>
                            <select name="perfil">
                                <option value="FILIADO" ${f.perfil === 'FILIADO' ? 'selected' : ''}>FILIADO</option>
                                <option value="ORGANIZADOR" ${f.perfil === 'ORGANIZADOR' ? 'selected' : ''}>ORGANIZADOR</option>
                                <option value="FUNCIONARIO" ${f.perfil === 'FUNCIONARIO' ? 'selected' : ''}>FUNCIONARIO</option>
                                <option value="DIRETORIA" ${f.perfil === 'DIRETORIA' ? 'selected' : ''}>DIRETORIA</option>
                                <option value="ADMIN" ${f.perfil === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                            </select>
                        </div>

                        <div class="edit-group">
                            <label>Nº</label>
                            <input name="numero" value="${escapeHtml(f.numero || '')}">
                        </div>

                        <div class="edit-group">
                            <label>Compl.</label>
                            <input name="complemento" value="${escapeHtml(f.complemento || '')}">
                        </div>

                        <div class="edit-group endereco-grid span-2">
                            <div class="edit-group">
                                <label>CEP</label>
                                <div class="cep-wrapper">
                                    <input class="campo-cep-admin" name="cep" value="${escapeHtml(f.cep || '')}" placeholder="00000000">
                                    <button type="button" class="btn-buscar-cep-admin" title="Buscar CEP">🔎</button>
                                </div>
                            </div>

                            <div class="edit-group">
                                <label>Cidade</label>
                                <input name="cidade" value="${escapeHtml(f.cidade || '')}">
                            </div>

                            <div class="edit-group">
                                <label>UF</label>
                                <input name="uf" value="${escapeHtml(f.uf || '')}">
                            </div>

                            <div class="edit-group span-all">
                                <label>Logradouro</label>
                                <input name="logradouro" value="${escapeHtml(f.logradouro || '')}">
                            </div>

                            <div class="endereco-linha3">
                                <div class="edit-group">
                                    <label>Nº</label>
                                    <input name="numero_endereco" value="${escapeHtml(f.numero_endereco || f.numero || '')}">
                                </div>
                                <div class="edit-group">
                                    <label>Compl.</label>
                                    <input name="complemento_endereco" value="${escapeHtml(f.complemento_endereco || f.complemento || '')}">
                                </div>
                            </div>
                        </div>

                        <div class="edit-group span-2">
                            <div class="dependentes-header" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                                <h4 style="margin: 0; border: none; padding: 0;">Dependentes</h4>
                                <button type="button" class="btn btn-danger-outline btn-sm btn-toggle-excluir-dependentes-admin" data-filiado-id="${f.id}">Excluir</button>
                            </div>
                            <div id="painel-excluir-dependentes-admin-${f.id}" style="display: none; background: #fff8f8; border: 1px solid #e57373; border-radius: 8px; padding: 15px; margin-top: 10px;">
                                <p style="margin-top:0; font-weight:bold;">Selecione para remover:</p>
                                <div id="checkboxes-excluir-dependentes-admin-${f.id}" style="display: flex; flex-direction: column; gap: 8px;"></div>
                                <div style="margin-top: 15px; text-align: right;">
                                    <button type="button" class="btn btn-danger btn-confirmar-exclusao-dependentes-admin" data-filiado-id="${f.id}">Confirmar Exclusão</button>
                                </div>
                            </div>
                            <div id="dependentes-container-edicao-${f.id}">
                                <!-- Campos dos dependentes serão inseridos aqui -->
                            </div>
                        </div>

                        <div class="edit-group span-2">
                            <label>Avatar (foto)</label>
                            <div class="avatar-actions">
                                <img class="avatar-preview" src="${escapeHtml(f.avatar_url || '/img/avatar-placeholder.png')}" alt="Preview avatar" onerror="this.src='/img/avatar-placeholder.png'">
                                <input type="file" name="avatar" accept="image/*">
                                <button type="button" class="btn-upload-avatar">Enviar foto</button>
                                <button type="button" class="btn btn-danger btn-remover-avatar" data-id="${f.id}">Remover foto</button>
                            </div>
                        </div>
                    </div>

                    <button type="submit" class="btn-save">💾 Salvar Alterações</button>
                </form>
            </details>
        `;

        return `<div class="filiado-card ${classeStatus}">${header}${editForm}</div>`;
    }).join("");

    // Listeners dos forms (delegação)
    configurarListenersEdicao();
}

function configurarListenersEdicao() {
    const root = document.getElementById("lista-filiados");
    if (!root) return;

    // Delegação para submit
    root.querySelectorAll("form.edit-form").forEach((form) => {
        if (form.dataset.bound === "1") return;
        form.dataset.bound = "1";

        const filiadoId = form.dataset.id;
        const filiado = cacheLista.find(f => f.id == filiadoId);

        // --- Renderiza e preenche dependentes ---
        const containerDependentes = form.querySelector(`#dependentes-container-edicao-${filiadoId}`);
        if (containerDependentes && filiado) {
            gerarCamposDependentes(containerDependentes, `edicao-${filiadoId}`);

            for (let i = 1; i <= 5; i++) {
                const nome = form.querySelector(`#edicao-${filiadoId}-dep${i}_nome`);
                const cpf = form.querySelector(`#edicao-${filiadoId}-dep${i}_cpf`);
                const dataNascimento = form.querySelector(`#edicao-${filiadoId}-dep${i}_data_nascimento`);
                const parentesco = form.querySelector(`#edicao-${filiadoId}-dep${i}_parentesco`);

                if (nome) nome.value = filiado[`dep${i}_nome`] || '';
                if (cpf) {
                    cpf.value = filiado[`dep${i}_cpf`] || '';
                    aplicarMascaraCPF(cpf);
                }
                if (dataNascimento) dataNascimento.value = filiado[`dep${i}_data_nascimento`] ? filiado[`dep${i}_data_nascimento`].split('T')[0] : '';

                // Lógica para preencher o campo de parentesco (select + outro)
                const parentescoValor = filiado[`dep${i}_parentesco`] || '';
                const selectParentesco = form.querySelector(`#edicao-${filiadoId}-dep${i}_parentesco_select`);
                const inputOutro = form.querySelector(`#edicao-${filiadoId}-dep${i}_parentesco_outro`);
                const inputHidden = form.querySelector(`#edicao-${filiadoId}-dep${i}_parentesco`);

                if (selectParentesco && inputOutro && inputHidden) {
                    inputHidden.value = parentescoValor;
                    const opcoesPadrao = Array.from(selectParentesco.options).map(opt => opt.value);

                    if (opcoesPadrao.includes(parentescoValor)) {
                        selectParentesco.value = parentescoValor;
                        inputOutro.style.display = 'none';
                        inputOutro.value = '';
                    } else if (parentescoValor) {
                        selectParentesco.value = 'Outro';
                        inputOutro.style.display = 'block';
                        inputOutro.value = parentescoValor;
                    } else {
                        selectParentesco.value = '';
                        inputOutro.style.display = 'none';
                        inputOutro.value = '';
                    }
                }
            }
        }

        // --- LÓGICA DE EXCLUSÃO DE DEPENDENTES (ADMIN) ---
        const dependentesAtuais = [];
        for (let i = 1; i <= 5; i++) {
            if (filiado[`dep${i}_nome`]) {
                dependentesAtuais.push({ nome: filiado[`dep${i}_nome`], index: i - 1 });
            }
        }

        const btnToggleExcluir = form.querySelector(`.btn-toggle-excluir-dependentes-admin[data-filiado-id="${filiadoId}"]`);
        const painelExcluir = form.querySelector(`#painel-excluir-dependentes-admin-${filiadoId}`);
        const containerCheckboxes = form.querySelector(`#checkboxes-excluir-dependentes-admin-${filiadoId}`);
        const btnConfirmarExclusao = form.querySelector(`.btn-confirmar-exclusao-dependentes-admin[data-filiado-id="${filiadoId}"]`);

        if (btnToggleExcluir && painelExcluir && containerCheckboxes && btnConfirmarExclusao) {
            if (dependentesAtuais.length === 0) {
                btnToggleExcluir.style.display = 'none';
            }

            btnToggleExcluir.addEventListener("click", () => {
                painelExcluir.style.display = painelExcluir.style.display === 'none' ? 'block' : 'none';
            });

            containerCheckboxes.innerHTML = '';
            dependentesAtuais.forEach(dep => {
                containerCheckboxes.innerHTML += `
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" name="excluir_dependente_admin" value="${dep.index}" style="width: auto;">
                        Dependente ${dep.index + 1}: ${dep.nome}
                    </label>
                `;
            });

            btnConfirmarExclusao.addEventListener("click", async () => {
                const checkboxesMarcados = containerCheckboxes.querySelectorAll('input:checked');
                const indicesParaExcluir = Array.from(checkboxesMarcados).map(cb => parseInt(cb.value, 10));

                if (indicesParaExcluir.length === 0) {
                    alert("Selecione pelo menos um dependente para excluir.");
                    return;
                }

                if (confirm(`Tem certeza que deseja excluir ${indicesParaExcluir.length} dependente(s) do filiado ${filiado.nome}?`)) {
                    try {
                        const r = await apiFetch(`/api/filiados/${filiadoId}/dependentes`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ indices: indicesParaExcluir })
                        });

                        if (r.ok) {
                            alert("Dependentes excluídos com sucesso.");
                            await carregarLista();
                        } else {
                            const err = await r.json();
                            alert(err.message || "Erro ao excluir dependentes.");
                        }
                    } catch (e) {
                        alert("Erro de conexão.");
                    }
                }
            });
        }


        // Máscaras
        form.querySelectorAll(".campo-telefone").forEach(inp => {
            inp.addEventListener("input", () => aplicarMascaraTelefone(inp));
            aplicarMascaraTelefone(inp);
        });

        // Buscar CEP
        const btnCep = form.querySelector(".btn-buscar-cep-admin");
        if (btnCep) {
            btnCep.addEventListener("click", async () => {
                const cepInput = form.querySelector("input[name='cep']");
                const cep = (cepInput?.value || "").replace(/\D/g, "");
                if (!cep || cep.length !== 8) {
                    alert("CEP inválido. Informe 8 dígitos.");
                    return;
                }
                await buscarCepEPreencher(form, cep);
            });
        }

        // Upload avatar
        const btnUpload = form.querySelector(".btn-upload-avatar");
        if (btnUpload) {
            btnUpload.addEventListener("click", async () => {
                const id = form.dataset.id;
                const fileInput = form.querySelector("input[type='file'][name='avatar']");
                const file = fileInput?.files?.[0];
                if (!file) {
                    alert("Selecione um arquivo de imagem antes de enviar.");
                    return;
                }
                await uploadAvatar(id, file, form);
            });
        }

        // Remover avatar
        const btnRemover = form.querySelector(".btn-remover-avatar");
        if (btnRemover) {
            btnRemover.addEventListener("click", async () => {
                const id = btnRemover.dataset.id;
                if (!id) return;
                if (!confirm("Deseja remover a foto do avatar deste usuário?")) return;
                await removerAvatar(id, form);
            });
        }

        // Submit do form
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            await salvarEdicao(form);
        });
    });

    // Arquivar / Desarquivar (delegação)
    root.querySelectorAll(".btn-arquivar-filiado").forEach((btn) => {
        if (btn.dataset.bound === "1") return;
        btn.dataset.bound = "1";
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const motivo = prompt("Informe a justificativa para arquivar o cadastro:");
            if (!motivo) return;
            await arquivarFiliado(id, motivo);
        });
    });

    root.querySelectorAll(".btn-desarquivar-filiado").forEach((btn) => {
        if (btn.dataset.bound === "1") return;
        btn.dataset.bound = "1";
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const motivo = prompt("Informe a justificativa para desarquivar o cadastro:");
            if (!motivo) return;
            await desarquivarFiliado(id, motivo);
        });
    });
}

async function salvarEdicao(form) {
    const id = form.dataset.id;
    if (!id) return;

    const data = new FormData(form);
    const payload = {};

    for (const [k, v] of data.entries()) {
        if (k === "avatar") continue;
        payload[k] = (typeof v === "string") ? v.trim() : v;
    }

    // Normalizações
    if (payload.telefone1) payload.telefone1 = payload.telefone1.replace(/\D/g, "");
    if (payload.telefone2) payload.telefone2 = payload.telefone2.replace(/\D/g, "");
    if (payload.cpf) payload.cpf = payload.cpf.replace(/\D/g, "");
    if (payload.cep) payload.cep = payload.cep.replace(/\D/g, "");

    // Sanitiza CPF dos dependentes
    for (let i = 1; i <= 5; i++) {
        const key = `dep${i}_cpf`;
        if (payload[key]) {
            payload[key] = payload[key].replace(/\D/g, "");
        }
    }

    try {
        const r = await apiFetch(`/api/filiados/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (r && r.ok) {
            alert("Alterações salvas com sucesso.");
            await carregarLista();
        } else {
            const err = await safeJson(r);
            alert(err?.message || "Erro ao salvar alterações.");
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão ao salvar alterações.");
    }
}

async function buscarCepEPreencher(form, cep) {
    try {
        const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const d = await r.json();
        if (d?.erro) {
            alert("CEP não encontrado.");
            return;
        }

        // Preenche com os nomes usados no seu formulário
        const cidade = form.querySelector("input[name='cidade']");
        const uf = form.querySelector("input[name='uf']");
        const logradouro = form.querySelector("input[name='logradouro']");

        if (cidade) cidade.value = d.localidade || "";
        if (uf) uf.value = d.uf || "";
        if (logradouro) logradouro.value = d.logradouro || "";

    } catch (e) {
        console.error(e);
        alert("Erro ao consultar CEP.");
    }
}

async function uploadAvatar(id, file, form) {
    try {
        const fd = new FormData();
        fd.append("avatar", file);

        const r = await apiFetch(`/api/filiados/${id}/avatar`, {
            method: "POST",
            body: fd
        });

        if (r && r.ok) {
            const d = await r.json();
            alert(d?.message || "Foto enviada com sucesso.");

            // Atualiza preview
            const img = form.querySelector(".avatar-preview");
            if (img) img.src = d?.avatar_url || img.src;

            await carregarLista();
        } else {
            const err = await safeJson(r);
            alert(err?.message || "Erro ao enviar foto.");
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão ao enviar foto.");
    }
}

async function removerAvatar(id, form) {
    try {
        const r = await apiFetch(`/api/filiados/${id}/avatar`, { method: "DELETE" });

        if (r && r.ok) {
            const d = await r.json();
            alert(d?.message || "Foto removida.");

            const img = form.querySelector(".avatar-preview");
            if (img) img.src = "/img/avatar-placeholder.png";

            await carregarLista();
        } else {
            const err = await safeJson(r);
            alert(err?.message || "Erro ao remover foto.");
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão ao remover foto.");
    }
}

async function arquivarFiliado(id, motivo) {
    try {
        const r = await apiFetch(`/api/filiados/${id}/arquivar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ motivo })
        });

        if (r && r.ok) {
            const d = await r.json();
            alert(d?.message || "Cadastro arquivado.");
            await carregarLista();
        } else {
            const err = await safeJson(r);
            alert(err?.message || "Erro ao arquivar cadastro.");
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão ao arquivar cadastro.");
    }
}

async function desarquivarFiliado(id, motivo) {
    try {
        const r = await apiFetch(`/api/filiados/${id}/desarquivar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ motivo })
        });

        if (r && r.ok) {
            const d = await r.json();
            alert(d?.message || "Cadastro desarquivado.");
            await carregarLista();
        } else {
            const err = await safeJson(r);
            alert(err?.message || "Erro ao desarquivar cadastro.");
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão ao desarquivar cadastro.");
    }
}

function abrirNovoFiliado(containerNovo) {
    if (!containerNovo) return;
    containerNovo.style.display = containerNovo.style.display === "none" ? "block" : "none";
}

// ✅ NOVO: formulário “Novo Filiado” integrado ao backend existente (POST /api/filiados)
function renderizarFormularioNovoFiliado(containerNovo) {
    if (!containerNovo) return;

    // Evita re-render repetido
    if (containerNovo.dataset.rendered === "1") return;
    containerNovo.dataset.rendered = "1";

    const lotacoes = LOTACAO_OPCOES.map(op => `<option value="${escapeHtml(op)}">${escapeHtml(op)}</option>`).join("");
    const situacoes = SITUACAO_OPCOES.map(op => `<option value="${op}" ${op === "ATIVO" ? "selected" : ""}>${op}</option>`).join("");

    const perfilAcessoSelect = (perfilAtual === "ADMIN")
        ? `
          <div class="edit-group">
            <label>Perfil de Acesso</label>
            <select name="perfil_acesso">
              <option value="FILIADO" selected>FILIADO</option>
              <option value="ORGANIZADOR">ORGANIZADOR</option>
              <option value="FUNCIONARIO">FUNCIONARIO</option>
              <option value="DIRETORIA">DIRETORIA</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>`
        : `<input type="hidden" name="perfil_acesso" value="FILIADO">`;

    containerNovo.innerHTML = `
      <div class="filiado-card" style="margin-top:14px;">
        <div class="filiado-header" style="margin-bottom:10px;">
          <div class="filiado-left">
            <div>
              <div class="filiado-nome">➕ Novo Filiado</div>
              <div class="filiado-meta">Preencha os dados mínimos para criação (Nome, CPF, Email1).</div>
            </div>
          </div>
        </div>

        <form id="form-novo-filiado" class="edit-form">
          <div class="edit-grid">
            <div class="edit-group">
              <label>Nome *</label>
              <input name="nome" required>
            </div>

            <div class="edit-group">
              <label>CPF *</label>
              <input name="cpf" id="novo-cpf" required>
            </div>

            <div class="edit-group">
              <label>Data de Nascimento</label>
              <input type="date" name="data_nascimento">
            </div>

            <div class="edit-group">
              <label>Email 1 *</label>
              <input type="email" name="email1" required>
            </div>

            <div class="edit-group">
              <label>Email 2</label>
              <input type="email" name="email2">
            </div>

            <div class="edit-group">
              <label>Tel 1</label>
              <input name="telefone1" id="novo-tel1" class="campo-telefone">
            </div>

            <div class="edit-group">
              <label>Tel 2</label>
              <input name="telefone2" id="novo-tel2" class="campo-telefone">
            </div>

            <div class="edit-group">
              <label>Lotação</label>
              <select name="lotacao">
                ${lotacoes}
              </select>
            </div>

            <div class="edit-group">
              <label>Situação</label>
              <select name="situacao">
                ${situacoes}
              </select>
            </div>

            ${perfilAcessoSelect}

            <div class="edit-group">
              <label>CEP</label>
              <div class="cep-wrapper">
                <input name="cep" id="novo-cep" placeholder="00000000">
                <button type="button" class="btn-buscar-cep-admin" id="btn-buscar-cep-novo" title="Buscar CEP">🔎</button>
              </div>
            </div>

            <div class="edit-group">
              <label>UF</label>
              <input name="uf" id="novo-uf" readonly style="background:#f7f7f7;">
            </div>

            <div class="edit-group span-2">
              <label>Cidade</label>
              <input name="cidade" id="novo-cidade" readonly style="background:#f7f7f7;">
            </div>

            <div class="edit-group span-2">
              <label>Logradouro/Bairro</label>
              <input name="logradouro_bairro" id="novo-logradouro" readonly style="background:#f7f7f7;">
            </div>

            <div class="edit-group">
              <label>Nº</label>
              <input name="numero" id="novo-numero">
            </div>

            <div class="edit-group">
              <label>Compl.</label>
              <input name="complemento" id="novo-complemento">
            </div>
          </div>

          <div class="edit-group span-2">
              <h4 style="margin-top: 1rem; border-bottom: 1px solid #eee; padding-bottom: 5px;">Dependentes</h4>
              <div id="dependentes-container-novo">
                  <!-- Campos dos dependentes serão inseridos aqui -->
              </div>
          </div>

          <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:12px;">
            <button type="button" class="btn btn-outline" id="btn-cancelar-novo">Cancelar</button>
            <button type="submit" class="btn-save">✅ Criar Filiado</button>
          </div>
        </form>
      </div>
    `;

    // Máscaras
    const cpfEl = containerNovo.querySelector("#novo-cpf");
    if (cpfEl) aplicarMascaraCPF(cpfEl);

    // --- Renderiza campos de dependentes ---
    const containerDependentes = containerNovo.querySelector("#dependentes-container-novo");
    gerarCamposDependentes(containerDependentes, 'novo');
    containerDependentes.querySelectorAll('input[name*="cpf"]').forEach(aplicarMascaraCPF);

    const cepEl = containerNovo.querySelector("#novo-cep");
    if (cepEl) aplicarMascaraCEP(cepEl);

    const tel1 = containerNovo.querySelector("#novo-tel1");
    if (tel1) {
        tel1.addEventListener("input", () => aplicarMascaraTelefone(tel1));
        aplicarMascaraTelefone(tel1);
    }
    const tel2 = containerNovo.querySelector("#novo-tel2");
    if (tel2) {
        tel2.addEventListener("input", () => aplicarMascaraTelefone(tel2));
        aplicarMascaraTelefone(tel2);
    }

    // Buscar CEP (ViaCEP)
    const btnBuscarCep = containerNovo.querySelector("#btn-buscar-cep-novo");
    if (btnBuscarCep) {
        btnBuscarCep.addEventListener("click", async () => {
            const cep = (cepEl?.value || "").replace(/\D/g, "");
            if (cep.length !== 8) {
                alert("CEP inválido. Informe 8 dígitos.");
                return;
            }
            await buscarCepNovoFiliado(cep);
        });
    }

    // Cancelar
    const btnCancelar = containerNovo.querySelector("#btn-cancelar-novo");
    if (btnCancelar) {
        btnCancelar.addEventListener("click", () => {
            containerNovo.style.display = "none";
        });
    }

    // Submit (POST /api/filiados)
    const form = containerNovo.querySelector("#form-novo-filiado");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const fd = new FormData(form);
            const payload = {};
            for (const [k, v] of fd.entries()) {
                payload[k] = (typeof v === "string") ? v.trim() : v;
            }

            // normalizações
            if (payload.cpf) payload.cpf = payload.cpf.replace(/\D/g, "");
            if (payload.telefone1) payload.telefone1 = payload.telefone1.replace(/\D/g, "");
            if (payload.telefone2) payload.telefone2 = payload.telefone2.replace(/\D/g, "");
            if (payload.cep) payload.cep = payload.cep.replace(/\D/g, "");

            // Sanitiza CPF dos dependentes
            for (let i = 1; i <= 5; i++) {
                const key = `dep${i}_cpf`;
                if (payload[key]) {
                    payload[key] = payload[key].replace(/\D/g, "");
                }
            }

            try {
                const r = await apiFetch("/api/filiados", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (r && r.ok) {
                    const d = await safeJson(r);
                    alert(d?.message || "Filiado criado com sucesso.");
                    form.reset();
                    containerNovo.style.display = "none";
                    await carregarLista();
                } else {
                    const err = await safeJson(r);
                    alert(err?.message || "Erro ao criar filiado.");
                }
            } catch (ex) {
                console.error(ex);
                alert("Erro de conexão ao criar filiado.");
            }
        });
    }

    async function buscarCepNovoFiliado(cep) {
        try {
            const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const d = await r.json();
            if (d?.erro) {
                alert("CEP não encontrado.");
                return;
            }
            const elLog = containerNovo.querySelector("#novo-logradouro");
            const elCid = containerNovo.querySelector("#novo-cidade");
            const elUf = containerNovo.querySelector("#novo-uf");

            if (elLog) elLog.value = d.logradouro || "";
            if (elCid) elCid.value = d.localidade || "";
            if (elUf) elUf.value = d.uf || "";
        } catch (e) {
            console.error(e);
            alert("Erro ao consultar CEP.");
        }
    }
}

function escapeHtml(str) {
    return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function safeJson(r) {
    try { return await r.json(); } catch { return null; }
}
