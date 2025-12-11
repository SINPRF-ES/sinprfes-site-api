// ressarcimento.js
import { apiFetch, aplicarMascaraTelefone, formatarCPF } from './utils.js';

export function inicializarRessarcimento() {
    const form = document.getElementById("form-ressarcimento");
    if (!form) return;

    // Mascara
    const tel = document.getElementById("res-telefone");
    aplicarMascaraTelefone(tel);

    // Calculos
    ["res-data-inicio", "res-data-fim", "res-km", "res-valor-outros"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", atualizarCalculos);
    });

    // Submit
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type='submit']");
        const status = document.getElementById("res-status");
        btn.disabled = true; status.textContent = "Enviando...";

        const fd = new FormData(form);
        // Garante envio de campos cruciais se o FormData falhar em campos disable
        // (Mas FormData pega readonly, então ok)
        
        // Ajustes manuais se necessário (ex: remover mascara de tel)
        const t = document.getElementById("res-telefone").value.replace(/\D/g, "");
        fd.set("telefone_contato", t);

        try {
            // Nota: apiFetch lida com FormData removendo content-type json
            const r = await apiFetch("/api/ressarcimentos", { method: "POST", body: fd });
            if(r.ok) { 
                status.textContent = "Enviado com sucesso!"; 
                form.reset(); 
                // Repopula dados básicos
                const userData = JSON.parse(localStorage.getItem("userInfo")||"{}");
                preencherFormularioRessarcimentoComDados(userData);
            } else { status.textContent = "Erro ao enviar."; }
        } catch(e) { status.textContent = "Erro."; }
        finally { btn.disabled = false; }
    });
}

function atualizarCalculos() {
    const ini = document.getElementById("res-data-inicio").value;
    const fim = document.getElementById("res-data-fim").value;
    const km = parseFloat(document.getElementById("res-km").value) || 0;
    const outros = parseFloat(document.getElementById("res-valor-outros").value) || 0;

    let dias = 0;
    if(ini && fim) {
        const d1 = new Date(ini); const d2 = new Date(fim);
        if(d2 >= d1) dias = ((d2-d1)/(1000*60*60*24)) + 1;
    }
    const calcDiarias = Math.max(0, dias - 1 + 0.7);
    
    document.getElementById("res-diarias").value = calcDiarias.toFixed(1);
    document.getElementById("res-valor-diarias").value = (calcDiarias * 500).toFixed(2);
    document.getElementById("res-valor-km").value = (km * 1.5).toFixed(2);
    document.getElementById("res-valor-total").value = ((calcDiarias*500)+(km*1.5)+outros).toFixed(2);
}

export function preencherFormularioRessarcimentoComDados(d) {
    if(!d) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ""; };
    setVal("res-nome", d.nome);
    setVal("res-cpf", formatarCPF(d.cpf));
    setVal("res-email", d.email1 || d.email2);
    
    const tel = document.getElementById("res-telefone");
    if(tel) { tel.value = d.telefone1 || d.telefone2 || ""; aplicarMascaraTelefone(tel); }
}