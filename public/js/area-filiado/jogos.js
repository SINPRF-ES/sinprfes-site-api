import { apiFetch, formatarTelefoneTexto } from './utils.js';

const PERFIS_GERENCIA = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"];

export function inicializarJogos(perfilAcesso) {
    const secJogos = document.getElementById("sec-jogos");
    if (!secJogos) return;
    
    const mainContent = secJogos.querySelector('.section-card');
    if (!mainContent) return;
    mainContent.innerHTML = "";

    // Normaliza perfil em maiúsculas para evitar erro de comparação
    const perfil = (perfilAcesso || "").toUpperCase();

    // 1. Container do Formulário (Visível para todos)
    const containerForm = document.createElement("div");
    mainContent.appendChild(containerForm);
    renderizarFormulario(containerForm);

    // 2. Lista de Inscritos (Apenas para Gestores)
    if (PERFIS_GERENCIA.includes(perfil)) {
        const hr = document.createElement("hr");
        hr.style.cssText = "margin: 32px 0 24px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.25)";
        mainContent.appendChild(hr);

        const headerAdmin = document.createElement("div");
        headerAdmin.innerHTML = `
            <div style="text-align: center; margin-bottom: 16px;">
                <h3 class="section-subtitle" style="color: #f1c40f; font-size: 1.6rem; font-weight: bold;">
                    📋 Área de Gestão – Inscritos nos Jogos
                </h3>
                <p class="field-hint">Visualização exclusiva para: <strong>${perfil}</strong></p>
            </div>`;
        mainContent.appendChild(headerAdmin);

        const containerLista = document.createElement("div");
        containerLista.className = "jogos-container-lista";
        mainContent.appendChild(containerLista);
        
        renderizarLista(containerLista);
    }
}

