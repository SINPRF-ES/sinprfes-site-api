document.addEventListener("DOMContentLoaded", () => {
    
    // --- MÁSCARAS ---
    const inputCpf = document.getElementById("cpf");
    const inputCep = document.getElementById("cep");
    const inputTel1 = document.getElementById("telefone1");
    const inputTel2 = document.getElementById("telefone2");

    if(inputCpf) {
        const formatarCpf = (val) => {
            if (window.Formatters && window.Formatters.formatCpfLive) {
                return window.Formatters.formatCpfLive(val);
            }
            let v = val.replace(/\D/g, "").slice(0, 11);
            if (v.length <= 3) return v;
            if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
            if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
            return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
        };

        inputCpf.addEventListener("input", (e) => {
            const el = e.target;
            const start = el.selectionStart;
            const oldLen = el.value.length;
            el.value = formatarCpf(el.value);
            const newLen = el.value.length;
            if (start !== null && start < oldLen) {
                el.setSelectionRange(start + (newLen - oldLen), start + (newLen - oldLen));
            }
        });
    }

    if(inputCep) {
        inputCep.addEventListener("input", e => {
            e.target.value = e.target.value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
        });
    }

    const maskTel = e => {
        let v = e.target.value.replace(/\D/g, "").slice(0, 11);
        if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
        else if (v.length > 5) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
        else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
        e.target.value = v;
    };
    if(inputTel1) inputTel1.addEventListener("input", maskTel);
    if(inputTel2) inputTel2.addEventListener("input", maskTel);


    // --- 🟢 NOVO: VALIDAÇÃO DE DATAS (Ano máx 4 dígitos) ---
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const hoje = new Date().toISOString().split("T")[0]; // YYYY-MM-DD de hoje

    dateInputs.forEach(input => {
        // Define o máximo no HTML para ajudar a UI do navegador
        input.setAttribute("max", "9999-12-31");

        // 1. Impede digitar mais de 4 dígitos no ano
        input.addEventListener("input", (e) => {
            const valor = e.target.value;
            if (!valor) return;

            const partes = valor.split("-"); // [Ano, Mes, Dia]
            const ano = partes[0];

            if (ano.length > 4) {
                // Corta o ano para 4 dígitos e remonta a data
                const anoCorrigido = ano.slice(0, 4);
                e.target.value = `${anoCorrigido}-${partes[1]}-${partes[2]}`;
            }
        });

        // 2. Validação lógica ao sair do campo (Blur)
        input.addEventListener("blur", (e) => {
            const valor = e.target.value;
            if (!valor) return;

            const ano = parseInt(valor.split("-")[0]);
            
            // Regra: Ano deve ser > 1900
            if (ano < 1900) {
                alert("Ano inválido. Por favor, verifique a data.");
                e.target.value = "";
                return;
            }

            // Regra: Se for campo de nascimento, não pode ser no futuro
            if (input.id.includes("nascimento") && valor > hoje) {
                alert("A data de nascimento não pode ser no futuro.");
                e.target.value = "";
            }
        });
    });


    // --- BUSCA CEP ---
    const btnCep = document.getElementById("btn-buscar-cep");
    
    const buscarCep = async () => {
        const cep = inputCep.value.replace(/\D/g, "");
        if(cep.length !== 8) return alert("Digite um CEP válido com 8 números.");
        
        const originalText = btnCep.innerText;
        btnCep.innerText = "⏳";
        btnCep.disabled = true;

        try {
            const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const d = await r.json();
            if(!d.erro) {
                document.getElementById("logradouro").value = d.logradouro;
                document.getElementById("bairro").value = d.bairro;
                document.getElementById("cidade").value = d.localidade;
                document.getElementById("uf").value = d.uf;
                document.getElementById("numero").focus();
            } else {
                alert("CEP não encontrado.");
            }
        } catch(e) {
            console.error(e);
            alert("Erro ao buscar CEP.");
        } finally {
            btnCep.innerText = originalText;
            btnCep.disabled = false;
        }
    };

    if(btnCep) btnCep.addEventListener("click", buscarCep);
    if(inputCep) inputCep.addEventListener("blur", () => {
        if(inputCep.value.replace(/\D/g,"").length === 8) buscarCep();
    });


    // --- ENVIO DO FORMULÁRIO ---
    const form = document.getElementById("filiese-form");
    const msgContainer = document.getElementById("msg-container");
    const btnSubmit = document.getElementById("btn-submit");

    if(form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const originalText = btnSubmit.innerText;
            btnSubmit.disabled = true;
            btnSubmit.innerText = "ENVIANDO...";
            msgContainer.style.display = "none";
            msgContainer.className = "status-msg";

            const fd = new FormData(form);
            const payload = Object.fromEntries(fd.entries());

            // Normalização de Nome (Canônico)
            if (payload.nome && window.Canon?.normalizeNome) {
                payload.nome = window.Canon.normalizeNome(payload.nome);
            }
            
            // Limpa formatação antes de enviar
            payload.cpf = payload.cpf.replace(/\D/g, "");
            payload.cep = payload.cep.replace(/\D/g, "");
            payload.telefone1 = payload.telefone1.replace(/\D/g, "");
            if(payload.telefone2) payload.telefone2 = payload.telefone2.replace(/\D/g, "");

            try {
                const API_BASE = (window.Utils && window.Utils.resolveApiBase)
                    ? window.Utils.resolveApiBase()
                    : (window.API_BASE_URL || "").replace(/\/+$/, "");

                if (!API_BASE) {
                    console.error("API_BASE não definido. Verifique config.js e utils.js");
                    alert("Erro de configuração do sistema. Tente novamente mais tarde.");
                    return;
                }

                const res = await fetch(`${API_BASE}/api/filiese`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if(res.ok) {
                    msgContainer.innerHTML = `✅ <strong>Sucesso!</strong> ${data.message}`;
                    msgContainer.classList.add("status-success");
                    form.reset();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    throw new Error(data.message || "Erro desconhecido.");
                }
            } catch(err) {
                msgContainer.innerHTML = `❌ <strong>Erro:</strong> ${err.message}`;
                msgContainer.classList.add("status-error");
            } finally {
                msgContainer.style.display = "block";
                btnSubmit.disabled = false;
                btnSubmit.innerText = originalText;
            }
        });
    }
});