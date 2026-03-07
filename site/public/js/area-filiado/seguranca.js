/**
 * Módulo Segurança (Página Inicial)
 * Carregado como script clássico (window.Seguranca)
 */

(function (global) {
    if (global.Seguranca) return;

    function renderizarSeguranca(filiado, callbackRecarregar) {
        // Suporta renderização em dois lugares:
        // 1. Aba própria (sec-seguranca)
        // 2. Inline em Meus Dados
        const containers = [
            document.getElementById('seguranca-conteudo'),
            document.getElementById('seguranca-container')
        ].filter(Boolean);

        if (containers.length === 0) {
            const pai = document.querySelector('#sec-meus-dados .section-card');
            if (pai) {
                const c = document.createElement('div');
                c.id = 'seguranca-container';
                pai.appendChild(c);
                containers.push(c);
            } else return;
        }

        const html = filiado.twofa_ativo ? `
            <div class="section-card">
                <div class="af-standard-header">
                    <h2>🔒 Segurança da Conta</h2>
                    <p class="section-subtitle">Gerencie suas opções de proteção.</p>
                </div>
                <div class="section-box" style="margin-top: 20px; border-left: 5px solid #27ae60; background: #f0fff4;">
                    <h3 class="section-subtitle" style="color: #27ae60; margin-bottom: 8px;">✅ Autenticação em duas etapas (2FA) ATIVADA</h3>
                    <p class="field-hint" style="margin-bottom: 12px;">Sua conta está protegida por um código adicional ao fazer login.</p>
                    <div style="text-align:center;"><button id="btn-desativar-2fa" class="btn btn-outline btn-sm" style="border-color: #27ae60; color: #27ae60;">Desativar 2FA</button></div>
                </div>
            </div>` : `
            <div class="section-card">
                <div class="af-standard-header">
                    <h2>🔒 Segurança da Conta</h2>
                    <p class="section-subtitle">Gerencie suas opções de proteção.</p>
                </div>
                <div class="section-box" style="margin-top: 20px; border-left: 5px solid #ffc107; background: #fffdf0;">
                    <h3 class="section-subtitle" style="margin-bottom: 8px;">⚠️ Aumente sua segurança</h3>
                    <p class="field-hint" style="margin-bottom: 12px;">Ative a autenticação em duas etapas (2FA) para proteger seu acesso.</p>
                    <div style="display:flex; justify-content:center; margin-top: 8px;">
                        <a href="/config-2fa.html" class="btn btn-primary" style="display:inline-flex; align-items:center; justify-content:center; white-space:normal; text-align:center; max-width: 100%;">Ativar 2FA Agora</a>
                    </div>
                </div>
            </div>`;

        containers.forEach(c => {
            c.innerHTML = html;
            const btn = c.querySelector("#btn-desativar-2fa");
            if (btn) btn.onclick = () => desativar2FA(callbackRecarregar);
        });
    }

    async function desativar2FA(callbackRecarregar) {
        if (!confirm("Tem certeza que deseja desativar o 2FA?")) return;
        try {
            const res = await window.Api.apiFetch("/api/filiados/2fa/desativar", { method: "POST" });
            if (res.ok) {
                alert("2FA Desativado.");
                if (callbackRecarregar) callbackRecarregar();
            } else {
                alert("Erro ao desativar.");
            }
        } catch (e) { console.error(e); }
    }

    global.Seguranca = {
        renderizarSeguranca
    };

})(typeof window !== 'undefined' ? window : global);
