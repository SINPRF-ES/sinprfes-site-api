// public/js/area-filiado.js

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const userInfoRaw = localStorage.getItem("userInfo"); // se você estiver salvando
  let perfilAcesso = null;

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

  // -------------------------
  // MÁSCARA GLOBAL DE TELEFONE
  // -------------------------
  function aplicarMascaraTelefone(input) {
    if (!input) return;

    function formatar(valor) {
      let v = String(valor || "").replace(/\D/g, "");

      if (!v) return "";

      // limita a 11 dígitos
      if (v.length > 11) v = v.slice(0, 11);

      // monta com DDD
      if (v.length <= 10) {
        // fixo ou incompleto
        if (v.length >= 1) v = "(" + v;
        if (v.length >= 3) v = v.slice(0, 3) + ") " + v.slice(3);
        if (v.length > 9) v = v.slice(0, 9) + "-" + v.slice(9);
      } else {
        // celular com 11 dígitos
        v = "(" + v.slice(0, 2) + ") " + v.slice(2);
        if (v.length > 10) v = v.slice(0, 10) + "-" + v.slice(10);
      }

      return v;
    }

    // aplica na carga inicial
    input.value = formatar(input.value);

    // e a cada digitação
    input.addEventListener("input", () => {
      input.value = formatar(input.value);
    });
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
      if (alvo) ativarSecao(alvo);
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

  async function carregarMeusDados() {
    if (!conteudoMeusDados) return;

    conteudoMeusDados.innerHTML = "Carregando seus dados...";

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
      preencherFormularioRessarcimentoComDados(dados);
      configurarBuscaFiliadosSeAindaNao();
    } catch (err) {
      console.error(err);
      conteudoMeusDados.innerHTML =
        "<p>Não foi possível carregar seus dados. Tente novamente mais tarde.</p>";
    }
  }

  function parseEnderecoEstruturado(endereco) {
    if (!endereco || !endereco.includes("||")) {
      return {
        logradouro: endereco || "",
        complemento: "",
        cidade: "",
        uf: "",
        cep: ""
      };
    }
    const [logradouro = "", complemento = "", cidade = "", uf = "", cep = ""] =
      endereco.split("||");
    return {
      logradouro,
      complemento,
      cidade,
      uf,
      cep
    };
  }

  function montarEnderecoEstruturado({
    logradouro,
    complemento,
    cidade,
    uf,
    cep,
  }) {
    return [
      logradouro || "",
      complemento || "",
      cidade || "",
      (uf || "").toUpperCase(),
      cep || "",
    ].join("||");
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
      endereco,
    } = dados;

    const endStruct = parseEnderecoEstruturado(endereco);
    const { logradouro, complemento, cidade, uf, cep } = endStruct;
    const cepExistente = (cep || "").replace(/\D/g, "");

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

          <!-- CEP + busca via ViaCEP -->
          <div class="field-row">
            <div class="field-group">
              <label for="me-cep">CEP</label>
              <div style="display:flex; gap:8px;">
                <input
                  type="text"
                  id="me-cep"
                  placeholder="Ex.: 29000000"
                  value="${cepExistente}"
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

          <!-- Endereço vindo do ViaCEP (somente leitura) -->
          <div class="field-row">
            <div class="field-group">
              <label for="me-endereco">Logradouro / Bairro</label>
              <input
                type="text"
                id="me-endereco"
                placeholder="Será preenchido pelo CEP"
                value="${logradouro || ""}"
                readonly
              />
            </div>
          </div>

          <div class="field-row">
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
              <label for="me-cidade">Cidade</label>
              <input
                type="text"
                id="me-cidade"
                placeholder="Será preenchido pelo CEP"
                value="${cidade || ""}"
                readonly
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

    function montarEnderecoFinal() {
      return montarEnderecoEstruturado({
        logradouro: endInput.value.trim(),
        complemento: compInput.value.trim(),
        cidade: cidadeInput.value.trim(),
        uf: ufInput.value.trim(),
        cep: cepInput.value.trim(),
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
        endereco: montarEnderecoFinal(),
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

    if (!listaEl || !inputBusca) return;

    try {
      listaEl.textContent = "Carregando lista de filiados...";

      const resp = await fetch("/api/filiados", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) throw new Error("Falha ao carregar lista de filiados");

      const lista = await resp.json();
      dadosFiliadosCache = Array.isArray(lista) ? lista : [];
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
        const camposBasicos = `
          <div class="af-filiado-linha">
            <div class="af-filiado-info">
              <strong>${f.nome || ""}</strong><br />
              <span class="field-hint">CPF: ${formatarCPF(f.cpf)}</span>
            </div>
            <div class="af-filiado-contatos">
              <span>${f.telefone1 || ""}</span><br />
              <span>${f.telefone2 || ""}</span>
            </div>
          </div>
        `;

        if (!podeEditarTodos) {
          // Filiado comum: só vê nome + telefones
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
                    <label>Endereço</label>
                    <textarea name="endereco" rows="2">${
                      f.endereco || ""
                    }</textarea>
                  </div>
                </div>

                <div class="field-row">
                  <div class="field-group ${classeSomenteAdmin}">
                    <label>Perfil de acesso</label>
                    <select name="perfil_acesso">
                      <option value="">(vazio)</option>
                      <option value="FILIADO" ${
                        f.perfil_acesso === "FILIADO" ? "selected" : ""
                      }>FILIADO</option>
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

    // Aplica máscara de telefone também nos formulários de edição de filiados
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
            if (key === "telefone1" || key === "telefone2") {
              payload[key] = String(value).replace(/\D/g, "");
            } else {
              payload[key] = value;
            }
          });

          // Se não for ADMIN, remove campos que ele não pode mudar
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

  // ---------------- Inicialização ----------------
  carregarMeusDados();
});
