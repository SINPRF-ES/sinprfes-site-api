import {
  apiFetch,
  aplicarMascaraTelefone,
  formatarCPF,
  normalizarTextoBusca,
  formatarTelefoneTexto,
  aplicarMascaraCPF,
  aplicarMascaraCEP
} from './utils.js';

let cacheLista = [];
const SITUACAO_OPCOES = ["ATIVO", "VETERANO", "PENSIONISTA"];

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
                            <input name="lotacao" value="${escapeHtml(f.lotacao || 'SEDE')}">
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

        // ✅ ROTA CORRETA (gestão): /api/filiados/:id/avatar
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

            // Recarrega lista (garante refletir no card)
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
        // ✅ ROTA CORRETA (gestão): /api/filiados/:id/avatar
        const r = await apiFetch(`/api/filiados/${id}/avatar`, { method: "DELETE" });

        if (r && r.ok) {
            const d = await r.json();
            alert(d?.message || "Foto removida.");

            // Atualiza preview
            const img = form.querySelector(".avatar-preview");
            if (img) img.src = "/img/avatar-placeholder.png";

            // Recarrega lista
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
