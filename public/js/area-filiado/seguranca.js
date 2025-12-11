// seguranca.js
import { apiFetch } from './utils.js';

export function renderizarSeguranca(filiado, callbackRecarregar) {
    let container = document.getElementById('seguranca-container');
    if (!container) {
        const pai = document.querySelector('#sec-meus-dados .section-card');
        if(pai) {
            container = document.createElement('div');
            container.id = 'seguranca-container';
            pai.appendChild(container);
        } else return;
    }

    if (filiado.twofa_ativo) {
        container.innerHTML = `
            <div class="section-box" style="margin-top: 20px; border-left: 5px solid #27ae60;">
                <h3 class="section-subtitle" style="color: #27ae60; margin-bottom: 8px;">✅ Parabéns! Você está mais seguro.</h3>
                <p class="field-hint" style="margin-bottom: 12px;">A autenticação em duas etapas (2FA) está <strong>ATIVADA</strong>.</p>
                <div class="form-actions"><button id="btn-desativar-2fa" class="btn btn-outline btn-sm" style="border-color: #27ae60; color: #27ae60;">Desativar 2FA</button></div>
            </div>`;
        document.getElementById("btn-desativar-2fa").addEventListener("click", () => desativar2FA(callbackRecarregar));
    } else {
        container.innerHTML = `
            <div class="section-box" style="margin-top: 20px; border-left: 5px solid #ffc107;">
                <h3 class="section-subtitle" style="margin-bottom: 8px;">⚠️ Segurança da conta</h3>
                <p class="field-hint" style="margin-bottom: 12px;">Para aumentar a segurança, ative a autenticação em duas etapas (2FA).</p>
                <div class="form-actions"><a href="/config-2fa.html" class="btn btn-primary btn-sm">Ativar 2FA</a></div>
            </div>`;
    }
}

async function desativar2FA(callbackRecarregar) {
    if (!confirm("Tem certeza que deseja desativar o 2FA?")) return;
    try {
        const res = await apiFetch("/api/filiados/2fa/desativar", { method: "POST" });
        if (res.ok) {
            alert("2FA Desativado.");
            if (callbackRecarregar) callbackRecarregar();
        } else {
            alert("Erro ao desativar.");
        }
    } catch (e) { console.error(e); }
}