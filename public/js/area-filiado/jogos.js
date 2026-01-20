/**
 * Módulo Jogos (Área do Filiado)
 * Carregado como script clássico (window.Jogos)
 */

(function (global) {
    if (global.Jogos) return;

    const MODALIDADES_JOGOS_2026 = [
        { id: 'atletismo_100m_masc', label: '100m Masculino', grupo: 'Atletismo', pontuavel: true },
        { id: 'atletismo_100m_fem', label: '100m Feminino', grupo: 'Atletismo', pontuavel: true },
        { id: 'atletismo_400m_masc', label: '400m Masculino', grupo: 'Atletismo', pontuavel: true },
        { id: 'atletismo_400m_fem', label: '400m Feminino', grupo: 'Atletismo', pontuavel: true },
        { id: 'atletismo_1500m_masc', label: '1500m Masculino', grupo: 'Atletismo', pontuavel: true },
        { id: 'atletismo_1500m_fem', label: '1500m Feminino', grupo: 'Atletismo', pontuavel: true },
        { id: 'atletismo_5000m_masc', label: '5000m Masculino', grupo: 'Atletismo', pontuavel: true },
        { id: 'atletismo_5000m_fem', label: '5000m Feminino', grupo: 'Atletismo', pontuavel: true },
        { id: 'beach_tenis_dupla_livre', label: 'Beach Tênis - Dupla Livre', grupo: 'Beach Tênis', pontuavel: true },
        { id: 'beach_tenis_dupla_mista', label: 'Beach Tênis - Dupla Mista', grupo: 'Beach Tênis', pontuavel: true },
        { id: 'canastra', label: 'Canastra', grupo: 'Jogos de Mesa', pontuavel: true },
        { id: 'domino', label: 'Dominó', grupo: 'Jogos de Mesa', pontuavel: true },
        { id: 'truco_duplas', label: 'Truco (Duplas)', grupo: 'Jogos de Mesa', pontuavel: true },
        { id: 'xadrez', label: 'Xadrez', grupo: 'Jogos de Mesa', pontuavel: true },
        { id: 'futebol_society_livre', label: 'Futebol Society (Livre)', grupo: 'Futebol', pontuavel: true },
        { id: 'futebol_society_master', label: 'Futebol Society (Master - Acima de 55 anos)', grupo: 'Futebol', pontuavel: true },
        { id: 'futsal_livre', label: 'Futsal (Livre)', grupo: 'Futebol', pontuavel: true },
        { id: 'futevolei', label: 'Futevôlei', grupo: 'Vôlei', pontuavel: true },
        { id: 'voleibol_livre', label: 'Voleibol (Livre)', grupo: 'Vôlei', pontuavel: true },
        { id: 'voleibol_praia_dupla_masc', label: 'Vôlei de Praia - Dupla Masculina', grupo: 'Vôlei', pontuavel: true },
        { id: 'voleibol_praia_dupla_mista', label: 'Vôlei de Praia - Dupla Mista', grupo: 'Vôlei', pontuavel: true },
        { id: 'jiu_jitsu', label: 'Jiu-Jitsu', grupo: 'Artes Marciais', pontuavel: true },
        { id: 'natacao_50m_livre_masc', label: '50m Nado Livre (Masculino)', grupo: 'Natação', pontuavel: true },
        { id: 'natacao_50m_livre_fem', label: '50m Nado Livre (Feminino)', grupo: 'Natação', pontuavel: true },
        { id: 'natacao_50m_costas_masc', label: '50m Nado Costas (Masculino)', grupo: 'Natação', pontuavel: true },
        { id: 'natacao_50m_costas_fem', label: '50m Nado Costas (Feminino)', grupo: 'Natação', pontuavel: true },
        { id: 'natacao_50m_peito_masc', label: '50m Nado Peito (Masculino)', grupo: 'Natação', pontuavel: true },
        { id: 'natacao_50m_peito_fem', label: '50m Nado Peito (Feminino)', grupo: 'Natação', pontuavel: true },
        { id: 'natacao_50m_borboleta_masc', label: '50m Nado Borboleta (Masculino)', grupo: 'Natação', pontuavel: true },
        { id: 'natacao_50m_borboleta_fem', label: '50m Nado Borboleta (Feminino)', grupo: 'Natação', pontuavel: true },
        { id: 'natacao_revezamento_4x50m_livre', label: 'Revezamento 4x50m Livre', grupo: 'Natação', pontuavel: true },
        { id: 'natacao_revezamento_2x50m_misto', label: 'Revezamento 2x50 Misto', grupo: 'Natação', pontuavel: true },
        { id: 'sinuca_individual', label: 'Sinuca Individual', grupo: 'Sinuca', pontuavel: true },
        { id: 'sinuca_duplas', label: 'Sinuca Duplas', grupo: 'Sinuca', pontuavel: true },
        { id: 'tenis_quadra_individual_masc', label: 'Tênis de Quadra - Individual (Masculino)', grupo: 'Tênis', pontuavel: true },
        { id: 'tenis_quadra_duplas_livre', label: 'Tênis de Quadra - Duplas (Livre)', grupo: 'Tênis', pontuavel: true },
        { id: 'tenis_mesa_masc', label: 'Tênis de Mesa (Masculino)', grupo: 'Tênis de Mesa', pontuavel: true },
        { id: 'tenis_mesa_fem', label: 'Tênis de Mesa (Feminino)', grupo: 'Tênis de Mesa', pontuavel: true },
        { id: 'tenis_mesa_duplas', label: 'Tênis de Mesa (Duplas)', grupo: 'Tênis de Mesa', pontuavel: true },
        { id: 'tiro_nra_masc', label: 'Tiro NRA (Masculino)', grupo: 'Tiro', pontuavel: true },
        { id: 'tiro_nra_fem', label: 'Tiro NRA (Feminino)', grupo: 'Tiro', pontuavel: true },
        { id: 'tiro_ispc_masc', label: 'Tiro ISPC (Masculino)', grupo: 'Tiro', pontuavel: true },
        { id: 'tiro_ispc_fem', label: 'Tiro ISPC (Feminino)', grupo: 'Tiro', pontuavel: true },
        { id: 'peteca', label: 'Peteca', grupo: 'Exibição', pontuavel: false },
        { id: 'damas', label: 'Damas', grupo: 'Exibição', pontuavel: false },
        { id: 'bocha', label: 'Bocha', grupo: 'Exibição', pontuavel: false },
    ];

    function inicializarJogos(perfil) {
        const secJogos = document.getElementById("sec-jogos");
        if (!secJogos) return;

        if (!document.getElementById('style-jogos')) {
            const s = document.createElement('style');
            s.id = 'style-jogos';
            s.textContent = `
                .jogos-card { background: #fff; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                .jogos-banner { background: #003366; color: #fff; padding: 30px; text-align: center; }
                .jogos-banner h2 { font-size: 2rem; margin-bottom: 10px; color: #f1c40f; }
                .jogos-body { padding: 30px; }
                .jogos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 10px; }
                .jogos-grupo-box { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
                .jogos-grupo-titulo { font-weight: bold; color: #003366; border-bottom: 2px solid #003366; margin-bottom: 10px; padding-bottom: 5px; font-size: 1.1rem; }
                .mod-item { border: 1px solid #eee; padding: 10px; border-radius: 6px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: 0.2s; background: #fff; margin-bottom: 5px; }
                .mod-item:hover { background: #f0f4f8; border-color: #003366; }
                .mod-item input { width: 18px; height: 18px; cursor: pointer; }
                .mod-label { font-weight: 500; color: #333; font-size: 0.95rem; }
                .jogos-form-group { margin-bottom: 20px; }
                .jogos-form-group label { display: block; font-weight: bold; margin-bottom: 8px; }
                .jogos-form-group textarea, .jogos-form-group input, .jogos-form-group select { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 6px; }
                .btn-jogos { background: #003366; color: #fff; border: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1.1rem; width: 100%; transition: 0.2s; }
                .btn-jogos:hover { background: #004488; }
                .btn-export { background: #27ae60; color: #fff; border: none; padding: 8px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; margin-right: 10px; font-size: 0.9rem; }
                .btn-export:hover { background: #219150; }
                .inscricao-resumo { margin-top: 20px; padding: 15px; background: #e8f4fd; border-left: 5px solid #003366; border-radius: 4px; display: none; }
                .planilha-container { margin-top: 40px; border-top: 2px solid #eee; padding-top: 30px; overflow-x: auto; }
                .jogos-tabela { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9rem; }
                .jogos-tabela th, .jogos-tabela td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                .jogos-tabela th { background: #f4f4f4; position: sticky; top: 0; }
                .jogos-tabela tr:nth-child(even) { background: #fafafa; }
            `;
            document.head.appendChild(s);
        }

        const agruparModalidades = (lista) => {
            return lista.reduce((acc, item) => {
                if (!acc[item.grupo]) acc[item.grupo] = [];
                acc[item.grupo].push(item);
                return acc;
            }, {});
        };

        const grupos = agruparModalidades(MODALIDADES_JOGOS_2026);

        secJogos.innerHTML = `
            <div class="jogos-card">
                <div class="jogos-banner">
                    <h2>🏅 Jogos de Integração da PRF - 2026</h2>
                    <p>Participe da maior integração esportiva da categoria!</p>
                </div>
                <div class="jogos-body">
                    <form id="form-jogos">
                        <div class="jogos-form-group">
                            <label>Sexo (Para fins de categoria esportiva)</label>
                            <select name="sexo" id="jogos-sexo" required>
                                <option value="">Selecione...</option>
                                <option value="MASCULINO">Masculino</option>
                                <option value="FEMININO">Feminino</option>
                            </select>
                        </div>

                        <label style="font-weight:bold; display:block; margin-bottom:15px;">Selecione as modalidades que deseja participar (ao menos 1):</label>
                        <div class="jogos-grid">
                            ${Object.keys(grupos).map(grupo => `
                                <div class="jogos-grupo-box">
                                    <div class="jogos-grupo-titulo">${grupo}</div>
                                    ${grupos[grupo].map(m => `
                                        <label class="mod-item">
                                            <input type="checkbox" name="modalidades" value="${m.id}">
                                            <span class="mod-label">${m.label}</span>
                                        </label>
                                    `).join("")}
                                </div>
                            `).join("")}
                        </div>

                        <div class="jogos-form-group" style="margin-top:25px;">
                            <label>Levará familiares? (Quantos?)</label>
                            <input type="number" name="qtd_familiares" id="jogos-qtd-fam" value="0" min="0">
                        </div>

                        <div class="jogos-form-group">
                            <label>Nome dos familiares (um por linha)</label>
                            <textarea name="familiares" id="jogos-fam-nomes" rows="3" placeholder="Ex: Maria (Esposa), João (Filho)..."></textarea>
                        </div>

                        <div class="jogos-form-group">
                            <label>Observações Adicionais</label>
                            <textarea name="observacoes" id="jogos-obs" rows="3" placeholder="Restrições alimentares, necessidades especiais, etc."></textarea>
                        </div>

                        <button type="submit" class="btn-jogos">Confirmar minha Inscrição 🚀</button>
                        <div id="jogos-status" style="margin-top:15px; text-align:center; font-weight:bold;"></div>
                    </form>

                    <div id="jogos-resumo-inscricao" class="inscricao-resumo"></div>
                </div>
            </div>
        `;

        const form = document.getElementById("form-jogos");
        const status = document.getElementById("jogos-status");
        const resumo = document.getElementById("jogos-resumo-inscricao");

        async function carregarInscricao() {
            try {
                const r = await window.Api.apiFetch("/api/jogos/inscricao");
                if (r.ok) {
                    const data = await r.json();
                    if (data) {
                        document.getElementById("jogos-sexo").value = data.sexo || "";
                        document.getElementById("jogos-qtd-fam").value = data.qtd_familiares || 0;
                        document.getElementById("jogos-fam-nomes").value = data.familiares || "";
                        document.getElementById("jogos-obs").value = data.observacoes || "";

                        const mods = data.modalidades || [];
                        form.querySelectorAll("input[name='modalidades']").forEach(chk => {
                            chk.checked = mods.includes(chk.value);
                        });

                        resumo.innerHTML = `<strong>Sua inscrição está confirmada!</strong><br>Você pode atualizar os dados acima a qualquer momento.`;
                        resumo.style.display = "block";
                    }
                }
            } catch(e) {}
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = form.querySelector("button");
            const selectedMods = Array.from(form.querySelectorAll("input[name='modalidades']:checked")).map(i => i.value);

            if (selectedMods.length === 0) {
                status.textContent = "⚠️ Selecione ao menos uma modalidade.";
                status.style.color = "#e67e22";
                return;
            }

            btn.disabled = true;
            status.textContent = "Salvando...";

            const payload = {
                sexo: document.getElementById("jogos-sexo").value,
                qtd_familiares: document.getElementById("jogos-qtd-fam").value,
                familiares: document.getElementById("jogos-fam-nomes").value,
                observacoes: document.getElementById("jogos-obs").value,
                modalidades: selectedMods
            };

            try {
                const r = await window.Api.apiFetch("/api/jogos/inscricao", { method: "POST", body: payload });
                if (r.ok) {
                    status.textContent = "✅ Inscrição salva com sucesso!";
                    status.style.color = "#27ae60";
                    carregarInscricao();
                } else {
                    status.textContent = "❌ Erro ao salvar.";
                    status.style.color = "#c0392b";
                }
            } catch(err) {
                status.textContent = "❌ Erro de conexão.";
            } finally {
                btn.disabled = false;
            }
        };

        async function carregarPlanilha() {
            const P_MANAGER = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"];
            if (!P_MANAGER.includes(perfil)) return;

            const cardBody = secJogos.querySelector(".jogos-body");
            const container = document.createElement("div");
            container.className = "planilha-container";
            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                    <h3 style="margin:0;">📊 Planilha de Inscrições (Gestão)</h3>
                    <div id="jogos-export-actions">
                        <button id="btn-export-csv" class="btn-export">Exportar CSV</button>
                        <button id="btn-export-xls" class="btn-export" style="background:#2980b9;">Exportar XLS</button>
                    </div>
                </div>
                <div id="tabela-jogos-wrapper" style="max-height: 600px; overflow: auto;">Carregando planilha...</div>
            `;
            cardBody.appendChild(container);

            try {
                const r = await window.Api.apiFetch("/api/jogos/inscricoes");
                if (!r.ok) throw new Error();
                const { inscricoes } = await r.json();

                if (!inscricoes || inscricoes.length === 0) {
                    document.getElementById("tabela-jogos-wrapper").textContent = "Nenhuma inscrição realizada até o momento.";
                    return;
                }

                renderizarTabela(inscricoes);
                configurarExports(inscricoes);
            } catch (err) {
                document.getElementById("tabela-jogos-wrapper").textContent = "Erro ao carregar dados da planilha.";
            }
        }

        function calcularIdade2026(dataNasc) {
            if (!dataNasc) return "";
            let ano = 0;
            // ISO: YYYY-MM-DD
            if (dataNasc.includes("-")) {
                ano = parseInt(dataNasc.split("-")[0]);
            } else if (dataNasc.includes("/")) {
                // BR: DD/MM/AAAA
                const partes = dataNasc.split("/");
                if (partes.length === 3) ano = parseInt(partes[2]);
            }
            if (!ano || isNaN(ano)) return "";
            return 2026 - ano;
        }

        function renderizarTabela(dados) {
            const wrapper = document.getElementById("tabela-jogos-wrapper");
            const html = `
                <table class="jogos-tabela" id="tabela-inscricoes-jogos">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Idade (2026)</th>
                            <th>Sexo</th>
                            <th>Modalidades</th>
                            <th>Qtd Fam.</th>
                            <th>Familiares</th>
                            <th>Observações</th>
                            <th>Telefone</th>
                            <th>E-mail(s)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dados.map(i => {
                            const idade = calcularIdade2026(i.data_nascimento);
                            const modsLabels = (i.modalidades || []).map(id => {
                                const m = MODALIDADES_JOGOS_2026.find(x => x.id === id);
                                return m ? m.label : id;
                            }).join(", ");
                            const emails = [i.email1, i.email2].filter(Boolean).join(" / ");
                            return `
                                <tr>
                                    <td style="font-weight:bold;">${i.nome_filiado || "-"}</td>
                                    <td style="text-align:center;">${idade || "-"}</td>
                                    <td>${i.sexo || "-"}</td>
                                    <td style="font-size:0.85rem;">${modsLabels}</td>
                                    <td style="text-align:center;">${i.qtd_familiares || 0}</td>
                                    <td style="font-size:0.85rem;">${i.familiares || "-"}</td>
                                    <td style="font-size:0.85rem;">${i.observacoes || "-"}</td>
                                    <td>${i.telefone1 || "-"}</td>
                                    <td style="font-size:0.85rem;">${emails || "-"}</td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            `;
            wrapper.innerHTML = html;
        }

        function configurarExports(dados) {
            const btnCsv = document.getElementById("btn-export-csv");
            const btnXls = document.getElementById("btn-export-xls");

            if (btnCsv) btnCsv.onclick = () => exportarParaCSV(dados);
            if (btnXls) btnXls.onclick = () => exportarParaXLS(dados);
        }

        function exportarParaCSV(dados) {
            const headers = ["Nome", "Idade (2026)", "Sexo", "Modalidades", "Qtd Familiares", "Familiares", "Observacoes", "Telefone", "Emails"];
            const rows = dados.map(i => {
                const idade = calcularIdade2026(i.data_nascimento);
                const mods = (i.modalidades || []).map(id => {
                    const m = MODALIDADES_JOGOS_2026.find(x => x.id === id);
                    return m ? m.label : id;
                }).join("; ");
                const emails = [i.email1, i.email2].filter(Boolean).join(" / ");

                return [
                    i.nome_filiado || "",
                    idade,
                    i.sexo || "",
                    mods,
                    i.qtd_familiares || 0,
                    (i.familiares || "").replace(/\n/g, " "),
                    (i.observacoes || "").replace(/\n/g, " "),
                    i.telefone1 || "",
                    emails
                ].map(v => `"${String(v).replace(/"/g, '""')}"`);
            });

            const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `inscricoes_jogos_2026_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function exportarParaXLS(dados) {
            const table = document.getElementById("tabela-inscricoes-jogos");
            if (!table) return;

            const html = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head><meta charset="UTF-8"></head>
                <body>${table.outerHTML}</body>
                </html>
            `;
            const blob = new Blob([html], { type: "application/vnd.ms-excel" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `inscricoes_jogos_2026_${new Date().toISOString().slice(0,10)}.xls`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        carregarInscricao();
        carregarPlanilha();
    }

    global.Jogos = {
        inicializarJogos
    };

})(typeof window !== 'undefined' ? window : global);
