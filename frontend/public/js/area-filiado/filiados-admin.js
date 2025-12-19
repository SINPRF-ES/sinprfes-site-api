import { apiFetch, aplicarMascaraTelefone, formatarCPF, normalizarTextoBusca, formatarTelefoneTexto } from './utils.js';

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

    // 1. INJEÇÃO DE CSS
    if (!document.getElementById('style-filiados-premium')) {
        const s = document.createElement('style');
        s.id = 'style-filiados-premium';
        s.textContent = `
            .search-box-container { background: #003366; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); color: white; }
            .filiado-card { background: #fff; border-left: 5px solid #ccc; border-radius: 8px; padding: 20px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); color: #333; transition: transform 0.2s; }
            .filiado-card:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            .status-ativo { border-left-color: #27ae60; }
            .status-veterano { border-left-color: #f39c12; }
            .status-pensionista { border-left-color: #8e44ad; }
            .filiado-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; }
            .filiado-left { display:flex; align-items:flex-start; gap:12px; }
            .avatar-mini { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #e9ecef; background:#f8f9fa; }
            .filiado-nome { font-size: 1.2rem; font-weight: bold; color: #003366; }
            .filiado-meta { font-size: 0.9rem; color: #666; margin-top: 4px; }
            .filiado-badge { background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }

            details.edit-area { margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px; }
            summary.btn-editar-toggle { cursor: pointer; color: #2980b9; font-weight: 600; list-style: none; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 4px; transition: background 0.2s; }
            summary.btn-editar-toggle:hover { background: #f0f7ff; }
            details[open] summary.btn-editar-toggle .seta { transform: rotate(180deg); }
            .seta { transition: transform 0.2s; display:inline-block; }

            .edit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px; }
            .edit-group { display: flex; flex-direction: column; }
            .edit-group label { font-size: 0.8rem; color: #666; margin-bottom: 4px; font-weight: bold; }
            .edit-group input, .edit-group select { padding: 8px; border: 1px solid #ccc; border-radius: 4px; color: #333; background: #fff; font-size: 0.95rem; }
            .edit-group input:focus, .edit-group select:focus { border-color: #2980b9; outline: none; }
            .admin-field input, .admin-field select { background-color: #fff8e1; border-color: #f1c40f; }
            .btn-save { background: #27ae60; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 15px; width: 100%; }
            .btn-save:hover { background: #219150; }

            .btn-upload-avatar { background:#34495e; color:#fff; border:none; padding:8px 10px; border-radius:5px; cursor:pointer; font-weight:700; }
            .btn-upload-avatar:hover { background:#2c3e50; }
            .avatar-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
            .avatar-preview { width:64px; height:64px; border-radius:50%; object-fit:cover; border:2px solid #e9ecef; background:#f8f9fa; }

            /* Botão de busca de CEP */
            .cep-wrapper { position: relative; }
            .cep-wrapper input.campo-cep-admin { width: 100%; padding-right: 44px; }
            .btn-buscar-cep-admin {
                border: 1px solid #ccc;
                background: #e9ecef;
                cursor: pointer;
                border-radius: 4px;
                font-size: 1.1rem;
                transition: background 0.2s;
                min-width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: absolute;
                right: 4px;
                top: 50%;
                transform: translateY(-50%);
                padding: 0;
            }
            .btn-buscar-cep-admin:hover { background: #dde2e6; }

            
            .row-filtros { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-top:10px; }
            .row-filtros label { font-size:0.9rem; display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none; color:#fff; }
            .row-filtros select { background:#fff; color:#333; }

@media (max-width: 600px) { .filiado-header { flex-direction: column; } }
        `;
        document.head.appendChild(s);
    }

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
        const estado = (document.getElementById("filtro-estado-cadastro")?.value || "VIGENTES").toUpperCase();

        let url = "/api/filiados";
        if (estado === "TODOS") url = "/api/filiados?incluirArquivados=1";
        if (estado === "ARQUIVADOS") url = "/api/filiados?arquivados=1";

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

        if (!podeEditar) return `<div class="filiado-card ${classeStatus}">${header}</div>`;

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

        const dnValue = toDateInputValue(f.data_nascimento);

        return `
            <div class="filiado-card ${classeStatus}">
                ${header}
                <details class="edit-area">
                    <summary class="btn-editar-toggle">✏️ Editar dados completos <span class="seta" style="margin-left:5px;">▼</span></summary>
                    <form class="form-edit-filiado" data-id="${f.id}" style="margin-top:15px;">
                        <div class="edit-grid">
                            <div class="edit-group"><label>Nome</label><input name="nome" value="${f.nome || ''}"></div>
                            <div class="edit-group"><label>CPF</label><input name="cpf" value="${formatarCPF(f.cpf)}" ${attrCpf} placeholder="Somente números"></div>

                            <div class="edit-group"><label>Data de Nascimento</label><input name="data_nascimento" type="date" value="${dnValue}"></div>

                            <div class="edit-group"><label>E-mail 1</label><input name="email1" value="${f.email1 || ''}"></div>
                            <div class="edit-group"><label>E-mail 2</label><input name="email2" value="${f.email2 || ''}"></div>
                            <div class="edit-group"><label>Tel 1</label><input name="telefone1" value="${tel1Raw}"></div>
                            <div class="edit-group"><label>Tel 2</label><input name="telefone2" value="${tel2Raw}"></div>
                            <div class="edit-group"><label>Lotação</label><input name="lotacao" value="${f.lotacao || ''}"></div>
                            <div class="edit-group"><label>Situação</label>
                                <select name="situacao">${SITUACAO_OPCOES.map(op => `<option value="${op}" ${op === situacao ? 'selected' : ''}>${op}</option>`).join('')}</select>
                            </div>
                            <div class="edit-group">
                                <label>Endereço / Bairro</label>
                                <input name="logradouro_bairro" value="${f.logradouro_bairro || ''}" readonly style="background:#f8f9fa;">
                            </div>
                            ${adminSection}
                        </div>

                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(100px, 1fr)); gap:10px; margin-top:10px;">
                             <div class="edit-group"><label>Nº</label><input name="numero" value="${f.numero || ''}"></div>
                             <div class="edit-group"><label>Compl.</label><input name="complemento" value="${f.complemento || ''}"></div>

                             <div class="edit-group">
                                 <label>CEP</label>
                                 <div class="cep-wrapper">
                                     <input class="campo-cep-admin" name="cep" value="${(f.cep || '').toString().replace(/\D/g, '')}" maxlength="8" placeholder="00000000">
                                     <button type="button" class="btn-buscar-cep-admin" title="Buscar Endereço">🔍</button>
                                 </div>
                             </div>

                             <div class="edit-group">
                                <label>Cidade</label>
                                <input name="cidade" value="${f.cidade || ''}" readonly style="background:#f8f9fa;">
                             </div>
                             <div class="edit-group">
                                <label>UF</label>
                                <input name="uf" value="${f.uf || ''}" maxlength="2" readonly style="background:#f8f9fa; text-transform:uppercase;">
                             </div>
                        </div>

                        <div style="margin-top:14px;">
                            <label style="font-size:0.8rem; color:#666; font-weight:bold;">Avatar (foto)</label>
                            <div class="avatar-actions">
                                <img class="avatar-preview" src="${f.avatar_url || '/img/avatar-placeholder.png'}" onerror="this.src='/img/avatar-placeholder.png'">
                                <input type="file" name="avatar_file" accept="image/*">
                                <button type="button" class="btn-upload-avatar">Enviar foto</button>
                            </div>
                        </div>

                        <button type="submit" class="btn-save">💾 Salvar Alterações</button>
                    </form>
                </details>
            </div>`;
    }).join("");

    if (podeEditar) {
        el.querySelectorAll("form.form-edit-filiado").forEach(frm => {
            // Máscaras
            aplicarMascaraTelefone(frm.querySelector('input[name="telefone1"]'));
            aplicarMascaraTelefone(frm.querySelector('input[name="telefone2"]'));

            // Máscara de CPF (somente se não disabled)
            const inputCpf = frm.querySelector('input[name="cpf"]');
            if (inputCpf && !inputCpf.disabled) {
                inputCpf.addEventListener('input', (e) => {
                    let v = e.target.value.replace(/\D/g, "").slice(0, 11);
                    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
                    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
                    e.target.value = v;
                });
            }

            // CEP
            const inputCep = frm.querySelector('input[name="cep"]');
            const btnCep = frm.querySelector('.btn-buscar-cep-admin');

            if (inputCep) {
                inputCep.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 8);
                });
            }

            if (btnCep && inputCep) {
                btnCep.addEventListener('click', async () => {
                    const cepVal = inputCep.value.replace(/\D/g, "");
                    if (cepVal.length !== 8) return alert("CEP inválido. Digite 8 números.");

                    const originalText = btnCep.innerText;
                    btnCep.innerText = "...";

                    try {
                        const r = await fetch(`https://viacep.com.br/ws/${cepVal}/json/`);
                        const d = await r.json();
                        if (d.erro) {
                            alert("CEP não encontrado.");
                        } else {
                            const enderecoCompleto = [d.logradouro, d.bairro].filter(Boolean).join(", ");
                            const campoLogradouroBairro = frm.querySelector('input[name="logradouro_bairro"]');
                            const campoCidade = frm.querySelector('input[name="cidade"]');
                            const campoUf = frm.querySelector('input[name="uf"]');

                            if (campoLogradouroBairro) campoLogradouroBairro.value = enderecoCompleto;
                            if (campoCidade) campoCidade.value = d.localidade || "";
                            if (campoUf) campoUf.value = d.uf || "";
                        }
                    } catch (e) {
                        alert("Erro ao buscar CEP.");
                    } finally {
                        btnCep.innerText = originalText;
                    }
                });

                inputCep.addEventListener('blur', () => {
                    if (inputCep.value.replace(/\D/g, "").length === 8) btnCep.click();
                });
            }

            // Upload avatar
            const btnAvatar = frm.querySelector(".btn-upload-avatar");
            const inputAvatar = frm.querySelector('input[name="avatar_file"]');
            const imgPreview = frm.querySelector(".avatar-preview");

            if (inputAvatar && imgPreview) {
                inputAvatar.addEventListener("change", () => {
                    const file = inputAvatar.files && inputAvatar.files[0];
                    if (file) imgPreview.src = URL.createObjectURL(file);
                });
            }

            if (btnAvatar && inputAvatar) {
                btnAvatar.addEventListener("click", async () => {
                    const id = frm.dataset.id;
                    const file = inputAvatar.files && inputAvatar.files[0];
                    if (!file) return alert("Selecione uma foto (arquivo) antes de enviar.");

                    const fd = new FormData();
                    fd.append("avatar", file);

                    const original = btnAvatar.innerText;
                    btnAvatar.disabled = true;
                    btnAvatar.innerText = "Enviando...";

                    try {
                        const r = await apiFetch(`/api/filiados/${id}/avatar`, { method: "POST", body: fd });
                        const d = await r.json().catch(() => ({}));
                        if (r.ok) {
                            const idx = cacheLista.findIndex(i => String(i.id) === String(id));
                            if (idx !== -1) cacheLista[idx].avatar_url = d.avatar_url || d.filiado?.avatar_url || cacheLista[idx].avatar_url;
                            filtrarLista(document.getElementById("busca-filiados")?.value || "");
                            alert("Foto enviada com sucesso.");
                        } else {
                            alert(d.message || d.error || "Não foi possível enviar a foto.");
                        }
                    } catch (e) {
                        alert("Erro de conexão ao enviar foto.");
                    } finally {
                        btnAvatar.disabled = false;
                        btnAvatar.innerText = original;
                    }
                });
            }

            // Submit
            frm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const id = frm.dataset.id;
                const btn = frm.querySelector(".btn-save");
                const txtOriginal = btn.innerText;
                btn.disabled = true; btn.innerText = "Salvando...";

                const fd = new FormData(frm);
                const payload = {};
                fd.forEach((v, k) => {
                    if (k === "avatar_file") return; // não vai no PUT
                    if (k.includes('telefone') || k === 'cep' || k === 'cpf') payload[k] = String(v).replace(/\D/g, "");
                    else payload[k] = v;
                });

                // Somente ADMIN pode alterar perfil_acesso.
                if (!ehAdmin) delete payload.perfil_acesso;

                try {
                    const r = await apiFetch(`/api/filiados/${id}`, { method: "PUT", body: payload });
                    const d = await r.json().catch(() => ({}));

                    if (r.ok) {
                        alert("Salvo com sucesso!");
                        const idx = cacheLista.findIndex(i => String(i.id) === String(id));
                        if (idx !== -1) {
                            cacheLista[idx] = { ...cacheLista[idx], ...payload };
                            filtrarLista(document.getElementById("busca-filiados")?.value || "");
                        }
                    } else if (r.status === 409) {
                        alert(d.message || "CPF já cadastrado para outro filiado.");
                    } else {
                        alert(d.message || "Erro ao salvar.");
                    }
                } catch (ex) {
                    alert("Erro de conexão.");
                } finally {
                    btn.disabled = false;
                    btn.innerText = txtOriginal;
                }
            });
        });
    }
}