function renderizarFormulario(container) {
    // Injeta CSS específico para Jogos (apenas uma vez)
    if (!document.getElementById('style-jogos')) {
        const s = document.createElement('style'); 
        s.id='style-jogos';
        s.textContent = `
            .jogos-container { max-width: 100%; margin: 0 auto; }

            /* Deixa a área de lista “expandir” para fora do padding do card */
            .jogos-container-lista {
                width: 100%;
                margin: 0 -24px 0 -24px; /* compensa o padding do .section-card */
                padding: 0 0 24px 0;
            }
            
            /* Cards brancos com texto escuro (formulário colorido, bem destacado) */
            .categoria-card { 
                background: #ffffff; 
                color: #333333; 
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
                padding-bottom: 10px; 
                margin-bottom: 20px; 
                font-weight: bold; 
            }
            
            .opcoes-grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); 
                gap: 15px; 
            }
            
            /* Checkbox grande e visível – box azul destacando adesão */
            .destaque-adesao { 
                background: #f0f7ff; 
                color: #004085; 
                border: 1px solid #b8daff; 
                padding: 20px; 
                border-radius: 8px; 
                display: flex; 
                align-items: center; 
                gap: 15px; 
                margin-bottom: 30px; 
                cursor: pointer;
                font-size: 1.1rem; 
                font-weight: 600;
            }
            .destaque-adesao input { 
                transform: scale(1.5); 
                cursor: pointer; 
            }

            /* Inputs e Textareas mais visíveis */
            .categoria-card select, 
            .categoria-card textarea, 
            .categoria-card input[type="text"] {
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

            /* Botão de cancelar inscrição com destaque em vermelho */
            .btn-danger { 
                background: transparent; 
                border: 1px solid #c0392b; 
                color: #c0392b; 
                margin-left: 15px; 
            } 
            .btn-danger:hover { 
                background: #c0392b; 
                color: #fff; 
            } 

            /* Estilo da Tabela de Gestão com boa leitura */
            .tabela-jogos { 
                width: 100%; 
                border-collapse: collapse; 
                min-width: 800px; 
            }
            .tabela-jogos th { 
                background: #003366; 
                color: #ffffff; 
                padding: 12px 14px; 
                text-align: left; 
                vertical-align: top; 
                font-size: 0.9rem;
            }
            .tabela-jogos td { 
                padding: 10px 14px; 
                border-bottom: 1px solid #dddddd; 
                color: #333333; 
                vertical-align: top;
                white-space: normal; /* Permite quebra de linha */
                word-wrap: break-word;
                font-size: 0.9rem;
            }
            .tabela-jogos tr:nth-child(even) { 
                background-color: #f9f9f9; 
            }
            .tabela-jogos tr:hover { 
                background-color: #f1f1f1; 
            }

            @media (max-width: 600px) {
                .opcoes-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(s);
    }

    container.innerHTML = `
        <div class="jogos-container">
            <header style="text-align: center; margin-bottom: 30px;">
                <h2 style="font-size: 2rem; color: #e67e22; margin-bottom: 5px;">
                    🏅 Jogos de Integração PRF 2026
                </h2>
                <p style="font-size: 1.1rem; color: #aaa;">
                    📍 Poços de Caldas - MG (12 a 17/04/2026)
                </p>
            </header>

            <form id="form-inscricao-jogos">
                <label class="destaque-adesao">
                    <input type="checkbox" id="interesse" />
                    <span>Desejo integrar a delegação do SINPRF-ES</span>
                </label>
                
                <div class="categoria-card">
                    <div class="categoria-titulo">👤 Dados do Participante</div>
                    <div style="max-width: 300px;">
                        <label style="display:block; margin-bottom:5px; font-weight:bold;">
                            Sexo (Para categorias esportivas):
                        </label>
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
                        <label style="font-weight: bold; display: block; margin-bottom: 5px;">
                            Quantidade de familiares:
                        </label>
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

                    <label style="font-weight: bold; display: block; margin-bottom: 5px;">
                        Nomes dos familiares (um por linha):
                    </label>
                    <textarea id="familiares" rows="6" placeholder="Exemplo:
Maria da Silva (Esposa)
Joãozinho (Filho)"></textarea>
                </div>

                <div class="categoria-card">
                    <div class="categoria-titulo">📝 Observações Adicionais</div>
                    <label style="font-weight: bold; display: block; margin-bottom: 5px;">
                        Informações extras:
                    </label>
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

    // Cancelar inscrição
    if (btnCancelar) {
        btnCancelar.addEventListener("click", async () => {
            if (!confirm("Tem certeza que deseja CANCELAR sua inscrição nos Jogos?")) return;

            statusEl.textContent = "Cancelando...";
            statusEl.style.color = "orange";

            try {
                const r = await apiFetch("/api/jogos/inscricao", { method: "DELETE" });

                if (!r) {
                    statusEl.textContent = "Erro de autenticação ou sessão expirada.";
                    statusEl.style.color = "#c0392b";
                    return;
                }

                if (r.ok) {
                    statusEl.textContent = "Inscrição cancelada com sucesso.";
                    statusEl.style.color = "red";

                    // Limpa o formulário visualmente
                    form.reset();
                    const sexoSel = document.getElementById("sexo");
                    const qtdFamSel = document.getElementById("qtd_familiares");
                    if (sexoSel) sexoSel.value = "";
                    if (qtdFamSel) qtdFamSel.value = "0";

                    // Desmarca todas as modalidades marcadas
                    form.querySelectorAll("input[name='modalidades']:checked")
                        .forEach((chk) => (chk.checked = false));

                    // Desmarca checkbox de interesse
                    const interesse = document.getElementById("interesse");
                    if (interesse) interesse.checked = false;

                    // Se existir painel de lista (usuário com perfil de gestão), recarrega
                    const containerLista = document.querySelector(".jogos-container-lista");
                    if (containerLista) {
                        renderizarLista(containerLista);
                    }
                } else {
                    const detalhes = await r.text().catch(() => "");
                    console.error("Erro ao cancelar inscrição:", r.status, detalhes);
                    statusEl.textContent = "Erro ao cancelar inscrição.";
                    statusEl.style.color = "#c0392b";
                }
            } catch (e) {
                console.error("Exceção ao cancelar inscrição:", e);
                statusEl.textContent = "Erro de conexão.";
                statusEl.style.color = "#c0392b";
            }
        });
    }

    // Enviar inscrição
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!form.querySelector("#interesse").checked) {
            statusEl.textContent = "⚠️ Marque a caixa 'Desejo integrar a delegação' no topo.";
            statusEl.style.color = "#c0392b";
            form.querySelector("#interesse").scrollIntoView({behavior: "smooth", block: "center"});
            return;
        }

        const mods = Array.from(form.querySelectorAll("input[name='modalidades']:checked"))
            .map(m => m.value);
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
            if (r && r.ok) {
                statusEl.textContent = "🎉 Inscrição confirmada com sucesso!";
                statusEl.style.color = "#27ae60";
            } else {
                statusEl.textContent = "Erro ao salvar inscrição.";
                statusEl.style.color = "#c0392b";
            }
        } catch(e) { 
            console.error(e); 
            statusEl.textContent = "Erro de conexão."; 
            statusEl.style.color = "#c0392b";
        }
    });
}

