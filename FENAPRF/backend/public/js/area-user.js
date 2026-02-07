/**
 * Orquestrador principal da Página Inicial
 * Carregado como script clássico.
 * Garante a inicialização dos módulos na ordem correta.
 */

(function () {
    console.log("Sistema Página Inicial: Orquestrando inicialização...");

    document.addEventListener("DOMContentLoaded", async () => {
        // 1. Verificação de Token
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "/login.html";
            return;
        }

        const { obterUserInfo, exibirAlertaFlutuante } = window.Utils || {};
        const { configurarNavegacao } = window.Navegacao || {};
        const { carregarMeusDados } = window.MeusDados || {};
        const { inicializarUsers } = window.UsersAdmin || {};
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
        let perfil = (userInfo.perfil_acesso || userInfo.perfil || "USER").toUpperCase();

        console.log("Perfil inicial (Cache):", perfil);

        // 2. Configura Navegação Global
        if (configurarNavegacao) {
            configurarNavegacao((abaAlvo) => {
                console.log("Navegando para:", abaAlvo);
                if (abaAlvo === 'sec-meus-dados' && carregarMeusDados) carregarMeusDados();
                else if (abaAlvo === 'sec-users' && inicializarUsers) inicializarUsers(perfil);
                else if (abaAlvo === 'sec-ressarcimento' && inicializarRessarcimento) inicializarRessarcimento();
                else if (abaAlvo === 'sec-jogos' && inicializarJogos) inicializarJogos(perfil);
                else if (abaAlvo === 'sec-publicacoes' && inicializarPublicacoes) inicializarPublicacoes(null, { perfil });
                else if (abaAlvo === 'sec-assembleias' && inicializarAssembleias) inicializarAssembleias(perfil);
                else if (abaAlvo === 'sec-noticias' && inicializarNoticias) inicializarNoticias(perfil);
                else if (abaAlvo === 'sec-cms' && CMSAdmin && CMSAdmin.init) CMSAdmin.init();
                else if (abaAlvo === 'sec-repasse' && inicializarRepasse) inicializarRepasse(perfil);
                else if (abaAlvo === 'sec-notificacoes' && Notificacoes && Notificacoes.inicializarNotificacoes) Notificacoes.inicializarNotificacoes(perfil);
                else if (abaAlvo === 'sec-relatorios' && inicializarRelatorios) inicializarRelatorios(perfil);
            });
        }

        // 3. Logout
        const btnLogout = document.getElementById("btn-logout");
        if (btnLogout) {
            btnLogout.onclick = () => {
                if(confirm("Deseja realmente sair?")) {
                    localStorage.clear();
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
                    if (perfilReal !== perfil) {
                        console.log(`Perfil atualizado via API: ${perfil} -> ${perfilReal}`);
                        perfil = perfilReal;
                        // Força re-render do menu/módulos se necessário
                        if (inicializarUsers) inicializarUsers(perfil);
                        if (Notificacoes && Notificacoes.inicializarNotificacoes) Notificacoes.inicializarNotificacoes(perfil);
                    }
                }
            }

            // Inicializa a visibilidade do menu de notificações se o perfil já for conhecido
            if (Notificacoes && Notificacoes.inicializarNotificacoes) Notificacoes.inicializarNotificacoes(perfil);

            // Exibe abas restritas conforme perfil (Regra de Ouro)
            const perfisGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"];
            const perfisComunicacao = ["ADMIN", "DIRETORIA", "FUNCIONARIO", "COMUNICADOR"];

            const navRepasse = document.getElementById("nav-repasse");
            if (navRepasse) navRepasse.style.display = perfisGestao.includes(perfil) ? "block" : "none";

            const navNoticias = document.getElementById("nav-noticias");
            if (navNoticias) navNoticias.style.display = perfisComunicacao.includes(perfil) ? "block" : "none";

            const navCms = document.getElementById("nav-cms");
            if (navCms) navCms.style.display = perfisGestao.includes(perfil) ? "block" : "none";

            const navNotificacoes = document.getElementById("nav-notificacoes");
            if (navNotificacoes) navNotificacoes.style.display = perfisGestao.includes(perfil) ? "block" : "none";

            const navRelatorios = document.getElementById("nav-relatorios");
            if (navRelatorios) navRelatorios.style.display = perfisGestao.includes(perfil) ? "block" : "none";

        } catch (err) {
            console.error("Falha na sincronização inicial:", err);
        }

        // 5. Aciona a aba inicial se não for Meus Dados
        const abaAtiva = document.querySelector(".af-section.active");
        if (abaAtiva && abaAtiva.id !== 'sec-meus-dados') {
            const btnAtivo = document.querySelector(`.af-nav-item[data-target="${abaAtiva.id}"]`);
            if(btnAtivo) btnAtivo.click();
        }

        if (exibirAlertaFlutuante) exibirAlertaFlutuante();
    });
})();
