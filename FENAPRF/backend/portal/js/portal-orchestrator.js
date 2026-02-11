/**
 * Orquestrador principal da Página Inicial
 * Carregado como script clássico.
 * Garante a inicialização dos módulos na ordem correta.
 */

(function () {
    async function syncSessionFromApi() {
        const raw = localStorage.getItem("token");
        const token = (raw || "").trim();

        if (!token || token === "null" || token === "undefined") {
            console.warn("Portal: Token ausente. Redirecionando para login...");
            localStorage.clear();
            window.location.replace("/login.html");
            return null;
        }

        try {
            const apiBase = (window.location.hostname === "localhost")
                ? "http://localhost:3000"
                : "https://fenaprf-sistema.onrender.com";

            const resp = await fetch(apiBase + "/api/auth/me", {
                headers: { Authorization: "Bearer " + token }
            });

            if (!resp.ok) {
                console.error("Portal: Falha na validação da sessão (401/403). Limpando cache...");
                localStorage.clear();
                window.location.replace("/login.html");
                return null;
            }

            const me = await resp.json();

            // 🔥 Fonte da verdade absoluta
            localStorage.setItem("perfil_acesso", (me.perfil_acesso || "").toUpperCase());
            localStorage.setItem("userId", me.id || "");
            localStorage.setItem("userName", me.name || "");
            localStorage.setItem("userInfo", JSON.stringify(me));

            return me;
        } catch (err) {
            console.error("Portal: Erro crítico ao sincronizar sessão:", err);
            // Em caso de erro de rede, podemos deixar carregar com o cache se houver,
            // mas o ideal para segurança web é forçar login se não conseguir validar.
            return null;
        }
    }

    console.log("Sistema Portal: Orquestrando inicialização...");

    document.addEventListener("DOMContentLoaded", async () => {
        // 1. Sincronização Obrigatória (Fonte da Verdade)
        const me = await syncSessionFromApi();
        if (!me) return; // Redirecionamento já ocorreu no syncSession

        const perfil = (me.perfil_acesso || "CONSELHEIRO").toUpperCase();
        console.log("Perfil sincronizado (API):", perfil);

        const { configurarNavegacao } = window.Navegacao || {};
        const { carregarMeusDados } = window.MeusDados || {};
        const { inicializarUsers } = window.UsersAdmin || {};
        const { inicializarPublicacoes } = window.Publicacoes || {};
        const { inicializarAssembleias } = window.Assembleias || {};
        const { inicializarRelatorios } = window.Relatorios || {};
        const { inicializarLogistica } = window.Logistica || {};
        const { CMSAdmin } = window || {};
        const { Notificacoes } = window || {};

        // 2. Configura Navegação Global
        if (configurarNavegacao) {
            configurarNavegacao((abaAlvo) => {
                console.log("Navegando para:", abaAlvo);
                if (abaAlvo === 'sec-meus-dados' && carregarMeusDados) carregarMeusDados();
                else if (abaAlvo === 'sec-users' && inicializarUsers) inicializarUsers(perfil);
                else if (abaAlvo === 'sec-publicacoes' && inicializarPublicacoes) inicializarPublicacoes(null, { perfil });
                else if (abaAlvo === 'sec-assembleias' && inicializarAssembleias) inicializarAssembleias(perfil);
                else if (abaAlvo === 'sec-cms' && CMSAdmin && CMSAdmin.init) CMSAdmin.init();
                else if (abaAlvo === 'sec-notificacoes' && Notificacoes && Notificacoes.inicializarNotificacoes) Notificacoes.inicializarNotificacoes(perfil);
                else if (abaAlvo === 'sec-relatorios' && inicializarRelatorios) inicializarRelatorios(perfil);
                else if (abaAlvo === 'sec-logistica' && inicializarLogistica) inicializarLogistica(perfil);
            });
        }

        // 3. Logout
        const btnLogout = document.getElementById("btn-logout");
        if (btnLogout) {
            btnLogout.onclick = () => {
                if(confirm("Deseja realmente sair?")) {
                    localStorage.clear();
                    window.location.replace("/login.html");
                }
            };
        }

        // 4. Configuração de Interface por Perfil
        try {
            // Inicializa visibilidade de abas (Regra de Ouro)
            const perfisGestao = ["ADMIN", "DIRETORIA", "COLABORADOR"];

            const navCms = document.getElementById("nav-cms");
            if (navCms) navCms.style.display = perfisGestao.includes(perfil) ? "block" : "none";

            const navNotificacoes = document.getElementById("nav-notificacoes");
            if (navNotificacoes) navNotificacoes.style.display = perfisGestao.includes(perfil) ? "block" : "none";

            const navRelatorios = document.getElementById("nav-relatorios");
            if (navRelatorios) navRelatorios.style.display = perfisGestao.includes(perfil) ? "block" : "none";

            // Carga inicial dos dados do membro
            if (carregarMeusDados) await carregarMeusDados();

            // Inicializa notificações se houver permissão
            if (Notificacoes && Notificacoes.inicializarNotificacoes) {
                Notificacoes.inicializarNotificacoes(perfil);
            }

        } catch (err) {
            console.error("Erro ao configurar interface do portal:", err);
        }

        // 5. Aciona a aba inicial se não for Meus Dados
        const abaAtiva = document.querySelector(".af-section.active");
        if (abaAtiva && abaAtiva.id !== 'sec-meus-dados') {
            const btnAtivo = document.querySelector(`.af-nav-item[data-target="${abaAtiva.id}"]`);
            if(btnAtivo) btnAtivo.click();
        }
    });
})();
