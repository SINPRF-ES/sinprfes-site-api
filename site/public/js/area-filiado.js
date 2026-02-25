/**
 * Orquestrador principal da Página Inicial
 * Carregado como script clássico.
 * Garante a inicialização dos módulos na ordem correta.
 */

(function () {
  console.log("Sistema Página Inicial: Orquestrando inicialização...");

  document.addEventListener("DOMContentLoaded", async () => {
    if (window.Utils?.initNotificationsForensics) {
      window.Utils.initNotificationsForensics();
    }
    // 1. Verificação de Token (Contexto: Filiado)
    const token =
      (window.Utils && window.Utils.obterToken)
        ? window.Utils.obterToken()
        : localStorage.getItem("token");

    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    const { obterUserInfo, exibirAlertaFlutuante } = window.Utils || {};
    const { configurarNavegacao } = window.Navegacao || {};
    const { inicializarHome } = window.Home || {};
    const { carregarMeusDados } = window.MeusDados || {};
    const { inicializarFiliados, abrirNovoFiliado } = window.FiliadosAdmin || {};
    const { inicializarRessarcimento } = window.Ressarcimento || {};
    const { inicializarJogos } = window.Jogos || {};
    const { inicializarPublicacoes } = window.Publicacoes || {};
    const { inicializarAssembleias } = window.Assembleias || {};
    const { inicializarRepasse } = window.Repasse || {};
    const { inicializarNoticias } = window.NoticiasAdmin || {};
    const { inicializarRelatorios } = window.Relatorios || {};
    const { CMSAdmin } = window || {};
    const { Notificacoes } = window || {};

    // Helper: sempre pegar userInfo mais fresco possível
    function obterUserInfoFresco() {
      // 1) Utils.obterUserInfo (se existir)
      if (window.Utils?.obterUserInfo) {
        const info = window.Utils.obterUserInfo();
        if (info && typeof info === "object") return info;
      }

      // 2) localStorage.userInfo
      try {
        const raw = localStorage.getItem("userInfo");
        if (raw) return JSON.parse(raw);
      } catch (_) {}

      // 3) fallback
      return {};
    }

    let userInfo = obterUserInfoFresco();
    let perfil = (userInfo.perfil_acesso || userInfo.perfil || "FILIADO").toUpperCase();

    function inicializarNotificacoesComPerfil(perfilAtual) {
      if (!Notificacoes) return;
      if (Notificacoes.inicializarNotificacoes) {
        Notificacoes.inicializarNotificacoes({ perfil: perfilAtual });
        return;
      }
      if (Notificacoes.inicializar) {
        Notificacoes.inicializar({ perfil: perfilAtual });
      }
    }

    /**
     * Atualiza visibilidade das abas baseada em permissões (Permissions-First).
     * @param {Object} info - Objeto userInfo com perfil e permissions.
     */
    function atualizarVisibilidadeAbas(info) {
      const p = (info.perfil_acesso || info.perfil || "FILIADO").toUpperCase();
      const perms = info.permissions || [];
      const hasPerm = (perm) => perms.includes("*") || perms.includes(perm);

      const abasConfig = [
        { id: "nav-repasse", visivel: hasPerm('REPASSE_GERENCIAR') },
        { id: "nav-noticias", visivel: true },
        { id: "nav-cms", visivel: hasPerm('EDIT_CONTENT') },
        { id: "nav-notificacoes", visivel: hasPerm('PUSH_GERENCIAR') },
        { id: "nav-relatorios", visivel: hasPerm('RELATORIOS_VER') },
        { id: "nav-novo-filiado", visivel: hasPerm('CREATE_FILIADO') }
      ];

      abasConfig.forEach((aba) => {
        const el = document.getElementById(aba.id);
        if (el) {
          el.style.display = aba.visivel ? "block" : "none";
        } else {
          console.warn(`[WARNING] Item de navegação esperado não encontrado: ${aba.id}`);
        }
      });
    }

    console.log("Perfil inicial (Cache):", perfil);
    atualizarVisibilidadeAbas(userInfo);

    // 2. Configura Navegação Global
    if (configurarNavegacao) {
      configurarNavegacao((abaAlvo) => {
        console.log("Navegando para:", abaAlvo);
        const userInfoAtu = obterUserInfoFresco();
        const permsAtu = userInfoAtu.permissions || [];
        const hasPerm = (perm) => permsAtu.includes("*") || permsAtu.includes(perm);

        if (abaAlvo === "sec-home" && inicializarHome) inicializarHome(perfil);
        else if (abaAlvo === "sec-meus-dados" && carregarMeusDados) carregarMeusDados();
        else if (abaAlvo === "sec-filiados" && inicializarFiliados) inicializarFiliados(perfil);
        else if (abaAlvo === "sec-ressarcimento" && inicializarRessarcimento) inicializarRessarcimento();
        else if (abaAlvo === "sec-jogos" && inicializarJogos) inicializarJogos(perfil);
        else if (abaAlvo === "sec-publicacoes" && inicializarPublicacoes) inicializarPublicacoes(null, { perfil });
        else if (abaAlvo === "sec-assembleias" && inicializarAssembleias) inicializarAssembleias(perfil);
        else if (abaAlvo === "sec-noticias" && inicializarNoticias) inicializarNoticias(perfil);
        else if (abaAlvo === "sec-cms" && CMSAdmin && CMSAdmin.init) CMSAdmin.init();
        else if (abaAlvo === "sec-repasse" && inicializarRepasse) inicializarRepasse(perfil);
        else if (abaAlvo === "sec-notificacoes") {
          if (!hasPerm('PUSH_GERENCIAR')) {
            console.warn("Acesso negado: Notificações é restrito à gestão.");
            const btnHome = document.getElementById("nav-home");
            if (btnHome) btnHome.click();
            return;
          }
          inicializarNotificacoesComPerfil(perfil);
        }
        else if (abaAlvo === "sec-relatorios" && inicializarRelatorios) inicializarRelatorios(perfil);
        else if (abaAlvo === "sec-estatuto" && window.EstatutoAF) window.EstatutoAF.inicializarEstatuto();
        else if (abaAlvo === "sec-seguranca") {
          if (window.Seguranca && window.Seguranca.renderizarSeguranca) {
            const info = obterUserInfoFresco();
            window.Seguranca.renderizarSeguranca(info, carregarMeusDados);
          }
        }
      });
    }

    // 3. Logout
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.onclick = () => {
        if (confirm("Deseja realmente sair?")) {
          localStorage.removeItem("token");
          localStorage.removeItem("token_filiado");
          localStorage.removeItem("token_gestao");
          localStorage.removeItem("userInfo");
          localStorage.removeItem("perfil_acesso");
          window.location.href = "/login.html";
        }
      };
    }

    // 4. Carga Inicial e Sincronização de Perfil
    try {
      if (carregarMeusDados) {
        const dadosFrescos = await carregarMeusDados();

        if (dadosFrescos && dadosFrescos.perfil_acesso) {
          const perfilReal = dadosFrescos.perfil_acesso.toUpperCase();

          const infoAntigaStr = JSON.stringify(userInfo);
          const infoNovaStr = JSON.stringify(dadosFrescos);

          if (infoAntigaStr !== infoNovaStr) {
            console.log(`Dados/Perfil atualizados via API: ${perfil} -> ${perfilReal}`);
            perfil = perfilReal;

            // Atualiza cache e referência
            userInfo = dadosFrescos;
            localStorage.setItem("userInfo", JSON.stringify(dadosFrescos));

            atualizarVisibilidadeAbas(dadosFrescos);

            // Re-render de módulos que dependem de perfil
            if (inicializarFiliados) inicializarFiliados(perfil);

            // Re-sincroniza notificações apenas quando a aba já está ativa
            if (document.querySelector(".af-section.active")?.id === "sec-notificacoes") {
              inicializarNotificacoesComPerfil(perfilReal);
            }
          } else {
            console.log("Sessão sincronizada (sem alterações no perfil).");
          }
        }
      }

      const navNovoFiliado = document.getElementById("nav-novo-filiado");
      if (navNovoFiliado) {
        navNovoFiliado.onclick = () => {
          const btnTabFiliados = document.getElementById("nav-filiados");
          if (btnTabFiliados) {
            btnTabFiliados.click();
            setTimeout(() => {
              const containerNovo = document.getElementById("novo-filiado-container");
              if (containerNovo && abrirNovoFiliado) {
                abrirNovoFiliado(containerNovo);
                containerNovo.scrollIntoView({ behavior: "smooth" });
              }
            }, 100);
          }
        };
      }

      // Inicializa Home se for a aba ativa
      const abaAtiva = document.querySelector(".af-section.active");
      if (abaAtiva && abaAtiva.id === "sec-home" && inicializarHome) {
        inicializarHome(perfil);
      }

    } catch (err) {
      console.error("Falha na sincronização inicial:", err);
    }

    // 5. Aciona a aba inicial se não for Meus Dados e não for Home
    const abaAtiva = document.querySelector(".af-section.active");
    if (abaAtiva && abaAtiva.id !== "sec-meus-dados" && abaAtiva.id !== "sec-home") {
      const btnAtivo = document.querySelector(`.af-nav-item[data-target="${abaAtiva.id}"]`);
      if (btnAtivo) btnAtivo.click();
    }

    if (exibirAlertaFlutuante) exibirAlertaFlutuante();
  });
})();
