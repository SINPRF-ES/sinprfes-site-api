// utils.js

export function obterToken() {
    return localStorage.getItem("token");
}

export function obterUserInfo() {
    try {
        return JSON.parse(localStorage.getItem("userInfo") || "{}");
    } catch (e) {
        return {};
    }
}

// Wrapper para Fetch que injeta o Token automaticamente
export async function apiFetch(url, options = {}) {
    const token = obterToken();
    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    const headers = { 
        "Authorization": `Bearer ${token}`,
        ...options.headers 
    };

    // Se body for objeto (e não FormData), stringify e header JSON
    if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        localStorage.removeItem("token");
        window.location.href = "/login.html";
        throw new Error("Sessão expirada");
    }

    return response;
}

// Máscaras e Formatação
export function aplicarMascaraTelefone(input) {
    if (!input) return;

    function formatar(raw) {
        let v = String(raw || "").replace(/\D/g, "").slice(0, 11);

        // Se não tem número, não mostra nada (nem "(")
        if (v.length === 0) {
            return "";
        }

        // (XX
        if (v.length <= 2) {
            return `(${v}`;
        }

        // (XX) XXXX
        if (v.length <= 6) {
            return `(${v.slice(0, 2)}) ${v.slice(2)}`;
        }

        // Até 10 dígitos -> (XX) XXXX-XXXX
        if (v.length <= 10) {
            return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
        }

        // 11 dígitos -> (XX) XXXXX-XXXX
        return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`;
    }

    // Normaliza o valor inicial, se já existir
    input.value = formatar(input.value);

    input.addEventListener("input", (e) => {
        e.target.value = formatar(e.target.value);
    });
}


export function formatarTelefoneTexto(v) {
    if (!v) return "-";
    v = String(v).replace(/\D/g, "");
    if (v.length === 11) return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    if (v.length === 10) return `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
    return v;
}

export function formatarCPF(cpf) {
    if (!cpf) return "";
    const only = String(cpf).replace(/\D/g, "");
    if (only.length !== 11) return cpf;
    return only.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function normalizarTextoBusca(valor) {
    if (!valor) return "";
    return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").replace(/[^\w]/g, "").toLowerCase();
}

// Alerta Flutuante (Exibição Global)
export function exibirAlertaFlutuante() {
    if (sessionStorage.getItem('fechouAlertaJogos')) return;
    const div = document.createElement('div');
    div.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #e67e22; color: white; padding: 20px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.4); z-index: 9999; max-width: 300px; font-family: sans-serif; border: 2px solid #fff;";
    div.innerHTML = `<button style="position: absolute; top: 5px; right: 8px; background: none; border: none; color: white; font-weight: bold; cursor: pointer;">✕</button><h3 style="margin: 0 0 10px 0; font-size: 1.2rem;">🏆 Jogos 2026</h3><p style="margin: 0 0 15px 0;">Não esqueça sua pré-inscrição!</p><button id="btn-ir-jogos" style="background: white; color: #d35400; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; width: 100%;">Inscrever-se</button>`;
    document.body.appendChild(div);
    
    div.querySelector('button').addEventListener('click', () => { div.remove(); sessionStorage.setItem('fechouAlertaJogos', 'true'); });
    div.querySelector('#btn-ir-jogos').addEventListener('click', () => {
        const btn = document.querySelector('button[data-target="sec-jogos"]');
        if (btn) btn.click();
        div.remove();
    });
}
// Adicione ao final do utils.js

// Máscara Agência: Aceita até 4 dígitos + 1 verificador (Ex: 1234-5)
export function aplicarMascaraAgencia(input) {
    if (!input) return;
    input.maxLength = 6; // 4 números + 1 hífen + 1 número
    input.addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número
        
        // Limita tamanho bruto (sem formatação) para 5 dígitos (4 da agência + 1 DV)
        if (v.length > 5) v = v.slice(0, 5);

        // Aplica o hífen antes do último dígito se tiver 5 números (12345 -> 1234-5)
        // Se tiver menos, deixa só números ou aplica regra de 4 dígitos padrão
        if (v.length > 4) {
            v = v.replace(/^(\d{4})(\d)/, "$1-$2");
        }
        
        e.target.value = v;
    });
}

// Máscara Conta: Aceita números variáveis + 1 verificador (Ex: 12345-6 ou 12345678-9)
export function aplicarMascaraConta(input) {
    if (!input) return;
    input.maxLength = 15; // Tamanho de segurança
    input.addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, ""); // Remove letras
        
        // Formata colocando hífen antes do último dígito
        // Ex: 123456 -> 12345-6
        if (v.length > 1) {
            v = v.replace(/^(\d+)(\d{1})$/, "$1-$2");
        }
        
        e.target.value = v;
    });
}