// public/js/area-filiado/utils.js

export function obterUserInfo() {
    try {
        const raw = localStorage.getItem("userInfo");
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

export async function apiFetch(url, options = {}) {
    const token = localStorage.getItem("token");

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    if (token) headers.Authorization = `Bearer ${token}`;

    const isBodyJson = options.body && typeof options.body === "object" && !(options.body instanceof FormData);

    const response = await fetch(url, {
        ...options,
        headers,
        body: isBodyJson ? JSON.stringify(options.body) : options.body,
    });

    return response;
}

export function formatarCPF(cpfRaw) {
    const v = String(cpfRaw || "").replace(/\D/g, "").slice(0, 11);
    if (v.length !== 11) return cpfRaw || "";
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function normalizarTextoBusca(txt) {
    return String(txt || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

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

        // (XX) XXXXX-XXXX (celular 9 dígitos) OU (XX) XXXX-XXXX
        const ddd = v.slice(0, 2);
        const resto = v.slice(2);

        if (resto.length <= 8) {
            // fixo: 8 dígitos
            return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`.replace(/-$/, "");
        }

        // celular: 9 dígitos
        return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`.replace(/-$/, "");
    }

    input.addEventListener("input", (e) => {
        const pos = e.target.selectionStart || 0;
        const antes = e.target.value;
        e.target.value = formatar(e.target.value);

        // Evita “pular” cursor de forma agressiva (melhor esforço)
        const delta = e.target.value.length - antes.length;
        const novoPos = Math.max(0, pos + delta);
        try {
            e.target.setSelectionRange(novoPos, novoPos);
        } catch (_) {}
    });

    input.addEventListener("blur", (e) => {
        e.target.value = formatar(e.target.value);
    });

    // Formata o valor inicial (quando o input já vem preenchido)
    input.value = formatar(input.value);
}

export function aplicarMascaraTelefoneSomenteNumeros(input) {
    if (!input) return;
    input.addEventListener("input", (e) => {
        e.target.value = String(e.target.value || "").replace(/\D/g, "").slice(0, 11);
    });
}

export function formatarTelefoneTexto(raw) {
    const v = String(raw || "").replace(/\D/g, "").slice(0, 11);
    if (!v) return "";
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    const ddd = v.slice(0, 2);
    const resto = v.slice(2);
    if (resto.length <= 8) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`.replace(/-$/, "");
    return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`.replace(/-$/, "");
}
