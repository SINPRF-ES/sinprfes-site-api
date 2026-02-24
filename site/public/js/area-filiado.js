/**
 * Orquestrador principal da Página Inicial
 * Carregado como script clássico.
 * Garante a inicialização dos módulos na ordem correta.
 */

(function () {
    console.log("Sistema Página Inicial: Orquestrando inicialização...");

    document.addEventListener("DOMContentLoaded", async () => {
        // 1. Verificação de Token (Contexto: Filiado)
        const token = (window.Utils && window.Utils.obterToken)
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

        let userInfo = obterUserInfo ? obterUserInfo() : {};
        let perfil = (userInfo.perfil_acesso || userInfo.perfil || "FILIADO").toUpperCase();

        function atualizarVisibilidadeAbas(p) {
            const ehGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(p);

            const abasConfig = [
                { id: "nav-repasse", visivel: ehGestao },
                { id: "nav-noticias", visivel: true },
                { id: "nav-cms", visivel: ehGestao },
                { id: "nav-notificacoes", visivel: true },
                { id: "nav-relatorios", visivel: ehGestao },
                { id: "nav-novo-filiado", visivel: ehGestao }
            ];

            abasConfig.forEach(aba => {
                const el = document.getElementById(aba.id);
                if (el) {
                    el.style.display = aba.visivel ? "block" : "none";
                } else {
                    console.warn(`[WARNING] Item de navegação esperado não encontrado: ${aba.id}`);
                }
            });
        }

        console.log("Perfil inicial (Cache):", perfil);
        atualizarVisibilidadeAbas(perfil);

        // 2. Configura Navegação Global
        if (configurarNavegacao) {
            configurarNavegacao((abaAlvo) => {
                console.log("Navegando para:", abaAlvo);
                if (abaAlvo === 'sec-home' && inicializarHome) inicializarHome(perfil);
                else if (abaAlvo === 'sec-meus-dados' && carregarMeusDados) carregarMeusDados();
                else if (abaAlvo === 'sec-filiados' && inicializarFiliados) inicializarFiliados(perfil);
                else if (abaAlvo === 'sec-ressarcimento' && inicializarRessarcimento) inicializarRessarcimento();
                else if (abaAlvo === 'sec-jogos' && inicializarJogos) inicializarJogos(perfil);
                else if (abaAlvo === 'sec-publicacoes' && inicializarPublicacoes) inicializarPublicacoes(null, { perfil });
                else if (abaAlvo === 'sec-assembleias' && inicializarAssembleias) inicializarAssembleias(perfil);
                else if (abaAlvo === 'sec-noticias' && inicializarNoticias) inicializarNoticias(perfil);
                else if (abaAlvo === 'sec-cms' && CMSAdmin && CMSAdmin.init) CMSAdmin.init();
                else if (abaAlvo === 'sec-repasse' && inicializarRepasse) inicializarRepasse(perfil);
                else if (abaAlvo === 'sec-notificacoes' && Notificacoes && Notificacoes.inicializarNotificacoes) Notificacoes.inicializarNotificacoes(userInfo);
                else if (abaAlvo === 'sec-relatorios' && inicializarRelatorios) inicializarRelatorios(perfil);
                else if (abaAlvo === 'sec-estatuto' && window.EstatutoAF) window.EstatutoAF.inicializarEstatuto();
                else if (abaAlvo === 'sec-seguranca') {
                    if (window.Seguranca && window.Seguranca.renderizarSeguranca) {
                        const info = window.Utils?.obterUserInfo();
                        window.Seguranca.renderizarSeguranca(info, carregarMeusDados);
                    }
                }
            });
        }

        // 3. Logout
        const btnLogout = document.getElementById("btn-logout");
        if (btnLogout) {
            btnLogout.onclick = () => {
                if(confirm("Deseja realmente sair?")) {
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
                    console.log(`Perfil atualizado via API: ${perfil} -> ${perfilReal}`);
                    perfil = perfilReal;

                    atualizarVisibilidadeAbas(perfilReal);
                    userInfo = dadosFrescos; // Atualiza objeto global com permissões

                    // Força re-render do menu/módulos se necessário
                    if (inicializarFiliados) inicializarFiliados(perfil);
                    if (Notificacoes && Notificacoes.inicializarNotificacoes) Notificacoes.inicializarNotificacoes(userInfo);
                }
            }

            // Inicializa a visibilidade do menu de notificações se o perfil já for conhecido
            if (Notificacoes && Notificacoes.inicializarNotificacoes) Notificacoes.inicializarNotificacoes(userInfo);

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
                                containerNovo.scrollIntoView({ behavior: 'smooth' });
                            }
                        }, 100);
                    }
                };
            }

            // Inicializa Home se for a aba ativa
            const abaAtiva = document.querySelector(".af-section.active");
            if (abaAtiva && abaAtiva.id === 'sec-home' && inicializarHome) {
                inicializarHome(perfil);
            }

        } catch (err) {
            console.error("Falha na sincronização inicial:", err);
        }

        // 5. Aciona a aba inicial se não for Meus Dados e não for Home
        const abaAtiva = document.querySelector(".af-section.active");
        if (abaAtiva && abaAtiva.id !== 'sec-meus-dados' && abaAtiva.id !== 'sec-home') {
            const btnAtivo = document.querySelector(`.af-nav-item[data-target="${abaAtiva.id}"]`);
            if(btnAtivo) btnAtivo.click();
        }

        if (exibirAlertaFlutuante) exibirAlertaFlutuante();
    });
})();
