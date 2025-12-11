import { apiFetch, aplicarMascaraTelefone, formatarCPF } from './utils.js';

export async function inicializarRessarcimento() {
    const secRes = document.getElementById("sec-ressarcimento");
    if (!secRes) return;

    // 🟢 CORREÇÃO: Agora a variável se chama 'container' desde o início
    const container = secRes.querySelector('.section-card');
    if (!container) return;
    
    container.innerHTML = "";

    // 1. INJEÇÃO DE CSS
    if (!document.getElementById('style-ressarcimento')) {
        const s = document.createElement('style');
        s.id = 'style-ressarcimento';
        s.textContent = `
            /* Header Gradiente - CENTRALIZADO */
            .res-header {
                background: linear-gradient(135deg, #2c3e50 0%, #000000 100%);
                color: #fff;
                padding: 25px;
                border-radius: 12px;
                border-left: 6px solid #27ae60;
                margin-bottom: 25px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                text-align: center;
            }
            .res-title h2 { margin: 0; font-size: 1.5rem; color: #fff; }
            .res-subtitle { font-size: 0.95rem; color: #bdc3c7; margin-top: 5px; }

            /* Cards Brancos */
            .res-card {
                background: #fff;
                color: #333;
                padding: 25px;
                border-radius: 10px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                margin-bottom: 20px;
                border: 1px solid #e0e0e0;
            }
            
            /* Títulos dos Cards - CENTRALIZADOS */
            .res-card h3 {
                color: #2c3e50;
                font-size: 1.1rem;
                border-bottom: 2px solid #f0f0f0;
                padding-bottom: 10px;
                margin-bottom: 20px;
                font-weight: bold;
                display: flex; 
                align-items: center; 
                justify-content: center;
                gap: 8px;
            }

            /* Grids e Inputs */
            .res-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 15px; }
            .res-group { display: flex; flex-direction: column; }
            .res-group label { font-weight: 600; font-size: 0.85rem; color: #555; margin-bottom: 5px; }
            
            .res-group input, .res-group select, .res-group textarea {
                width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;
                font-size: 1rem; color: #333; background: #fff; font-family: inherit;
            }
            .res-group input:focus, .res-group textarea:focus { border-color: #27ae60; outline: none; background: #f9fffb; }

            /* Inputs Calculados (Readonly) */
            .input-calc { background-color: #e9ecef !important; color: #555 !important; font-weight: bold; cursor: not-allowed; }
            
            /* Total Centralizado */
            .total-box { 
                background: #e8f8f5; 
                border: 1px solid #27ae60; 
                padding: 15px; 
                border-radius: 8px; 
                text-align: center; 
                margin-top: 20px;
            }
            .total-label { font-size: 0.9rem; color: #27ae60; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
            .total-value { font-size: 1.6rem; color: #27ae60; font-weight: 800; }

            /* Upload */
            .file-upload-wrapper { 
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                width: 100%;
                border: 2px dashed #ccc; 
                padding: 30px; 
                text-align: center; 
                border-radius: 8px; 
                background: #fafafa; 
                cursor: pointer; 
                transition: 0.2s; 
                box-sizing: border-box;
            }
            .file-upload-wrapper:hover { border-color: #27ae60; background: #f0fdf4; }
            .upload-icon { font-size: 2.5rem; margin-bottom: 10px; }
            .upload-text { font-weight: bold; color: #333; margin-bottom: 5px; }
            .upload-hint { color: #777; font-size: 0.85rem; }
        `;
        document.head.appendChild(s);
    }

    // 2. RENDERIZA O HTML (Usando a variável correta 'container')
    container.innerHTML = `
        <div class="res-header">
            <div class="res-title">
                <h2>💸 Solicitação de Ressarcimento</h2>
                <div class="res-subtitle">Preencha os dados da atividade sindical para reembolso.</div>
            </div>
        </div>

        <form id="form-ressarcimento">
            
            <div class="res-card">
                <h3>👤 Dados do Filiado</h3>
                <div class="res-grid">
                    <div class="res-group"><label>Nome</label><input type="text" id="res-nome" readonly class="input-calc" placeholder="Carregando..."></div>
                    <div class="res-group"><label>CPF</label><input type="text" id="res-cpf" readonly class="input-calc" placeholder="..."></div>
                </div>
                <div class="res-grid">
                    <div class="res-group"><label>E-mail</label><input type="email" id="res-email" readonly class="input-calc"></div>
                    <div class="res-group"><label>Telefone Contato</label><input type="text" id="res-telefone" name="telefone_contato"></div>
                </div>
            </div>

            <div class="res-card">
                <h3>📅 Detalhes da Atividade</h3>
                <div class="res-grid">
                    <div class="res-group"><label>Data Início</label><input type="date" id="res-data-inicio" name="data_inicio" required></div>
                    <div class="res-group"><label>Data Fim</label><input type="date" id="res-data-fim" name="data_fim" required></div>
                    <div class="res-group"><label>Local / Destino</label><input type="text" id="res-local" name="local" required placeholder="Ex: Brasília - DF"></div>
                </div>
                <div class="res-group">
                    <label>Descrição da Missão / Motivo</label>
                    <textarea id="res-descricao" name="descricao" rows="5" placeholder="Descreva o motivo da viagem, atividades realizadas, etc..." required></textarea>
                </div>
            </div>

            <div class="res-card">
                <h3>🧮 Despesas</h3>
                
                <div class="res-grid">
                    <div class="res-group"><label>Qtd. Diárias</label><input type="text" id="res-diarias" name="diarias" readonly class="input-calc" value="0"></div>
                    <div class="res-group"><label>Valor Diárias (R$)</label><input type="text" id="res-valor-diarias" name="valor_diarias" readonly class="input-calc" value="0.00"></div>
                </div>

                <div class="res-grid">
                    <div class="res-group"><label>Km Rodados</label><input type="number" id="res-km" name="km_total" placeholder="0"></div>
                    <div class="res-group"><label>Valor Km (R$)</label><input type="text" id="res-valor-km" name="valor_km" readonly class="input-calc" value="0.00"></div>
                </div>

                <div class="res-grid">
                    <div class="res-group"><label>Outras Despesas (R$)</label><input type="number" id="res-valor-outros" name="valor_outros" step="0.01" placeholder="0.00"></div>
                    <div class="res-group"><label>Descrição Outros</label><input type="text" id="res-descricao-outros" name="descricao_outros" placeholder="Pedágio, etc"></div>
                </div>

                <div class="total-box">
                    <div class="total-label">Valor Total a Receber</div>
                    <div class="total-value">R$ <span id="text-valor-total">0,00</span></div>
                    <input type="hidden" id="res-valor-total" name="valor_total">
                </div>
            </div>

            <div class="res-card">
                <h3>🏦 Dados Bancários</h3>
                <div class="res-grid">
                    <div class="res-group"><label>Banco</label><input type="text" id="res-banco" name="banco" required></div>
                    <div class="res-group"><label>Agência</label><input type="text" id="res-agencia" name="agencia" required></div>
                    <div class="res-group"><label>Conta</label><input type="text" id="res-conta" name="conta" required></div>
                </div>
                <div class="res-group"><label>PIX (Opcional)</label><input type="text" id="res-pix" name="pix"></div>
            </div>

            <div class="res-card">
                <h3>📎 Comprovantes</h3>
                <label class="file-upload-wrapper">
                    <div class="upload-icon">📂</div>
                    <div class="upload-text">Clique para anexar arquivos</div>
                    <div class="upload-hint">(PDF, JPG ou PNG - Comprovantes de pedágio, fotos, relatórios)</div>
                    <input type="file" id="res-anexos" name="anexos" multiple style="display:none;">
                </label>
                <div id="file-list" style="margin-top:15px; color:#555; text-align: center;"></div>
            </div>

            <div style="text-align:right; margin-top:20px;">
                <span id="res-status" class="field-hint" style="margin-right:15px; font-weight:bold;"></span>
                <button type="submit" class="btn btn-primary btn-lg" style="padding: 12px 40px;">🚀 Enviar</button>
            </div>
        </form>
    `;

    // 3. LÓGICA
    const form = document.getElementById("form-ressarcimento");
    const tel = document.getElementById("res-telefone");
    const inputFile = document.getElementById("res-anexos");
    const fileList = document.getElementById("file-list");

    aplicarMascaraTelefone(tel);

    // Upload visual
    inputFile.addEventListener("change", () => {
        if(inputFile.files.length > 0) {
            fileList.innerHTML = `<div style="background:#e8f8f5; padding:10px; border-radius:6px; display:inline-block; border:1px solid #27ae60; color:#27ae60;"><strong>${inputFile.files.length} arquivo(s) selecionado(s):</strong><br>` + 
                Array.from(inputFile.files).map(f => `<span style="font-size:0.9rem; display:block; margin-top:4px;">📄 ${f.name}</span>`).join("") + "</div>";
        } else {
            fileList.innerHTML = "";
        }
    });

    // Cálculos
    ["res-data-inicio", "res-data-fim", "res-km", "res-valor-outros"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", atualizarCalculos);
    });

    // Carregamento de dados (Seguro)
    let userData = JSON.parse(localStorage.getItem("userInfo") || "{}");
    if (userData.nome) {
        preencherFormularioRessarcimentoComDados(userData);
    } else {
        apiFetch("/api/filiados/me")
            .then(r => r.json())
            .then(dados => {
                localStorage.setItem("userInfo", JSON.stringify(dados));
                preencherFormularioRessarcimentoComDados(dados);
            })
            .catch(() => console.log("Erro ao buscar dados para ressarcimento."));
    }

    // Submit
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        const status = document.getElementById("res-status");
        btn.disabled = true; 
        status.textContent = "Enviando solicitação...";
        status.style.color = "#333";

        const fd = new FormData(form);
        const t = document.getElementById("res-telefone").value.replace(/\D/g, "");
        fd.set("telefone_contato", t);

        try {
            const r = await apiFetch("/api/ressarcimentos", { method: "POST", body: fd });
            if(r.ok) { 
                status.textContent = "✅ Enviado com sucesso!"; 
                status.style.color = "#27ae60";
                form.reset(); 
                fileList.innerHTML = "";
                atualizarCalculos(); 
                userData = JSON.parse(localStorage.getItem("userInfo")||"{}");
                preencherFormularioRessarcimentoComDados(userData);
            } else { 
                status.textContent = "Erro ao enviar."; 
                status.style.color = "#c0392b";
            }
        } catch(e) { 
            status.textContent = "Erro de conexão."; 
            status.style.color = "#c0392b";
        }
        finally { btn.disabled = false; }
    });
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

export function preencherFormularioRessarcimentoComDados(d) {
    if(!d) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ""; };
    setVal("res-nome", d.nome);
    setVal("res-cpf", formatarCPF(d.cpf));
    setVal("res-email", d.email1 || d.email2);
    
    const tel = document.getElementById("res-telefone");
    if(tel) { 
        tel.value = d.telefone1 || d.telefone2 || ""; 
        aplicarMascaraTelefone(tel); 
    }
}