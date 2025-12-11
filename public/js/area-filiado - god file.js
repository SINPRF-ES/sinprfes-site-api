// public/js/area-filiado.js

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const userInfoRaw = localStorage.getItem("userInfo"); 
  let perfilAcesso = null;
  
  // 1. Elemento para exibir o alerta de endereço (ID adicionado ao HTML)
  const alertaEnderecoEl = document.getElementById("alerta-endereco-desatualizado");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  try {
    if (userInfoRaw) {
      const parsed = JSON.parse(userInfoRaw);
      perfilAcesso = parsed.perfil_acesso || parsed.perfil || null;
    }
  } catch (e) {
    console.warn("Não foi possível ler userInfo do localStorage:", e);
  }
  // Função para Desativar 2FA
  async function desativar2FA() {
    if (!confirm("Tem certeza que deseja desativar a autenticação em duas etapas (2FA)?")) {
      return;
    }

    const token = localStorage.getItem("token");
    const btn = document.getElementById("btn-desativar-2fa");
    if (btn) btn.disabled = true;

    try {
      const response = await fetch("/api/filiados/2fa/desativar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data.message || "Falha ao desativar o 2FA.");
        return;
      }

      alert(data.message || "Autenticação em duas etapas desativada com sucesso.");
      // Recarrega os dados do filiado, inclusive o flag twofa_ativo
      await carregarMeusDados();
    } catch (error) {
      console.error("Erro ao desativar 2FA:", error);
      alert("Erro de conexão ao tentar desativar o 2FA.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderizarSeguranca(filiado) {
    if (!filiado) return;

    const twofaAtivo = !!filiado.twofa_ativo;

    // Tenta encontrar o container específico para segurança
    let container = document.getElementById("seguranca-container");

    // Fallback: se não existir no HTML, cria dinamicamente
    if (!container) {
      const conteudo = document.getElementById("area-filiado-conteudo");
      if (conteudo && conteudo.parentNode) {
        container = document.createElement("div");
        container.id = "seguranca-container";
        conteudo.parentNode.appendChild(container); // adiciona logo abaixo
      } else {
        return;
      }
    }

    let htmlContent = "";

    if (twofaAtivo) {
      htmlContent = `
        <div class="section-box" style="margin-top: 20px; border-left: 5px solid #27ae60;">
          <h3 class="section-subtitle" style="margin-bottom: 8px; color: #27ae60;">
            ✅ Parabéns! Você está mais seguro.
          </h3>
          <p class="field-hint" style="margin-bottom: 12px;">
            Você já ativou a autenticação em duas etapas (2FA) nesta conta.
            Ao fazer login, será solicitado um código gerado pelo seu aplicativo autenticador
            (como Google Authenticator, Authy, etc.).
          </p>
          <div class="form-actions">
            <button
              id="btn-desativar-2fa"
              class="btn btn-outline btn-sm"
              style="border-color: #27ae60; color: #27ae60;"
            >
              Desativar autenticação em duas etapas (2FA)
            </button>
          </div>
        </div>
      `;
    } else {
      htmlContent = `
        <div class="section-box" style="margin-top: 20px; border-left: 5px solid #ffc107;">
          <h3 class="section-subtitle" style="margin-bottom: 8px;">
            ⚠️ Segurança da conta
          </h3>
          <p class="field-hint" style="margin-bottom: 12px;">
            Para aumentar a segurança da sua área do filiado, você pode ativar a autenticação em duas etapas (2FA)
            com um aplicativo autenticador, como o Google Authenticator.
          </p>
          <div class="form-actions">
            <a href="/config-2fa.html" class="btn btn-primary btn-sm">
              Ativar autenticação em duas etapas (2FA)
            </a>
          </div>
        </div>
      `;
    }

    container.innerHTML = htmlContent;

    if (twofaAtivo) {
      const btnDesativar = document.getElementById("btn-desativar-2fa");
      if (btnDesativar) {
        btnDesativar.addEventListener("click", desativar2FA);
      }
    }
  }

  // -------------------------
  // 1. UTILITÁRIOS E MÁSCARAS (PADRONIZADOS)
  // -------------------------

  // Máscara para Input (Funciona ao digitar)
  function aplicarMascaraTelefone(input) {
    if (!input) return;
    
    function formatar(v) {
      v = v.replace(/\D/g, ""); // Remove tudo que não é dígito
      v = v.substring(0, 11); // Limita a 11 dígitos

      // Formata: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
      if (v.length > 10) {
        return v.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
      } else if (v.length > 5) {
        return v.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
      } else if (v.length > 2) {
        return v.replace(/^(\d\d)(\d{0,5}).*/, "($1) $2");
      } else if (v.length > 0) {
        return v.replace(/^(\d*)/, "($1");
      }
      return v;
    }

    // Aplica na carga inicial (caso venha do banco)
    input.value = formatar(input.value);
    
    // Aplica a cada tecla digitada
    input.addEventListener("input", (e) => {
      e.target.value = formatar(e.target.value);
    });
  }

  // Formatador Visual para Tabelas (Apenas exibe, não edita)
  function formatarTelefoneTexto(v) {
    if (!v) return "-";
    v = String(v).replace(/\D/g, "");
    
    if (v.length === 11) {
       return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    } else if (v.length === 10) {
       return `(${v.slice(0,2)}) ${v.slice(2,6)}-${v.slice(6)}`;
    }
    return v; // Retorna original se não tiver formato conhecido
  }
// Função auxiliar apenas para formatar TEXTO (usada na tabela)
function formatarTelefoneTexto(v) {
    v = String(v || "").replace(/\D/g, "");
    if (!v) return "-";
    if (v.length > 10) {
        return "(" + v.slice(0, 2) + ") " + v.slice(2, 7) + "-" + v.slice(7);
    }
    return "(" + v.slice(0, 2) + ") " + v.slice(2, 6) + "-" + v.slice(6);
}
  // ---- Navegação lateral ----
  const navButtons = document.querySelectorAll(".af-nav-item");
  const sections = document.querySelectorAll(".af-section");

  function ativarSecao(id) {
    sections.forEach((sec) => {
      const ativo = sec.id === id;
      sec.classList.toggle("active", ativo);
      sec.setAttribute("aria-hidden", ativo ? "false" : "true");
    });

    navButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.target === id);
    });
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const alvo = btn.dataset.target;
      if (alvo) {
        ativarSecao(alvo);
        // 🟢 NOVO: Chamar função específica ao ativar a aba Jogos
        if (alvo === 'sec-jogos') {
            carregarJogosIntegracao();
        }
      }
    });
  });

  // ---- Logout ----
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("userInfo");
      window.location.href = "/login.html";
    });
  }

  // ---------------- MEUS DADOS ----------------
  const conteudoMeusDados = document.getElementById("area-filiado-conteudo");
  let dadosMeGlobal = null;
  
  // 🟢 NOVO: Opções de Situação Funcional para o formulário de edição de filiados
  const SITUACAO_OPCOES = ["ATIVO", "VETERANO", "PENSIONISTA"];

  async function carregarMeusDados() {
    if (!conteudoMeusDados) return;

    conteudoMeusDados.innerHTML = "Carregando seus dados...";
    if (alertaEnderecoEl) alertaEnderecoEl.style.display = 'none'; // Esconde o alerta enquanto carrega

    try {
      const resp = await fetch("/api/filiados/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        throw new Error("Falha ao carregar seus dados");
      }

      const dados = await resp.json();
      dadosMeGlobal = dados;

      // Atualiza o perfilAcesso global com base no cadastro
      perfilAcesso = dados.perfil_acesso || "FILIADO";
      
      // LÓGICA DE ALERTA: Verifica se o CEP (coluna nova) está vazio/nulo.
      if (!dados.cep || dados.cep === "" || dados.cep === null) {
          if (alertaEnderecoEl) {
              alertaEnderecoEl.textContent = "Endereço desatualizado, favor atualizar seus dados de endereço.";
              alertaEnderecoEl.style.display = 'block';
              
              if (document.querySelector('#sec-meus-dados.active')) {
                  alertaEnderecoEl.scrollIntoView({ behavior: 'smooth' });
              }
          }
      } else {
          // Se o CEP está preenchido (dados no formato novo), esconde o alerta
          if (alertaEnderecoEl) {
              alertaEnderecoEl.style.display = 'none';
          }
      }
      // FIM NOVA LÓGICA DE ALERTA

      // opcional: guarda também no localStorage
      try {
        localStorage.setItem(
          "userInfo",
          JSON.stringify({ perfil_acesso: perfilAcesso })
        );
      } catch (e) {
        console.warn("Falha ao salvar userInfo no localStorage:", e);
      }

      renderizarMeusDados(dados);
      renderizarSeguranca(dados);        // NOVO: atualiza o bloco de segurança (2FA)
      preencherFormularioRessarcimentoComDados(dados);
      configurarBuscaFiliadosSeAindaNao();
    } catch (err) {
      console.error(err);
      conteudoMeusDados.innerHTML =
        "<p>Não foi possível carregar seus dados. Tente novamente mais tarde.</p>";
    }
  }


  function renderizarMeusDados(dados) {
    const {
      nome,
      cpf,
      situacao,
      perfil_acesso,
      telefone1,
      telefone2,
      email1,
      email2,
      // NOVAS COLUNAS DIRETAMENTE DO BANCO:
      logradouro_bairro,
      numero,
      complemento,
      cidade,
      uf,
      cep,
      lotacao,
    } = dados;

    // opções de lotação
    const LOTACOES = [
      "SEDE",
      "1ª DEL (Viana)",
      "2ª DEL (Serra)",
      "3ª DEL (Guarapari)",
      "4ª DEL (Linhares)",
    ];
    const lotacaoAtual = (lotacao || "SEDE").toUpperCase();
    const opcoesLotacaoHtml = LOTACOES.map((rotulo) => {
      const selected =
        rotulo.toUpperCase() === lotacaoAtual ? "selected" : "";
      return `<option value="${rotulo}" ${selected}>${rotulo}</option>`;
    }).join("");

    conteudoMeusDados.innerHTML = `
      <div class="section-box">
        <h3 class="section-subtitle">Dados básicos</h3>
        <div class="field-row">
          <div class="field-group">
            <label>Nome</label>
            <input type="text" value="${nome || ""}" readonly />
          </div>
          <div class="field-group">
            <label>CPF</label>
            <input type="text" value="${formatarCPF(cpf)}" readonly />
          </div>
        </div>
        <div class="field-row">
          <div class="field-group">
            <label>Situação</label>
            <input type="text" value="${situacao || "Ativo"}" readonly />
          </div>
          <div class="field-group">
            <label>Perfil de acesso</label>
            <input type="text" value="${perfil_acesso || "—"}" readonly />
          </div>
        </div>
      </div>

      <form id="form-meus-dados" class="form-grid" style="margin-top: 16px;">
        <fieldset class="section-box">
          <legend>Contatos e endereço</legend>

          <div class="field-row">
            <div class="field-group">
              <label for="me-telefone1">Telefone 1</label>
              <input
                type="text"
                id="me-telefone1"
                value="${telefone1 || ""}"
                placeholder="Ex.: (27) 99999-9999"
              />
            </div>
            <div class="field-group">
              <label for="me-telefone2">Telefone 2</label>
              <input
                type="text"
                id="me-telefone2"
                value="${telefone2 || ""}"
                placeholder="Opcional"
              />
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label for="me-email1">E-mail principal</label>
              <input
                type="email"
                id="me-email1"
                value="${email1 || ""}"
                placeholder="Ex.: seuemail@dominio.com"
              />
            </div>
            <div class="field-group">
              <label for="me-email2">E-mail alternativo</label>
              <input
                type="email"
                id="me-email2"
                value="${email2 || ""}"
                placeholder="Opcional"
              />
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label for="me-cep">CEP</label>
              <div style="display:flex; gap:8px;">
                <input
                  type="text"
                  id="me-cep"
                  placeholder="Ex.: 29000000"
                  value="${cep || ""}"
                  style="flex:1;"
                />
                <button type="button" id="btn-buscar-cep" class="btn btn-outline" style="white-space:nowrap;">
                  Buscar CEP
                </button>
              </div>
              <p class="field-hint">
                Digite o CEP (apenas números) e clique em "Buscar CEP" para preencher logradouro, cidade e UF.
              </p>
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label for="me-lotacao">Lotação</label>
              <select id="me-lotacao">
                ${opcoesLotacaoHtml}
              </select>
              <p class="field-hint">
                Você pode atualizar sua lotação atual.
              </p>
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label for="me-endereco">Logradouro / Bairro</label>
              <input
                type="text"
                id="me-endereco"
                placeholder="Será preenchido pelo CEP"
                value="${logradouro_bairro || ""}"
                readonly
              />
            </div>
          </div>

          <div class="field-row" style="grid-template-columns: 1fr 2fr 1fr;">
            <div class="field-group">
              <label for="me-numero">Número</label>
              <input
                type="text"
                id="me-numero"
                placeholder="Nº"
                value="${numero || ""}"
              />
            </div>
            <div class="field-group">
              <label for="me-complemento">Complemento</label>
              <input
                type="text"
                id="me-complemento"
                placeholder="Apto, bloco, sala, ponto de referência..."
                value="${complemento || ""}"
              />
            </div>
            <div class="field-group">
              <label for="me-uf">UF</label>
              <input
                type="text"
                id="me-uf"
                maxlength="2"
                placeholder="UF"
                value="${uf || ""}"
                readonly
              />
            </div>
          </div>
          <div class="field-row">
            <div class="field-group">
              <label for="me-cidade">Cidade</label>
              <input
                type="text"
                id="me-cidade"
                placeholder="Será preenchido pelo CEP"
                value="${cidade || ""}"
                readonly
              />
            </div>
          </div>
        </fieldset>

        <div class="form-actions" style="margin-top: 16px;">
          <button type="submit" class="btn btn-primary">Salvar meus dados</button>
          <span id="meus-dados-status" class="field-hint" style="margin-left: 12px;"></span>
        </div>
      </form>
      
      `;

    const form = document.getElementById("form-meus-dados");
    const statusEl = document.getElementById("meus-dados-status");
    if (!form) return;

    const cepInput = form.querySelector("#me-cep");
    const endInput = form.querySelector("#me-endereco");
    const numInput = form.querySelector("#me-numero");
    const compInput = form.querySelector("#me-complemento");
    const cidadeInput = form.querySelector("#me-cidade");
    const ufInput = form.querySelector("#me-uf");
    const btnCep = form.querySelector("#btn-buscar-cep");

    // aplica máscara nos telefones do "Meus dados"
    aplicarMascaraTelefone(document.getElementById("me-telefone1"));
    aplicarMascaraTelefone(document.getElementById("me-telefone2"));

    // CEP: apenas números, máximo 8 dígitos
    if (cepInput) {
      cepInput.addEventListener("input", () => {
        cepInput.value = cepInput.value.replace(/\D/g, "").slice(0, 8);
      });
    }

    async function consultarCep() {
      const cepLimpo = (cepInput.value || "").replace(/\D/g, "");
      if (cepLimpo.length !== 8) {
        statusEl.textContent = "CEP inválido. Use 8 dígitos (Ex.: 29000000).";
        return;
      }

      try {
        statusEl.textContent = "Consultando CEP...";
        const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        if (!resp.ok) throw new Error("Erro ao consultar ViaCEP");
        const data = await resp.json();
        if (data.erro) {
          statusEl.textContent = "CEP não encontrado.";
          return;
        }

        const logradouroBairro = [data.logradouro, data.bairro]
          .filter(Boolean)
          .join(", ");

        if (logradouroBairro) {
          endInput.value = logradouroBairro;
        }
        if (data.localidade) {
          cidadeInput.value = data.localidade;
        }
        if (data.uf) {
          ufInput.value = data.uf;
        }
        
        statusEl.textContent = "CEP carregado com sucesso.";
      } catch (err) {
        console.error("Erro ao consultar CEP:", err);
        statusEl.textContent = "Erro ao consultar CEP. Tente novamente.";
      }
    }

    if (btnCep) {
      btnCep.addEventListener("click", (e) => {
        e.preventDefault();
        consultarCep();
      });
    }
    if (cepInput) {
      cepInput.addEventListener("blur", () => {
        if (cepInput.value.trim()) consultarCep();
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      statusEl.textContent = "Atualizando...";

      const payload = {
        telefone1:
          document.getElementById("me-telefone1").value.replace(/\D/g, ""),
        telefone2:
          document.getElementById("me-telefone2").value.replace(/\D/g, ""),
        email1: document.getElementById("me-email1").value || "",
        email2: document.getElementById("me-email2").value || "",
        
        // ENVIANDO NOVAS COLUNAS INDIVIDUALMENTE PARA O BACKEND:
        logradouro_bairro: endInput.value || "",
        numero: numInput.value || "",
        complemento: compInput.value || "",
        cidade: cidadeInput.value || "",
        uf: ufInput.value || "",
        cep: cepInput.value.replace(/\D/g, "") || "",
        // FIM NOVAS COLUNAS
        lotacao: document.getElementById("me-lotacao").value || "SEDE",
      };

      try {
        const resp = await fetch("/api/filiados/me", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) throw new Error("Falha ao salvar");

        // 🟢 Correção para recarregar dados novos
        await carregarMeusDados(); 
        
        statusEl.textContent = "Dados atualizados com sucesso.";
        setTimeout(() => (statusEl.textContent = ""), 4000);
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Erro ao salvar dados.";
      }
    });
  }


  function formatarCPF(cpf) {
    if (!cpf) return "";
    const only = String(cpf).replace(/\D/g, "");
    if (only.length !== 11) return cpf;
    return only.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  // ---------------- FILIADOS (lista + busca) ----------------
  let listaFiliadosCarregada = false;
  let dadosFiliadosCache = [];

  function normalizarTextoBusca(valor) {
    if (!valor) return "";
    return String(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[^\w]/g, "")
      .toLowerCase();
  }

    async function configurarBuscaFiliadosSeAindaNao() {
    if (listaFiliadosCarregada) return;

    const inputBusca = document.getElementById("busca-filiados");
    const listaEl = document.getElementById("lista-filiados");
    const tutorialDiretoria = document.getElementById("tutorial-diretoria");
    const btnNovo = document.getElementById("btn-novo-filiado");
    const novoContainer = document.getElementById("novo-filiado-container");

    if (!listaEl || !inputBusca) return;

    // Configura visibilidade do botão "Novo filiado"
    if (btnNovo) {
      if (
        perfilAcesso === "ADMIN" ||
        perfilAcesso === "DIRETORIA" ||
        perfilAcesso === "FUNCIONARIO"
      ) {
        btnNovo.addEventListener("click", () => {
          abrirFormularioNovoFiliado(novoContainer);
        });
      } else {
        // Filiado comum não vê o botão
        btnNovo.style.display = "none";
      }
    }

    try {
      listaEl.textContent = "Carregando lista de filiados...";

      const resp = await fetch("/api/filiados", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error("Falha ao carregar lista de filiados");

      const payload = await resp.json();
      const lista = Array.isArray(payload) ? payload : payload.filiados || [];

      dadosFiliadosCache = lista;
      listaFiliadosCarregada = true;

      if (
        perfilAcesso === "DIRETORIA" ||
        perfilAcesso === "FUNCIONARIO" ||
        perfilAcesso === "ADMIN"
      ) {
        if (tutorialDiretoria) tutorialDiretoria.hidden = false;
      }

      atualizarListaFiliados("");
      inputBusca.addEventListener("input", (e) => {
        atualizarListaFiliados(e.target.value);
      });
    } catch (err) {
      console.error(err);
      listaEl.textContent = "Erro ao carregar filiados.";
    }
  }
    function abrirFormularioNovoFiliado(container) {
    if (!container) return;

    if (
      !["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfilAcesso || "")
    ) {
      alert("Você não tem permissão para cadastrar filiados.");
      return;
    }

    // Toggle: se já estiver aberto, fecha
    if (container.dataset.aberto === "1") {
      container.innerHTML = "";
      container.dataset.aberto = "0";
      return;
    }

    container.dataset.aberto = "1";

    // 🟢 Situação Funcional: Opções para o formulário de CRIAÇÃO
    const opcoesSituacaoHtml = SITUACAO_OPCOES.map(op => `<option value="${op}">${op}</option>`).join('');

    container.innerHTML = `
      <div class="section-box af-filiado-card">
        <h3 class="section-subtitle">Cadastrar novo filiado</h3>
        <form class="af-form-novo-filiado">
          <div class="field-row">
            <div class="field-group">
              <label>Nome *</label>
              <input type="text" name="nome" required />
            </div>
            <div class="field-group">
              <label>CPF *</label>
              <input type="text" name="cpf" required placeholder="Somente números" />
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label>E-mail principal *</label>
              <input type="email" name="email1" required />
            </div>
            <div class="field-group">
              <label>E-mail alternativo</label>
              <input type="email" name="email2" />
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label>Telefone 1</label>
              <input type="text" name="telefone1" />
            </div>
            <div class="field-group">
              <label>Telefone 2</label>
              <input type="text" name="telefone2" />
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label>Lotação</label>
              <select name="lotacao">
                <option value="SEDE">SEDE</option>
                <option value="1ª DEL (Viana)">1ª DEL (Viana)</option>
                <option value="2ª DEL (Serra)">2ª DEL (Serra)</option>
                <option value="3ª DEL (Guarapari)">3ª DEL (Guarapari)</option>
                <option value="4ª DEL (Linhares)">4ª DEL (Linhares)</option>
              </select>
            </div>
            
            <div class="field-group">
              <label>Situação</label>
              <select name="situacao">
                ${opcoesSituacaoHtml}
              </select>
            </div>
          </div>

          <div class="field-row">
            ${
              // Só ADMIN escolhe perfil; os outros criam sempre FILIADO
              perfilAcesso === "ADMIN"
                ? `
            <div class="field-group">
              <label>Perfil de acesso</label>
              <select name="perfil_acesso">
                <option value="FILIADO">FILIADO</option>
                <option value="ORGANIZADOR">ORGANIZADOR (Jogos)</option>
                <option value="FUNCIONARIO">FUNCIONÁRIO</option>
                <option value="DIRETORIA">DIRETORIA</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            `
                : `
            <div class="field-group">
              <label>Perfil de acesso</label>
              <input type="text" value="FILIADO" readonly />
            </div>
            `
            }
          </div>

          <div class="form-actions" style="margin-top: 10px;">
            <button type="submit" class="btn btn-primary">Salvar</button>
            <button type="button" class="btn btn-outline" id="btn-cancelar-novo">
              Cancelar
            </button>
            <span class="field-hint af-status-novo"></span>
          </div>
        </form>
      </div>
    `;

    const form = container.querySelector(".af-form-novo-filiado");
    const statusSpan = container.querySelector(".af-status-novo");
    const btnCancelar = container.querySelector("#btn-cancelar-novo");

    // máscaras
    const cpfInput = form.querySelector('input[name="cpf"]');
    if (cpfInput) {
      cpfInput.addEventListener("input", () => {
        cpfInput.value = cpfInput.value.replace(/\D/g, "").slice(0, 11);
      });
    }
    aplicarMascaraTelefone(form.querySelector('input[name="telefone1"]'));
    aplicarMascaraTelefone(form.querySelector('input[name="telefone2"]'));

    btnCancelar.addEventListener("click", () => {
      container.innerHTML = "";
      container.dataset.aberto = "0";
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!statusSpan) return;
      statusSpan.textContent = "Salvando...";

      const fd = new FormData(form);
      const payload = {};
      fd.forEach((v, k) => {
        payload[k] = v;
      });

      if (perfilAcesso !== "ADMIN") {
        delete payload.perfil_acesso;
      }

      try {
        const resp = await fetch("/api/filiados", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const msg = data.message || "Erro ao criar filiado.";
          throw new Error(msg);
        }

        statusSpan.textContent = "Filiado criado com sucesso.";

        // adiciona na lista em memória e redesenha
        if (data && data.filiado) {
          dadosFiliadosCache.push(data.filiado);
        }
        const termoAtual =
          document.getElementById("busca-filiados")?.value || "";
        atualizarListaFiliados(termoAtual);

        setTimeout(() => {
          container.innerHTML = "";
          container.dataset.aberto = "0";
        }, 1200);
      } catch (err) {
        console.error(err);
        statusSpan.textContent = err.message || "Erro ao criar filiado.";
      }
    });
  }

    function atualizarListaFiliados(termo) {
    const listaEl = document.getElementById("lista-filiados");
    if (!listaEl) return;

    const filtro = normalizarTextoBusca(termo);
    let filtrados = dadosFiliadosCache;

    if (filtro) {
      filtrados = dadosFiliadosCache.filter((f) => {
        const nomeNorm = normalizarTextoBusca(f.nome);
        const cpfNorm = normalizarTextoBusca(f.cpf);
        return nomeNorm.includes(filtro) || cpfNorm.includes(filtro);
      });
    }

    if (!filtrados.length) {
      listaEl.innerHTML =
        "<p>Nenhum filiado encontrado para o filtro informado.</p>";
      return;
    }

    const podeEditarTodos =
      perfilAcesso === "DIRETORIA" ||
      perfilAcesso === "FUNCIONARIO" ||
      perfilAcesso === "ADMIN";

    const html = filtrados
      .map((f) => {
        // 🟢 Situação funcional do filiado sendo editado (Upper Case para segurança)
        const situacaoFiliado = (f.situacao || "ATIVO").toUpperCase();
        const opcoesSituacaoEditavel = SITUACAO_OPCOES.map(op => `
          <option value="${op}" ${situacaoFiliado === op ? 'selected' : ''}>${op}</option>
        `).join('');


        const camposBasicos = `
          <div class="af-filiado-linha">
            <div class="af-filiado-info">
              <strong>${f.nome || ""}</strong><br />
              <span class="field-hint">CPF: ${formatarCPF(f.cpf)}</span><br />
              <span class="field-hint">Situação: ${situacaoFiliado}</span><br />
              ${
                f.lotacao
                  ? `<span class="field-hint">Lotação: ${f.lotacao}</span>`
                  : ""
              }
            </div>
            <div class="af-filiado-contatos">
              <span>${f.telefone1 || ""}</span><br />
              <span>${f.telefone2 || ""}</span>
            </div>
          </div>
        `;

        if (!podeEditarTodos) {
          // Filiado comum: só vê nome + telefones + lotação
          return `<div class="section-box af-filiado-card">${camposBasicos}</div>`;
        }

        // Diretoria/funcionário/admin: pode editar tudo
        const classeSomenteAdmin =
          perfilAcesso === "ADMIN" ? "" : "af-only-admin";

        return `
          <div class="section-box af-filiado-card">
            ${camposBasicos}
            <details class="af-filiado-details">
              <summary>Ver / editar dados completos</summary>
              <form class="af-form-filiado" data-id="${f.id}">
                <div class="field-row">
                  <div class="field-group">
                    <label>Nome</label>
                    <input type="text" name="nome" value="${f.nome || ""}" />
                  </div>
                  <div class="field-group ${classeSomenteAdmin}">
                    <label>CPF</label>
                    <input type="text" name="cpf" value="${formatarCPF(
                      f.cpf
                    )}" />
                  </div>
                </div>

                <div class="field-row">
                  <div class="field-group">
                    <label>Telefone 1</label>
                    <input type="text" name="telefone1" value="${
                      f.telefone1 || ""
                    }" />
                  </div>
                  <div class="field-group">
                    <label>Telefone 2</label>
                    <input type="text" name="telefone2" value="${
                      f.telefone2 || ""
                    }" />
                  </div>
                </div>

                <div class="field-row">
                  <div class="field-group">
                    <label>E-mail 1</label>
                    <input type="email" name="email1" value="${
                      f.email1 || ""
                    }" />
                  </div>
                  <div class="field-group">
                    <label>E-mail 2</label>
                    <input type="email" name="email2" value="${
                      f.email2 || ""
                    }" />
                  </div>
                </div>

                <div class="field-row">
                  <div class="field-group">
                    <label>Lotação</label>
                    <select name="lotacao">
                      <option value="SEDE" ${
                        f.lotacao === "SEDE" ? "selected" : ""
                      }>SEDE</option>
                      <option value="1ª DEL (Viana)" ${
                        f.lotacao === "1ª DEL (Viana)" ? "selected" : ""
                      }>1ª DEL (Viana)</option>
                      <option value="2ª DEL (Serra)" ${
                        f.lotacao === "2ª DEL (Serra)" ? "selected" : ""
                      }>2ª DEL (Serra)</option>
                      <option value="3ª DEL (Guarapari)" ${
                        f.lotacao === "3ª DEL (Guarapari)" ? "selected" : ""
                      }>3ª DEL (Guarapari)</option>
                      <option value="4ª DEL (Linhares)" ${
                        f.lotacao === "4ª DEL (Linhares)" ? "selected" : ""
                      }>4ª DEL (Linhares)</option>
                    </select>
                  </div>
                  
                  <div class="field-group">
                    <label>Situação Funcional</label>
                    <select name="situacao">
                      ${opcoesSituacaoEditavel}
                    </select>
                  </div>
                  </div>


                <div class="field-row">
                  <div class="field-group ${classeSomenteAdmin}">
                    <label>Perfil de acesso</label>
                    <select name="perfil_acesso">
                      <option value="FILIADO" ${
                        f.perfil_acesso === "FILIADO" ? "selected" : ""
                      }>FILIADO</option>
                      <option value="ORGANIZADOR" ${
                        f.perfil_acesso === "ORGANIZADOR" ? "selected" : ""
                      }>ORGANIZADOR (Jogos)</option>
                      <option value="FUNCIONARIO" ${
                        f.perfil_acesso === "FUNCIONARIO" ? "selected" : ""
                      }>FUNCIONARIO</option>
                      <option value="DIRETORIA" ${
                        f.perfil_acesso === "DIRETORIA" ? "selected" : ""
                      }>DIRETORIA</option>
                      <option value="ADMIN" ${
                        f.perfil_acesso === "ADMIN" ? "selected" : ""
                      }>ADMIN</option>
                    </select>
                    <p class="field-hint">
                      Campos destacados só podem ser alterados por ADMIN.
                    </p>
                  </div>
                </div>
                
                <div class="field-row">
                    <div class="field-group">
                      <label>Logradouro / Bairro</label>
                      <input type="text" name="logradouro_bairro" value="${f.logradouro_bairro || ''}" />
                    </div>
                </div>

                <div class="field-row" style="grid-template-columns: 1fr 2fr 1fr 1fr 1fr;">
                  <div class="field-group">
                    <label>Número</label>
                    <input type="text" name="numero" value="${f.numero || ''}" />
                  </div>
                  <div class="field-group">
                    <label>Complemento</label>
                    <input type="text" name="complemento" value="${f.complemento || ''}" />
                  </div>
                  <div class="field-group">
                    <label>CEP</label>
                    <input type="text" name="cep" value="${f.cep || ''}" maxlength="8" />
                  </div>
                  <div class="field-group">
                    <label>UF</label>
                    <input type="text" name="uf" value="${f.uf || ''}" maxlength="2" />
                  </div>
                  <div class="field-group">
                    <label>Cidade</label>
                    <input type="text" name="cidade" value="${f.cidade || ''}" />
                  </div>
                </div>


                <div class="form-actions" style="margin-top: 10px;">
                  <button type="submit" class="btn btn-primary">Salvar alterações</button>
                  <span class="field-hint af-status"></span>
                </div>
              </form>
            </details>
          </div>
        `;
      })
      .join("");

    listaEl.innerHTML = html;

    // Máscara de telefone nos formulários de edição
    const telInputs = listaEl.querySelectorAll(
      'input[name="telefone1"], input[name="telefone2"]'
    );
    telInputs.forEach((input) => aplicarMascaraTelefone(input));

    if (podeEditarTodos) {
      const forms = listaEl.querySelectorAll(".af-form-filiado");
      forms.forEach((form) => {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const id = form.dataset.id;
          const statusSpan = form.querySelector(".af-status");
          if (!id) return;

          const formData = new FormData(form);
          const payload = {};
          formData.forEach((value, key) => {
            // Limpa telefones e CEP
            if (key === "telefone1" || key === "telefone2" || key === 'cep') {
               payload[key] = String(value).replace(/\D/g, "");
            } else {
              payload[key] = value;
            }
          });

          // O campo 'situacao' já está no payload do form.
          
          if (perfilAcesso !== "ADMIN") {
            delete payload.cpf;
            delete payload.perfil_acesso;
          }

          statusSpan.textContent = "Salvando...";

          try {
            const resp = await fetch(`/api/filiados/${id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            });

            if (!resp.ok) throw new Error("Erro ao atualizar filiado");

            // Recarrega a lista para ver a mudança
            carregarMeusDados(); 
            
            statusSpan.textContent = "Alterações salvas.";
            setTimeout(() => (statusSpan.textContent = ""), 3000);
          } catch (err) {
            console.error(err);
            statusSpan.textContent = "Erro ao salvar.";
          }
        });
      });
    }
  }

  // ---------------- RESSARCIMENTO (formulário) ----------------
  // ... (código de ressarcimento)

  function preencherFormularioRessarcimentoComDados(dados) {
    const nomeEl = document.getElementById("res-nome");
    const cpfEl = document.getElementById("res-cpf");
    const emailEl = document.getElementById("res-email");
    const telEl = document.getElementById("res-telefone");

    if (!dados) return;

    if (nomeEl) nomeEl.value = dados.nome || "";
    if (cpfEl) cpfEl.value = formatarCPF(dados.cpf);
    if (emailEl) emailEl.value = dados.email1 || dados.email2 || "";
    if (telEl) {
      telEl.value = dados.telefone1 || dados.telefone2 || "";
      aplicarMascaraTelefone(telEl);
    }
  }

  function calcularDiarias(dataInicioStr, dataFimStr) {
    if (!dataInicioStr || !dataFimStr) return 0;

    const di = new Date(dataInicioStr + "T00:00:00");
    const df = new Date(dataFimStr + "T00:00:00");

    if (isNaN(di.getTime()) || isNaN(df.getTime())) return 0;
    if (df < di) return 0;

    const diffMs = df.getTime() - di.getTime();
    const diasCorridos = diffMs / (1000 * 60 * 60 * 24) + 1;

    const diarias = Math.max(0, diasCorridos - 1 + 0.7);
    return diarias;
  }

  function atualizarCalculosRessarcimento() {
    const dataInicio = document.getElementById("res-data-inicio")?.value;
    const dataFim = document.getElementById("res-data-fim")?.value;
    const kmStr = document.getElementById("res-km")?.value || "0";
    const outrosStr = document.getElementById("res-valor-outros")?.value || "0";

    const diarias = calcularDiarias(dataInicio, dataFim);
    const valorDiarias = diarias * 500; // R$ 500 por diária

    const km = parseFloat(kmStr.replace(",", ".")) || 0;
    const valorKm = km * 1.5; // R$ 1,50 por km

    const valorOutros = parseFloat(outrosStr.replace(",", ".")) || 0;

    const total = valorDiarias + valorKm + valorOutros;

    const diariasEl = document.getElementById("res-diarias");
    const valDiariasEl = document.getElementById("res-valor-diarias");
    const valKmEl = document.getElementById("res-valor-km");
    const valTotalEl = document.getElementById("res-valor-total");

    if (diariasEl) diariasEl.value = diarias ? diarias.toFixed(1) : "";
    if (valDiariasEl)
      valDiariasEl.value = diarias ? valorDiarias.toFixed(2) : "";
    if (valKmEl) valKmEl.value = km ? valorKm.toFixed(2) : "";
    if (valTotalEl) valTotalEl.value = total ? total.toFixed(2) : "";
  }

  (function configurarRessarcimento() {
    const formRessarcimento = document.getElementById("form-ressarcimento");
    const resStatusEl = document.getElementById("res-status");

    if (!formRessarcimento) return;

    // aplica máscara no telefone de contato do ressarcimento
    const telContato = document.getElementById("res-telefone");
    aplicarMascaraTelefone(telContato);

    const inputsCalculo = [
      "res-data-inicio",
      "res-data-fim",
      "res-km",
      "res-valor-outros",
    ];

    inputsCalculo.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", atualizarCalculosRessarcimento);
        el.addEventListener("input", atualizarCalculosRessarcimento);
      }
    });

    formRessarcimento.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (resStatusEl) resStatusEl.textContent = "Enviando solicitação...";

      const token = localStorage.getItem("token");

      const fd = new FormData();

      // Dados do filiado
      fd.append("nome", document.getElementById("res-nome")?.value || "");
      fd.append("cpf", document.getElementById("res-cpf")?.value || "");
      fd.append(
        "email_destino",
        document.getElementById("res-email")?.value || ""
      );
      fd.append(
        "telefone_contato",
        (document.getElementById("res-telefone")?.value || "").replace(
          /\D/g,
          ""
        )
      );

      // Atividade
      fd.append(
        "data_inicio",
        document.getElementById("res-data-inicio")?.value || ""
      );
      fd.append(
        "data_fim",
        document.getElementById("res-data-fim")?.value || ""
      );
      fd.append("local", document.getElementById("res-local")?.value || "");
      fd.append(
        "descricao",
        document.getElementById("res-descricao")?.value || ""
      );

      // Cálculos
      fd.append(
        "diarias",
        document.getElementById("res-diarias")?.value || ""
      );
      fd.append(
        "valor_diarias",
        document.getElementById("res-valor-diarias")?.value || ""
      );
      fd.append(
        "km_total",
        document.getElementById("res-km")?.value || ""
      );
      fd.append(
        "valor_km",
        document.getElementById("res-valor-km")?.value || ""
      );
      fd.append(
        "valor_outros",
        document.getElementById("res-valor-outros")?.value || ""
      );
      fd.append(
        "descricao_outros",
        document.getElementById("res-descricao-outros")?.value || ""
      );
      fd.append(
        "valor_total",
        document.getElementById("res-valor-total")?.value || ""
      );

      // Dados bancários
      fd.append("banco", document.getElementById("res-banco")?.value || "");
      fd.append("agencia", document.getElementById("res-agencia")?.value || "");
      fd.append("conta", document.getElementById("res-conta")?.value || "");
      fd.append("pix", document.getElementById("res-pix")?.value || "");

      // Anexos
      const anexosInput = document.getElementById("res-anexos");
      if (anexosInput && anexosInput.files) {
        Array.from(anexosInput.files).forEach((file) => {
          fd.append("anexos", file);
        });
      }

      try {
        const resp = await fetch("/api/ressarcimentos", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
        });

        if (!resp.ok) {
          throw new Error("Falha ao enviar solicitação");
        }

        const data = await resp.json().catch(() => ({}));
        if (resStatusEl) {
          resStatusEl.textContent =
            data.message ||
            "Solicitação registrada. Você receberá o PDF por e-mail quando for processada.";
        }

        formRessarcimento.reset();
        if (dadosMeGlobal) {
          preencherFormularioRessarcimentoComDados(dadosMeGlobal);
        }
        atualizarCalculosRessarcimento();

        setTimeout(() => {
          if (resStatusEl) resStatusEl.textContent = "";
        }, 6000);
      } catch (err) {
        console.error(err);
        if (resStatusEl) {
          resStatusEl.textContent =
            "Erro ao enviar solicitação. Tente novamente mais tarde.";
        }
      }
    });
  })();

  // ---------------- JOGOS DE INTEGRAÇÃO (Pré-inscrição e Gestão) ----------------

  function carregarJogosIntegracao() {
    const secJogos = document.getElementById("sec-jogos");
    if (!secJogos) return;
    
    const mainContent = secJogos.querySelector('.section-card');
    mainContent.innerHTML = ""; // Limpa conteúdo anterior

    // 1. Container do Formulário (Visível para todos)
    const containerForm = document.createElement("div");
    mainContent.appendChild(containerForm);
    renderizarFormularioInscricaoJogos(containerForm);

    // 2. Lista de Inscritos (Apenas para Gestores)
    // Verifica se o perfil atual está na lista de permitidos
    const PERFIS_GERENCIA_JOGOS = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "ORGANIZADOR"];
    
    if (PERFIS_GERENCIA_JOGOS.includes(perfilAcesso)) {
        const hr = document.createElement("hr");
        hr.style.cssText = "margin: 40px 0 20px 0; border: 0; border-top: 2px solid #dde3ea";
        mainContent.appendChild(hr);

        const headerAdmin = document.createElement("div");
        headerAdmin.innerHTML = `<h3 class="section-subtitle" style="color: #2980b9;">📋 Área de Gestão (Lista de Inscritos)</h3>`;
        mainContent.appendChild(headerAdmin);

        const containerLista = document.createElement("div");
        mainContent.appendChild(containerLista);
        
        renderizarListaInscritosJogos(containerLista);
    }
  }

  function renderizarFormularioInscricaoJogos(mainContent) {
    // Injeta CSS específico para esta tela (Grade, Botões, Tabela Larga)
    const styleId = 'estilo-jogos-custom';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .jogos-container { max-width: 1000px; margin: 0 auto; width: 100%; }
            .destaque-adesao {
                background-color: #f0f7ff; border: 1px solid #cce5ff; padding: 20px;
                border-radius: 8px; display: flex; align-items: center; gap: 12px;
                margin-bottom: 30px; cursor: pointer; transition: background 0.2s;
            }
            .destaque-adesao:hover { background-color: #e6f2ff; }
            .destaque-adesao input[type="checkbox"] { transform: scale(1.5); margin: 0; cursor: pointer; }
            .destaque-adesao span { font-size: 1.1rem; font-weight: 600; color: #0056b3; }
            
            .categoria-card {
                background: #fff; border: 1px solid #e0e0e0; border-radius: 10px;
                padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.03);
            }
            .categoria-titulo {
                font-size: 1.1rem; color: #2c3e50; border-bottom: 2px solid #f0f0f0;
                padding-bottom: 10px; margin-bottom: 15px; font-weight: bold;
            }
            
            .opcoes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
            .opcao-item {
                display: flex; align-items: center; gap: 8px; font-size: 0.95rem;
                color: #555; cursor: pointer; padding: 5px; border-radius: 4px;
            }
            .opcao-item:hover { background-color: #f9f9f9; color: #000; }
            
            .obs-area textarea { width: 100%; border: 1px solid #ccc; border-radius: 6px; padding: 10px; font-family: inherit; }
            
            .btn-danger { background-color: transparent; border: 1px solid #c0392b; color: #c0392b; margin-left: 10px; transition: 0.2s; }
            .btn-danger:hover { background-color: #c0392b; color: #fff; }
            
            .dados-pessoais-jogos { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            @media (max-width: 600px) { .dados-pessoais-jogos { grid-template-columns: 1fr; } }
        `;
        document.head.appendChild(style);
    }

    mainContent.innerHTML = `
        <div class="jogos-container">
            <header class="section-header" style="text-align: center; margin-bottom: 30px;">
                <h2 class="section-title" style="font-size: 2rem; color: #e67e22; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">
                    <span class="emoji">🏅</span> Jogos de Integração PRF 2026
                </h2>
                <p class="section-subtitle" style="font-size: 1.1rem; color: #7f8c8d;">
                    📍 <strong>Poços de Caldas - MG</strong> (12 a 17/04/2026)
                </p>
            </header>

            <form id="form-inscricao-jogos">
                
                <label class="destaque-adesao">
                    <input type="checkbox" id="interesse" />
                    <span>Desejo integrar a delegação do SINPRF-ES nos jogos</span>
                </label>

                <div class="categoria-card">
                    <div class="categoria-titulo">👤 Dados do Participante</div>
                    <div class="dados-pessoais-jogos">
                        <div class="field-group">
                            <label style="font-weight:bold;">Sexo (Para categorias esportivas)</label>
                            <select id="sexo" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
                                <option value="">Selecione...</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Feminino">Feminino</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="categoria-card">
                    <div class="categoria-titulo">🏃 1. Atletismo</div>
                    <div class="opcoes-grid">
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Atletismo 100m"> 100m</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Atletismo 400m"> 400m</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Atletismo 1500m"> 1500m</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Atletismo 5000m"> 5000m</label>
                    </div>
                </div>

                <div class="categoria-card">
                    <div class="categoria-titulo">🏊 10. Natação</div>
                    <div class="opcoes-grid">
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Natação 50m Livre"> 50m Livre</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Natação 50m Costas"> 50m Costas</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Natação 50m Peito"> 50m Peito</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Natação 50m Borboleta"> 50m Borboleta</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Natação Rev. 4x50m Livre"> Rev. 4x50m Livre</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Natação Rev. 2x50m Misto"> Rev. 2x50m Misto</label>
                    </div>
                </div>

                <div class="categoria-card">
                    <div class="categoria-titulo">⚽ Esportes Coletivos e Quadra</div>
                    <div class="opcoes-grid">
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Futebol Society (Livre)"> Fut. Society (Livre)</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Futebol Society Master (55+)"> Fut. Society Master (55+)</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Futsal (Livre)"> Futsal (Livre)</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Voleibol (Livre)"> Voleibol (Livre)</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Voleibol de Praia"> Vôlei de Praia</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Futevôlei"> Futevôlei</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Beach Tennis"> Beach Tennis</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Tênis de Quadra"> Tênis de Quadra</label>
                    </div>
                </div>

                <div class="categoria-card">
                    <div class="categoria-titulo">🎱 Jogos de Salão e Outros</div>
                    <div class="opcoes-grid">
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Tiro (NRA/IPSC)"> Tiro (NRA/IPSC)</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Jiu-Jitsu"> Jiu-Jitsu</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Tênis de Mesa"> Tênis de Mesa</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Sinuca"> Sinuca</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Xadrez"> Xadrez</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Truco"> Truco</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Canastra"> Canastra</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Dominó"> Dominó</label>
                    </div>
                </div>

                <div class="categoria-card" style="background-color: #f9f9f9;">
                    <div class="categoria-titulo" style="color: #666;">🏳️ Exibição (Sem pontuação)</div>
                    <div class="opcoes-grid">
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Exibição: Peteca"> Peteca</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Exibição: Damas"> Damas</label>
                        <label class="opcao-item"><input type="checkbox" name="modalidades" value="Exibição: Bocha"> Bocha</label>
                    </div>
                </div>

                <div class="categoria-card obs-area">
                    <div class="categoria-titulo">👨‍👩‍👧‍👦 Familiares</div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="font-weight: bold; display: block; margin-bottom: 5px;">Quantidade de familiares que irão com você:</label>
                        <select id="qtd_familiares" style="width: 100px; padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                            <option value="7">7</option>
                            <option value="8">8</option>
                            <option value="9">9</option>
                        </select>
                    </div>

                    <p class="field-hint" style="margin-bottom: 10px;">
                        Se levar familiares, informe os <strong>nomes completos</strong> abaixo (um por linha) para controle de acesso.
                    </p>
                    <textarea id="familiares" rows="3" placeholder="Ex:\nMaria da Silva (Esposa)\nJoãozinho (Filho)"></textarea>
                </div>

                <div class="categoria-card obs-area">
                    <div class="categoria-titulo">📝 Observações Adicionais</div>
                    <textarea id="obs" rows="2" placeholder="Restrições alimentares, tamanho de camisa, etc..."></textarea>
                </div>

                <div class="form-actions" style="margin-top: 30px; text-align: center;">
                    <button class="btn btn-primary btn-lg" type="submit" style="padding: 12px 30px; font-size: 1.1rem;">
                        ✅ Confirmar / Atualizar Inscrição
                    </button>
                    
                    <button type="button" id="btn-cancelar-inscricao" class="btn btn-danger btn-lg" style="padding: 12px 20px; font-size: 1rem;">
                        ❌ Cancelar Inscrição
                    </button>

                    <div id="jogos-status" class="field-hint" style="margin-top: 15px; font-weight: bold;"></div>
                </div>
            </form>
        </div>
    `;

    const form = document.getElementById("form-inscricao-jogos");
    const statusEl = document.getElementById("jogos-status");
    const btnCancelar = document.getElementById("btn-cancelar-inscricao");

    // Lógica do botão CANCELAR
    if (btnCancelar) {
        btnCancelar.addEventListener("click", async () => {
            if (!confirm("Tem certeza que deseja CANCELAR sua inscrição nos Jogos?")) return;
            
            const token = localStorage.getItem("token");
            statusEl.textContent = "Cancelando...";
            statusEl.style.color = "orange";
            
            try {
                const resp = await fetch("/api/jogos/inscricao", {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (resp.ok) {
                    statusEl.textContent = "Inscrição cancelada com sucesso.";
                    statusEl.style.color = "red";
                    form.reset();
                    document.getElementById("sexo").value = "";
                    document.getElementById("qtd_familiares").value = "0";
                } else {
                    const data = await resp.json();
                    statusEl.textContent = data.error || "Erro ao cancelar.";
                }
            } catch (e) {
                console.error(e);
                statusEl.textContent = "Erro de conexão.";
            }
        });
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const interesse = document.getElementById("interesse").checked;
        if (!interesse) {
             statusEl.textContent = "⚠️ Marque a caixa 'Desejo integrar a delegação' no topo.";
             statusEl.style.color = "#c0392b";
             document.getElementById("interesse").scrollIntoView({behavior: "smooth", block: "center"});
             return;
        }

        const modalidades = Array.from(document.querySelectorAll("input[name='modalidades']:checked")).map(m => m.value);
        if (modalidades.length === 0) {
             statusEl.textContent = "⚠️ Selecione ao menos uma modalidade.";
             statusEl.style.color = "#c0392b";
             return;
        }

        const obs = document.getElementById("obs").value;
        const familiares = document.getElementById("familiares").value;
        const qtd_familiares = document.getElementById("qtd_familiares").value;
        const sexo = document.getElementById("sexo").value;

        if (!sexo) {
            statusEl.textContent = "⚠️ Informe seu Sexo para as categorias esportivas.";
            statusEl.style.color = "#c0392b";
            // Scroll até o campo sexo
            document.getElementById("sexo").scrollIntoView({behavior: "smooth", block: "center"});
            return;
        }

        const payload = { modalidades, observacoes: obs, familiares, qtd_familiares, sexo };
        const token = localStorage.getItem("token");
        
        statusEl.textContent = "Enviando...";
        statusEl.style.color = "#333";
        
        try {
             const resp = await fetch("/api/jogos/inscricao", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify(payload)
             });
             
             if(resp.ok) {
                 statusEl.textContent = "🎉 Inscrição confirmada com sucesso!";
                 statusEl.style.color = "#27ae60";
             } else {
                 statusEl.textContent = "Erro ao salvar inscrição.";
                 statusEl.style.color = "#c0392b";
             }
        } catch(e) { 
            console.error(e); 
            statusEl.textContent = "Erro de conexão."; 
        }
    });
  }

  // ---------------- LISTA DE INSCRITOS (Administrativa) ----------------
  async function renderizarListaInscritosJogos(mainContent) {
    const token = localStorage.getItem("token");
    mainContent.innerHTML = '<h2>Lista de Pré-Inscrições</h2><p>Carregando...</p>';

    try {
        const resp = await fetch("/api/jogos/inscricoes", {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!resp.ok) throw new Error("Falha ao carregar lista.");
        const data = await resp.json();
        const lista = data.inscricoes || [];

        if (lista.length === 0) {
            mainContent.innerHTML = '<p>Nenhuma inscrição encontrada.</p>';
            return;
        }

        // CÁLCULO DE TOTAIS
        const totalTitulares = lista.length;
        const totalFamiliares = lista.reduce((acc, curr) => {
            const qtd = parseInt(curr.qtd_familiares); 
            return acc + (isNaN(qtd) ? 0 : qtd);
        }, 0);
        const totalGeral = totalTitulares + totalFamiliares;

        // Renderiza Linhas
        const listaHtml = lista.map(insc => `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;"><strong>${insc.nome_filiado}</strong></td>
                <td style="border: 1px solid #ddd; padding: 8px;">${insc.sexo || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; white-space: nowrap;">${formatarTelefoneTexto(insc.telefone1)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${insc.modalidades ? insc.modalidades.join(', ') : '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">${insc.qtd_familiares || 0}</td>
                <td style="border: 1px solid #ddd; padding: 8px; font-size: 0.9em; white-space: pre-wrap;">${insc.familiares || ''}</td>
            </tr>
        `).join('');

        mainContent.innerHTML = `
            <h2>Inscrições Recebidas</h2>
            
            <div style="background: #eef; border: 1px solid #ccd; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 20px; flex-wrap: wrap; align-items: center;">
                <div style="font-size: 1rem;"><strong>Titulares:</strong> ${totalTitulares}</div>
                <div style="font-size: 1rem;"><strong>Familiares:</strong> ${totalFamiliares}</div>
                <div style="color: #003366; font-size: 1.2em; border-left: 2px solid #ccc; padding-left: 20px;">
                    <strong>TOTAL GERAL: ${totalGeral} Pessoas</strong>
                </div>
            </div>

            <div style="overflow-x: auto; width: 100%;">
                <table class="af-table" style="border-collapse: collapse; width: 100%; min-width: 800px;">
                    <thead>
                        <tr style="background: #f0f0f0; color: #333;">
                            <th style="border: 1px solid #999; padding: 8px;">Nome</th>
                            <th style="border: 1px solid #999; padding: 8px;">Sexo</th>
                            <th style="border: 1px solid #999; padding: 8px;">Telefone</th>
                            <th style="border: 1px solid #999; padding: 8px;">Modalidades</th>
                            <th style="border: 1px solid #999; padding: 8px;">Qtd. Fam.</th>
                            <th style="border: 1px solid #999; padding: 8px;">Nomes Familiares</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${listaHtml}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        console.error(err);
        mainContent.innerHTML = '<p>Erro ao carregar lista.</p>';
    }
  }

  // ---------------- ALERTA FLUTUANTE ----------------
  function exibirAlertaFlutuante() {
    // Se o usuário já fechou nesta sessão, não mostra de novo
    if (sessionStorage.getItem('fechouAlertaJogos')) return;

    const div = document.createElement('div');
    div.id = 'alerta-jogos-flutuante';
    div.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #e67e22; /* Laranja chamativo */
        color: white;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.4);
        z-index: 9999;
        max-width: 300px;
        font-family: sans-serif;
        animation: slideInRight 0.5s;
        border: 2px solid #fff;
    `;

    div.innerHTML = `
        <button style="position: absolute; top: 5px; right: 8px; background: none; border: none; color: white; font-weight: bold; cursor: pointer; font-size: 16px;">✕</button>
        <h3 style="margin: 0 0 10px 0; font-size: 1.2rem;">🏆 Jogos 2026</h3>
        <p style="margin: 0 0 15px 0; line-height: 1.4;">Não esqueça de fazer sua pré-inscrição para os Jogos de Integração em Poços de Caldas!</p>
        <button id="btn-ir-jogos" style="background: white; color: #d35400; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer; width: 100%;">Inscrever-se Agora</button>
    `;

    document.body.appendChild(div);

    // Adiciona animação CSS dinamicamente
    if (!document.getElementById('style-alerta-anim')) {
        const style = document.createElement('style');
        style.id = 'style-alerta-anim';
        style.textContent = `@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`;
        document.head.appendChild(style);
    }

    // Fechar alerta
    div.querySelector('button').addEventListener('click', () => {
        div.remove();
        sessionStorage.setItem('fechouAlertaJogos', 'true');
    });

    // Botão Inscrever-se
    div.querySelector('#btn-ir-jogos').addEventListener('click', () => {
        // Simula clique na aba Jogos
        const btnJogos = document.querySelector('button[data-target="sec-jogos"]');
        if (btnJogos) btnJogos.click();
        div.remove();
    });
  }

  // ---------------- INICIALIZAÇÃO ----------------
  carregarMeusDados();
  exibirAlertaFlutuante(); // 🟢 Chama o alerta flutuante
});