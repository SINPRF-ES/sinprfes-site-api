/**
 * Módulo Ressarcimento (Página Inicial)
 * Carregado como script clássico (window.Ressarcimento)
 */

(function (global) {
    if (global.Ressarcimento) return;

    const BANCOS_LISTA = [
        { code: "001", name: "Banco do Brasil" },
        { code: "104", name: "Caixa Econômica" },
        { code: "033", name: "Santander" },
        { code: "237", name: "Bradesco" },
        { code: "341", name: "Itaú" },
        { code: "260", name: "Nubank" },
        { code: "077", name: "Inter" },
        { code: "422", name: "Safra" },
        { code: "041", name: "Banrisul" },
        { code: "021", name: "Banestes" }
    ];

    function inicializarRessarcimento() {
        const secRes = document.getElementById("sec-ressarcimento");
        if (!secRes) return;

        const { formatarCPF, aplicarMascaraTelefone } = global.Utils || {};

        if (!document.getElementById('style-ressarcimento')) {
            const s = document.createElement('style');
            s.id = 'style-ressarcimento';
            s.textContent = `
                .res-header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
                .res-card { background: #fdfdfd; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                .res-card h3 { text-align: center; justify-content: center; margin-top: 0; color: #003366; font-size: 1.1rem; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
                .res-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .res-group { margin-bottom: 15px; }
                .res-group label { display: block; font-weight: bold; margin-bottom: 5px; color: #555; font-size: 0.9rem; }
                .res-group input, .res-group select, .res-group textarea { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
                .input-calc { background: #f0f0f0; font-weight: bold; color: #333; }
                .total-box { background: #003366; color: #fff; padding: 20px; border-radius: 8px; text-align: center; margin-top: 10px; }
                .total-label { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
                .total-value { font-size: 2rem; font-weight: bold; margin-top: 5px; }
                .file-upload-wrapper { border: 2px dashed #ccc; padding: 30px; text-align: center; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: #fff; display: block; }
                .file-upload-wrapper:hover, .file-upload-wrapper:focus-within { border-color: #003366; background: #f8fbff; outline: none; box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.2); }
                .upload-icon { font-size: 2.5rem; color: #003366; margin-bottom: 10px; }
                .upload-text { font-weight: bold; color: #333; }
                .upload-hint { font-size: 0.8rem; color: #777; margin-top: 5px; }
                @media (max-width: 768px) { .res-grid { grid-template-columns: 1fr; } }
            `;
            document.head.appendChild(s);
        }

        const opcoesBancos = BANCOS_LISTA.map(b => `<option value="${b.code} - ${b.name}">`).join("");

        secRes.innerHTML = `
            <div class="res-header af-standard-header">
                <h2>💸 Solicitação de Ressarcimento</h2>
                <p>Preencha os dados abaixo e anexe os comprovantes para processar seu reembolso.</p>
            </div>

            <form id="form-ressarcimento">
                <div class="res-card">
                    <h3>👤 Dados do Solicitante</h3>
                    <div class="res-group"><label>Nome Completo</label><input type="text" id="res-nome" name="nome_solicitante" readonly class="input-calc"></div>
                    <div class="res-grid">
                        <div class="res-group"><label>CPF</label><input type="text" id="res-cpf" readonly class="input-calc"></div>
                        <div class="res-group"><label>E-mail</label><input type="email" id="res-email" name="email_destino" readonly class="input-calc"></div>
                    </div>
                    <div class="res-group"><label>Telefone Contato</label><input type="text" id="res-telefone" name="telefone_contato"></div>
                </div>

                <div class="res-card">
                    <h3>📅 Detalhes da Atividade</h3>
                    <div class="res-grid">
                        <div class="res-group"><label>Data Início</label><input type="date" id="res-data-inicio" name="data_inicio"></div>
                        <div class="res-group"><label>Data Fim</label><input type="date" id="res-data-fim" name="data_fim"></div>
                    </div>
                    <div class="res-group">
                        <label>Local / Destino</label>
                        <input type="text" id="res-local" name="local" placeholder="Ex: Brasília - DF">
                    </div>
                    <div class="res-group">
                        <label>Descrição da Missão / Motivo</label>
                        <textarea id="res-descricao" name="descricao" rows="4" placeholder="Descreva o motivo da viagem/atividade..." required></textarea>
                    </div>
                </div>

                <div class="res-card">
                    <h3>🧮 Despesas e Cálculos</h3>
                    <div class="res-grid">
                        <div class="res-group"><label>Diárias Estimadas</label><input type="text" id="res-diarias" name="diarias" readonly class="input-calc" value="0"></div>
                        <div class="res-group"><label>Valor Diárias (R$)</label><input type="text" id="res-valor-diarias" name="valor_diarias" readonly class="input-calc" value="0.00"></div>
                    </div>
                    <div class="res-grid">
                        <div class="res-group"><label>Km Rodados</label><input type="number" id="res-km" name="km_total" placeholder="0"></div>
                        <div class="res-group"><label>Valor Km (R$)</label><input type="text" id="res-valor-km" name="valor_km" readonly class="input-calc" value="0.00"></div>
                    </div>
                    <div class="res-group"><label>Outras Despesas (R$)</label><input type="number" step="0.01" id="res-valor-outros" name="valor_outros" placeholder="0.00"></div>

                    <div class="total-box">
                        <div class="total-label">Total a Receber</div>
                        <div class="total-value">R$ <span id="text-valor-total">0,00</span></div>
                        <input type="hidden" id="res-valor-total" name="valor_total">
                    </div>
                </div>

                <div class="res-card">
                    <h3>🏦 Dados Bancários</h3>
                    <div class="res-group">
                        <label>Banco</label>
                        <select id="res-banco-select" name="banco_select">
                            <option value="">Selecione um banco...</option>
                            ${BANCOS_LISTA.map(b => `<option value="${b.code} - ${b.name}">${b.code} - ${b.name}</option>`).join("")}
                            <option value="OUTRO">Outro (Informar manual)</option>
                        </select>
                        <input type="text" id="res-banco-outro" name="banco_outro" placeholder="Informe o nome do banco" style="display:none; margin-top:10px;">
                        <input type="hidden" id="res-banco" name="banco">
                    </div>
                    <div class="res-grid">
                        <div class="res-group"><label>Agência</label><input type="text" id="res-agencia" name="agencia"></div>
                        <div class="res-group"><label>Conta</label><input type="text" id="res-conta" name="conta"></div>
                    </div>
                    <div class="res-group"><label>PIX (Opcional)</label><input type="text" id="res-pix" name="pix"></div>
                </div>

                <div class="res-card">
                    <h3>📎 Comprovantes</h3>
                    <label class="file-upload-wrapper" role="button" tabindex="0" aria-label="Anexar documentos de comprovação (PDF, JPG ou PNG)">
                        <div class="upload-icon" aria-hidden="true">📂</div>
                        <div class="upload-text">Anexar Documentos</div>
                        <div class="upload-hint">PDF, JPG ou PNG</div>
                        <input type="file" id="res-anexos" name="anexos" multiple style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0;">
                    </label>
                    <div id="file-list" style="margin-top:10px; text-align:center;"></div>
                </div>

                <div style="text-align:right;">
                    <span id="res-status" style="margin-right:15px; font-weight:bold; color: #003366;"></span>
                    <button type="submit" class="btn btn-primary" style="padding:15px 40px;">Enviar Solicitação</button>
                </div>
            </form>
        `;

        const form = document.getElementById("form-ressarcimento");
        const tel = document.getElementById("res-telefone");
        const ag = document.getElementById("res-agencia");
        const ct = document.getElementById("res-conta");
        const inputFile = document.getElementById("res-anexos");
        const fileList = document.getElementById("file-list");

        const bancoSelect = document.getElementById("res-banco-select");
        const bancoOutro = document.getElementById("res-banco-outro");
        const bancoHidden = document.getElementById("res-banco");

        bancoSelect.onchange = () => {
            if (bancoSelect.value === "OUTRO") {
                bancoOutro.style.display = "block";
                bancoOutro.required = false;
                bancoHidden.value = bancoOutro.value;
            } else {
                bancoOutro.style.display = "none";
                bancoOutro.required = false;
                bancoOutro.value = "";
                bancoHidden.value = bancoSelect.value;
            }
        };

        bancoOutro.oninput = () => {
            if (bancoSelect.value === "OUTRO") {
                bancoHidden.value = bancoOutro.value;
            }
        };

        if (aplicarMascaraTelefone) aplicarMascaraTelefone(tel);

        const F = global.Formatters || {};
        if (F.applyMaskAgencia) F.applyMaskAgencia(ag);
        if (F.applyMaskConta) F.applyMaskConta(ct);

        let selectedFiles = [];

        function renderFileList() {
            if (selectedFiles.length === 0) {
                fileList.innerHTML = "";
                return;
            }

            fileList.innerHTML = `
                <div style="margin-top: 15px; text-align: left; background: #f9f9f9; padding: 10px; border-radius: 8px; border: 1px solid #ddd;" role="region" aria-label="Lista de arquivos anexados">
                    <p style="font-weight: bold; margin-bottom: 10px; color: #003366;">✅ ${selectedFiles.length} arquivo(s) selecionado(s):</p>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        ${selectedFiles.map((f, i) => `
                            <li style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #eee;">
                                <span style="font-size: 0.9rem; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%;">${f.name}</span>
                                <button type="button" class="btn-remove-file" data-index="${i}" aria-label="Remover arquivo ${f.name}" style="background: #dc3545; color: #fff; border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 0.8rem;">Remover</button>
                            </li>
                        `).join("")}
                    </ul>
                </div>
            `;

            fileList.querySelectorAll(".btn-remove-file").forEach(btn => {
                btn.onclick = (e) => {
                    const idx = parseInt(e.target.getAttribute("data-index"));
                    selectedFiles.splice(idx, 1);
                    renderFileList();
                };
            });
        }

        const fileWrapper = document.querySelector(".file-upload-wrapper");
        if (fileWrapper) {
            fileWrapper.onkeydown = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputFile.click();
                }
            };
        }

        inputFile.onchange = () => {
            if (inputFile.files.length > 0) {
                for (let i = 0; i < inputFile.files.length; i++) {
                    selectedFiles.push(inputFile.files[i]);
                }
                // Limpa o input para permitir selecionar o mesmo arquivo novamente se desejar
                inputFile.value = "";
                renderFileList();
            }
        };

        const calcFields = ["res-data-inicio", "res-data-fim", "res-km", "res-valor-outros"];
        calcFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.oninput = atualizarCalculos;
        });

        async function carregarDados() {
            let user = JSON.parse(localStorage.getItem("userInfo") || "{}");
            if (!user.nome && window.Api.apiFetch) {
                try {
                    const r = await window.Api.apiFetch("/api/filiados/me");
                    user = await r.json();
                    localStorage.setItem("userInfo", JSON.stringify(user));
                } catch(e) {}
            }
            preencherForm(user);
        }

        function preencherForm(d) {
            if (!d) return;
            const set = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ""; };
            set("res-nome", d.nome);
            set("res-cpf", formatarCPF ? formatarCPF(d.cpf) : d.cpf);
            set("res-email", d.email1 || d.email2);
            set("res-telefone", d.telefone1 || d.telefone2);
            if (aplicarMascaraTelefone) aplicarMascaraTelefone(document.getElementById("res-telefone"));
        }

        function atualizarCalculos() {
            const ini = document.getElementById("res-data-inicio").value;
            const fim = document.getElementById("res-data-fim").value;
            const km = parseFloat(document.getElementById("res-km").value) || 0;
            const outros = parseFloat(document.getElementById("res-valor-outros").value) || 0;

            let dias = 0;
            if (ini && fim) {
                const d1 = new Date(ini); const d2 = new Date(fim);
                if (d2 >= d1) dias = ((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
            }
            const calcDiarias = Math.max(0, dias - 1 + 0.7);

            document.getElementById("res-diarias").value = calcDiarias.toFixed(1);
            document.getElementById("res-valor-diarias").value = (calcDiarias * 500).toFixed(2);
            document.getElementById("res-valor-km").value = (km * 1.5).toFixed(2);

            const total = ((calcDiarias*500)+(km*1.5)+outros);
            document.getElementById("res-valor-total").value = total.toFixed(2);
            const display = document.getElementById("text-valor-total");
            if(display) display.textContent = total.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = form.querySelector("button[type='submit']");
            const status = document.getElementById("res-status");
            btn.disabled = true;
            btn.setAttribute("aria-busy", "true");
            status.textContent = "🚀 Enviando...";

            const fd = new FormData(form);
            if (tel) fd.set("telefone_contato", tel.value.replace(/\D/g, ""));

            // Adiciona múltiplos arquivos
            fd.delete("anexos"); // Remove o que o FormData pegou do input (que deve estar vazio)
            selectedFiles.forEach(file => {
                fd.append("anexos", file);
            });

            try {
                const r = await window.Api.apiFetch("/api/ressarcimentos", { method: "POST", body: fd });
                if (r.ok) {
                    status.textContent = "✅ Sucesso!";
                    form.reset();
                    selectedFiles = [];
                    fileList.innerHTML = "";
                    atualizarCalculos();
                    carregarDados();
                } else {
                    status.textContent = "❌ Erro ao enviar.";
                }
            } catch(err) {
                status.textContent = "❌ Erro de conexão.";
            } finally {
                btn.disabled = false;
                btn.removeAttribute("aria-busy");
            }
        };

        carregarDados();
    }

    global.Ressarcimento = {
        inicializarRessarcimento
    };

})(typeof window !== 'undefined' ? window : global);