function abrirNovoFiliado(container) {
    if (!container) return;
    if (container.innerHTML !== "") { container.innerHTML = ""; return; }

    container.innerHTML = `
        <div class="section-box" style="background:#fff; color:#333; padding:25px; border-radius:12px; margin-bottom:25px; border-left:6px solid #2980b9; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
            <h3 style="color:#003366; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:20px;">👤 Cadastrar Novo Filiado</h3>
            <form id="form-novo-filiado">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
                    <div><label style="font-weight:bold; display:block; margin-bottom:5px;">Nome *</label><input name="nome" required style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;"></div>
                    <div><label style="font-weight:bold; display:block; margin-bottom:5px;">CPF *</label><input name="cpf" required placeholder="Somente números" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;"></div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
                    <div><label style="font-weight:bold; display:block; margin-bottom:5px;">E-mail *</label><input name="email1" type="email" required style="width:100%; padding:10px; border:1px solid:#ccc; border-radius:4px;"></div>
                    <div><label style="font-weight:bold; display:block; margin-bottom:5px;">Situação</label>
                        <select name="situacao" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px;">${SITUACAO_OPCOES.map(op => `<option value="${op}">${op}</option>`).join('')}</select>
                    </div>
                </div>
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button class="btn btn-primary" style="flex:1; padding:12px;">Criar Cadastro</button>
                    <button type="button" id="btn-cancelar-novo" class="btn btn-outline" style="flex:0 0 100px; color:#333; border-color:#999;">Cancelar</button>
                </div>
            </form>
        </div>`;

    // Máscara de CPF no formulário de criação
    const inputCpf = container.querySelector('input[name="cpf"]');
    if (inputCpf) {
        inputCpf.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, "").slice(0, 11);
            if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
            else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
            else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
            e.target.value = v;
        });
    }

    container.querySelector("#btn-cancelar-novo").addEventListener("click", () => container.innerHTML = "");

    container.querySelector("form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = Object.fromEntries(fd.entries());
        payload.perfil_acesso = "FILIADO";
        payload.cpf = String(payload.cpf || "").replace(/\D/g, "");

        try {
            const r = await apiFetch("/api/filiados", { method: "POST", body: payload });
            const d = await r.json().catch(() => ({}));

            if (r && r.ok) {
                alert("Criado!");
                container.innerHTML = "";
                await carregarLista();
            } else {
                alert(d.message || d.error || "Erro.");
            }
        } catch (ex) {
            alert("Erro de conexão.");
        }
    });
}