async function renderizarLista(container) {
    console.log("➡️ renderizarLista() iniciada");

    container.innerHTML = '<p style="color:#fff;">Carregando lista...</p>';

    let r;
    try {
        r = await apiFetch("/api/jogos/inscricoes");
        console.log("Resposta bruta do fetch:", r);

        if (!r) {
            console.log("❌ apiFetch retornou null/undefined");
            container.innerHTML = "<p style='color:#f88;'>Erro: resposta inválida.</p>";
            return;
        }

        if (!r.ok) {
            console.log("❌ Resposta HTTP não OK:", r.status);
            const texto = await r.text().catch(() => "(sem detalhes)");
            console.log("Corpo do erro:", texto);
            container.innerHTML = `<p style='color:#f88;'>Erro ${r.status}: não foi possível carregar inscritos.</p>`;
            return;
        }

        const data = await r.json().catch(e => {
            console.log("❌ Erro ao fazer .json():", e);
            return null;
        });

        console.log("📦 JSON retornado pelo servidor:", data);

        if (!data) {
            container.innerHTML = "<p style='color:#f88;'>Erro ao interpretar resposta.</p>";
            return;
        }

        // Pode vir "inscricoes" ou uma lista direta
        const lista = Array.isArray(data.inscricoes)
            ? data.inscricoes
            : Array.isArray(data)
                ? data
                : [];

        console.log("📋 Lista interpretada:", lista);

        if (lista.length === 0) {
            container.innerHTML = "<p style='text-align:center; color:#fff;'>Nenhuma inscrição encontrada.</p>";
            return;
        }

        const totalTit = lista.length;
        const totalFam = lista.reduce((acc, c) => acc + (parseInt(c.qtd_familiares) || 0), 0);

        const rows = lista.map(i => `
            <tr>
                <td><strong>${i.nome_filiado || "-"}</strong></td>
                <td>${i.sexo || "-"}</td>
                <td>${formatarTelefoneTexto(i.telefone1) || "-"}</td>
                <td>${(i.modalidades || []).join(", ")}</td>
                <td style="text-align:center;">${i.qtd_familiares || 0}</td>
                <td>${i.familiares ? i.familiares.replace(/\n/g, "<br>") : ""}</td>
            </tr>
        `).join("");

        console.log("🧱 HTML gerado para linhas:", rows);

        container.innerHTML = `
            <div style="background:#fff; color:#333; padding:20px; border-radius:10px; margin-bottom:20px; border:1px solid #ccc; font-size:1.1rem; text-align:center;">
                <strong>${totalTit}</strong> titulares &nbsp;|&nbsp; 
                <strong>${totalFam}</strong> familiares
                <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px; color:#003366; font-size:1.3rem;">
                    <strong>Total Geral: ${totalTit + totalFam} Pessoas</strong>
                </div>
            </div>

            <div style="overflow-x:auto; width:100%;">
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
            </div>
        `;

        console.log("✅ Tabela renderizada com sucesso!");

    } catch (e) {
        console.error("❌ Erro inesperado em renderizarLista:", e);
        container.innerHTML = "<p style='color:#f88;'>Erro ao carregar lista.</p>";
    }
}

