/**
 * Módulo Jogos (Área do Filiado)
 * Carregado como script clássico (window.Jogos)
 */

(function (global) {
    if (global.Jogos) return;

    function inicializarJogos() {
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
                .jogos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
                .mod-item { border: 1px solid #eee; padding: 15px; border-radius: 8px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: 0.2s; }
                .mod-item:hover { background: #f9f9f9; border-color: #003366; }
                .mod-item input { width: 18px; height: 18px; }
                .mod-label { font-weight: bold; color: #333; }
                .jogos-form-group { margin-bottom: 20px; }
                .jogos-form-group label { display: block; font-weight: bold; margin-bottom: 8px; }
                .jogos-form-group textarea, .jogos-form-group input, .jogos-form-group select { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 6px; }
                .btn-jogos { background: #003366; color: #fff; border: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1.1rem; width: 100%; transition: 0.2s; }
                .btn-jogos:hover { background: #004488; }
                .inscricao-resumo { margin-top: 20px; padding: 15px; background: #e8f4fd; border-left: 5px solid #003366; border-radius: 4px; display: none; }
            `;
            document.head.appendChild(s);
        }

        const modalidades = [
            "Futebol Society", "Vôlei de Quadra", "Vôlei de Praia", "Tênis de Mesa",
            "Xadrez", "Natação", "Atletismo", "Tiro Esportivo", "Beach Tennis"
        ];

        secJogos.innerHTML = `
            <div class="jogos-card">
                <div class="jogos-banner">
                    <h2>🏅 Jogos do SINPRF-ES 2024</h2>
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

                        <label style="font-weight:bold;">Selecione as modalidades que deseja participar:</label>
                        <div class="jogos-grid">
                            ${modalidades.map(m => `
                                <label class="mod-item">
                                    <input type="checkbox" name="modalidades" value="${m}">
                                    <span class="mod-label">${m}</span>
                                </label>
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
            btn.disabled = true;
            status.textContent = "Salvando...";

            const selectedMods = Array.from(form.querySelectorAll("input[name='modalidades']:checked")).map(i => i.value);

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

        carregarInscricao();
    }

    global.Jogos = {
        inicializarJogos
    };

})(typeof window !== 'undefined' ? window : global);
