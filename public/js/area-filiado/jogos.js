import { apiFetch, formatarTelefoneTexto } from './utils.js';

const PERFIS_GERENCIA = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"];

export function inicializarJogos(perfilAcesso) {
    const secJogos = document.getElementById("sec-jogos");
    if (!secJogos) return;
    
    const mainContent = secJogos.querySelector('.section-card');
    mainContent.innerHTML = "";

    // 1. Container do Formulário (Visível para todos)
    const containerForm = document.createElement("div");
    mainContent.appendChild(containerForm);
    renderizarFormulario(containerForm);

    // 2. Lista de Inscritos (Apenas para Gestores)
    if (PERFIS_GERENCIA.includes(perfilAcesso)) {
        const hr = document.createElement("hr");
        hr.style.cssText = "margin: 50px 0 30px 0; border: 0; border-top: 2px solid #dde3ea";
        mainContent.appendChild(hr);

        const headerAdmin = document.createElement("div");
        headerAdmin.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 class="section-subtitle" style="color: #2980b9; font-size: 1.8rem; font-weight: bold;">
                    📋 Área de Gestão (Inscritos)
                </h3>
                <p class="field-hint">Visualização exclusiva para: <strong>${perfilAcesso}</strong></p>
            </div>`;
        mainContent.appendChild(headerAdmin);

        const containerLista = document.createElement("div");
        containerLista.className = "jogos-container-lista";
        mainContent.appendChild(containerLista);
        
        renderizarLista(containerLista);
    }
}

function renderizarFormulario(container) {
    // Injeta CSS específico para Jogos
    if (!document.getElementById('style-jogos')) {
        const s = document.createElement('style'); 
        s.id='style-jogos';
        s.textContent = `
            .jogos-container { max-width: 100%; margin: 0 auto; }
            
            /* Cards brancos com texto escuro */
            .categoria-card { 
                background: #fff; 
                color: #333; 
                border: 1px solid #e0e0e0; 
                border-radius: 10px; 
                padding: 25px; 
                margin-bottom: 25px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.05);
            }
            
            .categoria-titulo { 
                font-size: 1.2rem; 
                color: #2c3e50; 
                border-bottom: 2px solid #f0f0f0; 
                padding-bottom: 10px; margin-bottom: 20px; 
                font-weight: bold; 
            }
            
            .opcoes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px; }
            
            /* Checkbox grande e visível */
            .destaque-adesao { 
                background: #f0f7ff; color: #004085; 
                border: 1px solid #b8daff; padding: 20px; border-radius: 8px; 
                display: flex; align-items: center; gap: 15px; margin-bottom: 30px; cursor: pointer;
                font-size: 1.1rem; font-weight: 600;
            }
            .destaque-adesao input { transform: scale(1.5); cursor: pointer; }

            /* Inputs e Textareas mais visíveis */
            .categoria-card select, .categoria-card textarea, .categoria-card input[type="text"] {
                width: 100%;
                padding: 12px;
                border: 1px solid #ccc;
                border-radius: 6px;
                font-size: 1rem;
                color: #333;
                background-color: #fff;
                font-family: inherit;
            }
            
            .categoria-card textarea {
                resize: vertical;
                line-height: 1.5;
            }

            /* Botões */
            .btn-danger { background: transparent; border: 1px solid #c0392b; color: #c0392b; margin-left: 15px; } 
            .btn-danger:hover { background: #c0392b; color: #fff; } 

            /* Estilo da Tabela de Gestão */
            .tabela-jogos { width: 100%; border-collapse: collapse; min-width: 800px; }
            .tabela-jogos th { background: #003366; color: #fff; padding: 15px; text-align: left; vertical-align: top; }
            .tabela-jogos td { 
                padding: 12px 15px; 
                border-bottom: 1px solid #ddd; 
                color: #333; 
                vertical-align: top;
                white-space: normal; /* Permite quebra de linha */
                word-wrap: break-word;
            }
            .tabela-jogos tr:nth-child(even) { background-color: #f9f9f9; }
            .tabela-jogos tr:hover { background-color: #f1f1f1; }
        `;
        document.head.appendChild(s);
    }

    container.innerHTML = `
        <div class="jogos-container">
            <header style="text-align: center; margin-bottom: 30px;">
                <h2 style="font-size: 2rem; color: #e67e22; margin-bottom: 5px;">🏅 Jogos de Integração PRF 2026</h2>
                <p style="font-size: 1.1rem; color: #aaa;">📍 Poços de Caldas - MG (12 a 17/04/2026)</p>
            </header>

            <form id="form-inscricao-jogos">
                <label class="destaque-adesao">
                    <input type="checkbox" id="interesse" />
                    <span>Desejo integrar a delegação do SINPRF-ES</span>
                </label>
                
                <div class="categoria-card">
                    <div class="categoria-titulo">👤 Dados do Participante</div>
                    <div style="max-width: 300px;">
                        <label style="display:block; margin-bottom:5px; font-weight:bold;">Sexo (Para categorias esportivas):</label>
                        <select id="sexo">
                            <option value="">Selecione...</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Feminino">Feminino</option>
                        </select>
                    </div>
                </div>

                <div class="categoria-card">
                    <div class="categoria-titulo">🏃 1. Atletismo</div>
                    <div class="opcoes-grid">
                        <label><input type="checkbox" name="modalidades" value="Atletismo 100m"> 100m</label>
                        <label><input type="checkbox" name="modalidades" value="Atletismo 400m"> 400m</label>
                        <label><input type="checkbox" name="modalidades" value="Atletismo 1500m"> 1500m</label>
                        <label><input type="checkbox" name="modalidades" value="Atletismo 5000m"> 5000m</label>
                    </div>
                </div>

                <div class="categoria-card">
                    <div class="categoria-titulo">🏊 10. Natação</div>
                    <div class="opcoes-grid">
                        <label><input type="checkbox" name="modalidades" value="Natação 50m Livre"> 50m Livre</label>
                        <label><input type="checkbox" name="modalidades" value="Natação 50m Costas"> 50m Costas</label>
                        <label><input type="checkbox" name="modalidades" value="Natação 50m Peito"> 50m Peito</label>
                        <label><input type="checkbox" name="modalidades" value="Natação 50m Borboleta"> 50m Borboleta</label>
                        <label><input type="checkbox" name="modalidades" value="Natação Rev. 4x50m Livre"> Rev. 4x50m Livre</label>
                        <label><input type="checkbox" name="modalidades" value="Natação Rev. 2x50m Misto"> Rev. 2x50m Misto</label>
                    </div>
                </div>

                <div class="categoria-card">
                    <div class="categoria-titulo">⚽ Esportes Coletivos e Quadra</div>
                    <div class="opcoes-grid">
                        <label><input type="checkbox" name="modalidades" value="Futebol Society (Livre)"> Fut. Society (Livre)</label>
                        <label><input type="checkbox" name="modalidades" value="Futebol Society Master (55+)"> Fut. Society Master (55+)</label>
                        <label><input type="checkbox" name="modalidades" value="Futsal (Livre)"> Futsal (Livre)</label>
                        <label><input type="checkbox" name="modalidades" value="Voleibol (Livre)"> Voleibol (Livre)</label>
                        <label><input type="checkbox" name="modalidades" value="Voleibol de Praia"> Vôlei de Praia</label>
                        <label><input type="checkbox" name="modalidades" value="Futevôlei"> Futevôlei</label>
                        <label><input type="checkbox" name="modalidades" value="Beach Tennis"> Beach Tennis</label>
                        <label><input type="checkbox" name="modalidades" value="Tênis de Quadra"> Tênis de Quadra</label>
                    </div>
                </div>

                <div class="categoria-card">
                    <div class="categoria-titulo">🎱 Jogos de Salão e Outros</div>
                    <div class="opcoes-grid">
                        <label><input type="checkbox" name="modalidades" value="Tiro (NRA/IPSC)"> Tiro (NRA/IPSC)</label>
                        <label><input type="checkbox" name="modalidades" value="Jiu-Jitsu"> Jiu-Jitsu</label>
                        <label><input type="checkbox" name="modalidades" value="Tênis de Mesa"> Tênis de Mesa</label>
                        <label><input type="checkbox" name="modalidades" value="Sinuca"> Sinuca</label>
                        <label><input type="checkbox" name="modalidades" value="Xadrez"> Xadrez</label>
                        <label><input type="checkbox" name="modalidades" value="Truco"> Truco</label>
                        <label><input type="checkbox" name="modalidades" value="Canastra"> Canastra</label>
                        <label><input type="checkbox" name="modalidades" value="Dominó"> Dominó</label>
                    </div>
                </div>

                <div class="categoria-card" style="background-color: #f8f9fa;">
                    <div class="categoria-titulo" style="color: #666;">🏳️ Exibição (Sem pontuação)</div>
                    <div class="opcoes-grid">
                        <label><input type="checkbox" name="modalidades" value="Exibição: Peteca"> Peteca</label>
                        <label><input type="checkbox" name="modalidades" value="Exibição: Damas"> Damas</label>
                        <label><input type="checkbox" name="modalidades" value="Exibição: Bocha"> Bocha</label>
                    </div>
                </div>

                <div class="categoria-card">
                    <div class="categoria-titulo">👨‍👩‍👧‍👦 Familiares</div>
                    
                    <div style="margin-bottom: 15px; max-width: 300px;">
                        <label style="font-weight: bold; display: block; margin-bottom: 5px;">Quantidade de familiares:</label>
                        <select id="qtd_familiares">
                            <option value="0">0 (Nenhum)</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                            <option value="7">7</option>
                            <option value="8">8</option>
                            <option value="9">9</option>
                        </select>
                    </div>

                    <label style="font-weight: bold; display: block; margin-bottom: 5px;">Nomes dos familiares (um por linha):</label>
                    <textarea id="familiares" rows="6" placeholder="Exemplo:\nMaria da Silva (Esposa)\nJoãozinho (Filho)"></textarea>
                </div>

                <div class="categoria-card">
                    <div class="categoria-titulo">📝 Observações Adicionais</div>
                    <label style="font-weight: bold; display: block; margin-bottom: 5px;">Informações extras:</label>
                    <textarea id="obs" rows="5" placeholder="Tamanho da camisa, restrições alimentares, dúvidas, etc..."></textarea>
                </div>

                <div class="form-actions" style="margin-top: 40px; text-align: center;">
                    <button class="btn btn-primary btn-lg" type="submit" style="padding: 12px 40px; font-size: 1.1rem;">
                        ✅ Confirmar Inscrição
                    </button>
                    
                    <button type="button" id="btn-cancelar-inscricao" class="btn btn-danger btn-lg" style="padding: 12px 25px; font-size: 1rem;">
                        ❌ Cancelar Inscrição
                    </button>

                    <div id="jogos-status" class="field-hint" style="margin-top: 15px; font-weight: bold; font-size: 1rem;"></div>
                </div>
            </form>
        </div>`;

    const form = container.querySelector("#form-inscricao-jogos");
    const statusEl = container.querySelector("#jogos-status");
    const btnCancelar = container.querySelector("#btn-cancelar-inscricao");

    if (btnCancelar) {
        btnCancelar.addEventListener("click", async () => {
            if (!confirm("Tem certeza que deseja CANCELAR sua inscrição nos Jogos?")) return;
            
            statusEl.textContent = "Cancelando...";
            statusEl.style.color = "orange";
            
            try {
                const r = await apiFetch("/api/jogos/inscricao", { method: "DELETE" });
                if(r.ok) { 
                    statusEl.textContent = "Inscrição cancelada com sucesso."; 
                    statusEl.style.color = "red"; 
                    form.reset();
                    // Reseta selects manuais
                    if(document.getElementById("sexo")) document.getElementById("sexo").value = "";
                    if(document.getElementById("qtd_familiares")) document.getElementById("qtd_familiares").value = "0";
                } else {
                    statusEl.textContent = "Erro ao cancelar.";
                }
            } catch (e) {
                console.error(e);
                statusEl.textContent = "Erro de conexão.";
            }
        });
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!form.querySelector("#interesse").checked) {
             statusEl.textContent = "⚠️ Marque a caixa 'Desejo integrar a delegação' no topo.";
             statusEl.style.color = "#c0392b";
             form.querySelector("#interesse").scrollIntoView({behavior: "smooth", block: "center"});
             return;
        }

        const mods = Array.from(form.querySelectorAll("input[name='modalidades']:checked")).map(m => m.value);
        if (mods.length === 0) {
             statusEl.textContent = "⚠️ Selecione ao menos uma modalidade.";
             statusEl.style.color = "#c0392b";
             return;
        }

        const sexo = form.querySelector("#sexo").value;
        if (!sexo) {
            statusEl.textContent = "⚠️ Informe seu Sexo para as categorias esportivas.";
            statusEl.style.color = "#c0392b";
            form.querySelector("#sexo").scrollIntoView({behavior: "smooth", block: "center"});
            return;
        }

        const payload = { 
            modalidades: mods, 
            observacoes: form.querySelector("#obs").value, 
            familiares: form.querySelector("#familiares").value, 
            qtd_familiares: form.querySelector("#qtd_familiares").value, 
            sexo: sexo 
        };
        
        statusEl.textContent = "Enviando...";
        statusEl.style.color = "#333";
        
        try {
             const r = await apiFetch("/api/jogos/inscricao", { method: "POST", body: payload });
             if(r.ok) {
                 statusEl.textContent = "🎉 Inscrição confirmada com sucesso!";
                 statusEl.style.color = "#27ae60";
             } else {
                 statusEl.textContent = "Erro ao salvar inscrição.";
                 statusEl.style.color = "#c0392b";
             }
        } catch(e) { 
            console.error(e); 
            statusEl.textContent = "Erro de conexão."; 
        }
    });
}

async function renderizarLista(container) {
    container.innerHTML = '<p style="color:#fff;">Carregando lista...</p>';
    try {
        const r = await apiFetch("/api/jogos/inscricoes");
        if(!r.ok) throw new Error();
        const data = await r.json();
        const lista = data.inscricoes || [];

        if(lista.length === 0) { container.innerHTML = "<p style='text-align:center; color:#fff;'>Nenhuma inscrição encontrada.</p>"; return; }

        const totalTit = lista.length;
        const totalFam = lista.reduce((acc, c) => acc + (parseInt(c.qtd_familiares)||0), 0);
        
        const rows = lista.map(i => `
            <tr>
                <td style="width: 25%;"><strong>${i.nome_filiado}</strong></td>
                <td style="width: 10%;">${i.sexo||'-'}</td>
                <td style="width: 15%; white-space:nowrap;">${formatarTelefoneTexto(i.telefone1)}</td>
                <td style="width: 20%; font-size:0.9em;">${i.modalidades?.join(', ')||'-'}</td>
                <td style="width: 5%; text-align:center; font-weight:bold;">${i.qtd_familiares||0}</td>
                <td style="width: 25%; font-size:0.9em; line-height:1.4;">${i.familiares ? i.familiares.replace(/\n/g, "<br>") : ''}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div style="background:#fff; color:#333; padding:20px; border-radius:10px; margin-bottom:20px; border:1px solid #ccc; font-size:1.1rem; text-align:center;">
                <span style="display:inline-block; margin:0 10px;">👤 Titulares: <strong>${totalTit}</strong></span>
                <span style="display:inline-block; margin:0 10px;">👨‍👩‍👧‍👦 Familiares: <strong>${totalFam}</strong></span>
                <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px; color: #003366; font-size: 1.3rem;">
                    <strong>TOTAL GERAL: ${totalTit+totalFam} Pessoas</strong>
                </div>
            </div>
            
            <div style="overflow-x:auto; width:100%; background: #fff; border-radius: 8px; border: 1px solid #ccc;">
                <table class="tabela-jogos">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Sexo</th>
                            <th>Telefone</th>
                            <th>Modalidades</th>
                            <th>Fam.</th>
                            <th>Nomes Familiares</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    } catch(e) { container.innerHTML = "<p style='color:#fff;'>Erro ao carregar lista.</p>"; }
}