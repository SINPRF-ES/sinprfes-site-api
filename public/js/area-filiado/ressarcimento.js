/**
 * Módulo Ressarcimento (Área do Filiado)
 * Carregado como script clássico (window.Ressarcimento)
 */

(function (global) {
    if (global.RessarcimentoLoaded) return;
    global.RessarcimentoLoaded = true;

    async function inicializarRessarcimento() {
        const sec = document.getElementById("sec-ressarcimento");
        if (!sec) return;

        const { apiFetch, aplicarMascaraTelefone, aplicarMascaraAgencia, aplicarMascaraConta, formatarCPF } = global.Utils || {};

        sec.innerHTML = `
            <div class="section-card">
                <div class="pub-header">
                    <h2>💸 Solicitação de Ressarcimento</h2>
                    <p>Utilize este formulário para solicitar o reembolso de despesas de viagens a serviço.</p>
                </div>

                <form id="form-ressarcimento">
                    <div class="res-card">
                        <h3>👤 Identificação</h3>
                        <div class="res-grid">
                            <div class="res-group"><label>Nome Completo</label><input type="text" id="res-nome" readonly class="input-calc"></div>
                            <div class="res-group"><label>CPF</label><input type="text" id="res-cpf" readonly class="input-calc"></div>
                        </div>
                        <div class="res-grid">
                            <div class="res-group"><label>E-mail</label><input type="email" id="res-email" readonly class="input-calc"></div>
                            <div class="res-group"><label>Telefone Contato</label><input type="text" id="res-telefone" name="telefone_contato"></div>
                        </div>
                    </div>

                    <div class="res-card">
                        <h3>📅 Detalhes da Atividade</h3>
                        <div class="res-grid">
                            <div class="res-group"><label>Data Início</label><input type="date" id="res-data-inicio" name="data_inicio"></div>
                            <div class="res-group"><label>Data Fim</label><input type="date" id="res-data-fim" name="data_fim"></div>
                        </div>
                        <div class="res-group">
                            <label>Descrição do Motivo</label>
                            <textarea id="res-descricao" name="descricao" rows="3" required></textarea>
                        </div>
                    </div>

                    <div class="res-card">
                        <h3>🏦 Dados Bancários</h3>
                        <div class="res-grid">
                            <div class="res-group"><label>Agência</label><input type="text" id="res-agencia" name="agencia"></div>
                            <div class="res-group"><label>Conta</label><input type="text" id="res-conta" name="conta"></div>
                        </div>
                    </div>

                    <div style="text-align:right; margin-top:20px;">
                        <span id="res-status" style="margin-right:15px; font-weight:bold;"></span>
                        <button type="submit" class="btn btn-primary">🚀 Enviar Solicitação</button>
                    </div>
                </form>
            </div>
        `;

        const form = document.getElementById("form-ressarcimento");
        if (aplicarMascaraTelefone) aplicarMascaraTelefone(document.getElementById("res-telefone"));
        if (aplicarMascaraAgencia) aplicarMascaraAgencia(document.getElementById("res-agencia"));
        if (aplicarMascaraConta) aplicarMascaraConta(document.getElementById("res-conta"));

        let userData = global.Utils ? global.Utils.obterUserInfo() : {};
        if (userData.nome) {
            preencherFormularioRessarcimentoComDados(userData);
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const status = document.getElementById("res-status");
            status.textContent = "Enviando...";

            const fd = new FormData(form);
            const payload = Object.fromEntries(fd.entries());

            const onlyDigits = (v) => global.Formatters ? global.Formatters.onlyDigits(v) : (v || "").replace(/\D/g, "");
            payload.telefone_contato = onlyDigits(payload.telefone_contato);

            try {
                const r = await apiFetch("/api/ressarcimentos", { method: "POST", body: payload });
                if (r.ok) {
                    status.textContent = "✅ Enviado com sucesso!";
                    form.reset();
                } else {
                    status.textContent = "Erro ao enviar.";
                }
            } catch (e) {
                status.textContent = "Erro de conexão.";
            }
        });
    }

    function preencherFormularioRessarcimentoComDados(d) {
        if (!d) return;
        const { formatarCPF } = global.Utils || {};
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
        setVal("res-nome", d.nome);
        setVal("res-cpf", formatarCPF ? formatarCPF(d.cpf) : d.cpf);
        setVal("res-email", d.email1 || d.email2);
        setVal("res-telefone", d.telefone1 || d.telefone2);
    }

    global.Ressarcimento = {
        inicializarRessarcimento,
        preencherFormularioRessarcimentoComDados
    };

})(typeof window !== 'undefined' ? window : global);
