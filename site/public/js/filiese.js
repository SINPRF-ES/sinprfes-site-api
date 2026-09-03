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
            const msgContainer = document.getElementById("msg-container");
            
            // Regra: Ano deve ser > 1900
            if (ano < 1900) {
                if (window.Utils && window.Utils.exibirMensagem) {
                    window.Utils.exibirMensagem(msgContainer, "Ano inválido. Por favor, verifique a data.", "danger");
                    window.scrollTo({ top: msgContainer.offsetTop - 100, behavior: 'smooth' });
                } else {
                    alert("Ano inválido. Por favor, verifique a data.");
                }
                e.target.value = "";
                return;
            }

            // Regra: Se for campo de nascimento, não pode ser no futuro
            if (input.id.includes("nascimento") && valor > hoje) {
                if (window.Utils && window.Utils.exibirMensagem) {
                    window.Utils.exibirMensagem(msgContainer, "A data de nascimento não pode ser no futuro.", "danger");
                    window.scrollTo({ top: msgContainer.offsetTop - 100, behavior: 'smooth' });
                } else {
                    alert("A data de nascimento não pode ser no futuro.");
                }
                e.target.value = "";
            }
        });
    });


    // --- BUSCA CEP ---
    const btnCep = document.getElementById("btn-buscar-cep");
    
    const buscarCep = async () => {
        const cep = inputCep.value.replace(/\D/g, "");
        const cepError = document.getElementById("cep-error");
        if (cepError) cepError.style.display = "none";

        if(cep.length !== 8) {
            if (cepError) {
                cepError.textContent = "Digite um CEP válido com 8 números.";
                cepError.style.display = "block";
            } else {
                alert("Digite um CEP válido com 8 números.");
            }
            return;
        }
        
        const originalText = btnCep.innerText;
        btnCep.innerHTML = '<span class="ui-spinner"></span>';
        btnCep.disabled = true;

        try {
            const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const d = await r.json();
            if(!d.erro) {
                const inputLog = document.getElementById("logradouro");
                const inputBai = document.getElementById("bairro");
                const inputCid = document.getElementById("cidade");
                const inputUf  = document.getElementById("uf");

                const temLog = d.logradouro && String(d.logradouro).trim() !== "";
                const temBai = d.bairro && String(d.bairro).trim() !== "";

                if (inputLog) {
                    inputLog.value = temLog ? d.logradouro : "";
                    inputLog.readOnly = temLog;
                    inputLog.style.backgroundColor = temLog ? "#eaeff5" : "#fff";
                }

                if (inputBai) {
                    inputBai.value = temBai ? d.bairro : "";
                    inputBai.readOnly = temBai;
                    inputBai.style.backgroundColor = temBai ? "#eaeff5" : "#fff";
                }

                if (inputCid) inputCid.value = d.localidade || "";
                if (inputUf) inputUf.value = d.uf || "";

                if (!temLog && inputLog) {
                    inputLog.focus();
                } else if (!temBai && inputBai) {
                    inputBai.focus();
                } else {
                    document.getElementById("numero").focus();
                }
            } else {
                if (cepError) {
                    cepError.textContent = "CEP não encontrado.";
                    cepError.style.display = "block";
                } else {
                    alert("CEP não encontrado.");
                }
            }
        } catch(e) {
            console.error(e);
            if (cepError) {
                cepError.textContent = "Erro ao buscar CEP.";
                cepError.style.display = "block";
            } else {
                alert("Erro ao buscar CEP.");
            }
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
            btnSubmit.innerHTML = '<span class="ui-spinner"></span> ENVIANDO...';
            btnSubmit.setAttribute("aria-busy", "true");
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

            // Workaround: o backend exige 'numero', mas o usuário quer opcional no form.
            if (!payload.numero || payload.numero.trim() === "") {
                payload.numero = "S/N";
            }

            try {
                const res = await fetch(`/api/filiese`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                const safeEscape = (v) => (window.Utils && window.Utils.escapeHTML) ? window.Utils.escapeHTML(v) : (v || "");

                if(res.ok) {
                    msgContainer.innerHTML = `✅ <strong>Sucesso!</strong> ${safeEscape(data.message)}`;
                    msgContainer.classList.add("status-success");
                    form.reset();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    throw new Error(data.message || "Erro desconhecido.");
                }
            } catch(err) {
                const safeEscape = (v) => (window.Utils && window.Utils.escapeHTML) ? window.Utils.escapeHTML(v) : (v || "");
                msgContainer.innerHTML = `❌ <strong>Erro:</strong> ${safeEscape(err.message)}`;
                msgContainer.classList.add("status-error");
            } finally {
                msgContainer.style.display = "block";
                btnSubmit.disabled = false;
                btnSubmit.innerText = originalText;
                btnSubmit.removeAttribute("aria-busy");
            }
        });
    }
});