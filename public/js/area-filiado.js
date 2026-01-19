/**
 * Ponto de entrada Área do Filiado
 * Carregado como script clássico
 */

(function (global) {
    console.log("Sistema Área do Filiado: Iniciando...");

    document.addEventListener("DOMContentLoaded", async () => {
        const { obterUserInfo, exibirAlertaFlutuante } = global.Utils || {};
        const { configurarNavegacao } = global.Navegacao || {};
        const { carregarMeusDados } = global.MeusDados || {};
        const { inicializarFiliados } = global.FiliadosAdmin || {};
        const { inicializarRessarcimento } = global.Ressarcimento || {};
        const { inicializarJogos } = global.Jogos || {};
        const { inicializarPublicacoes } = global.Publicacoes || {};

        // 1. Checa Login
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "/login.html";
            return;
        }

        let userInfo = obterUserInfo ? obterUserInfo() : {};
        let perfil = (userInfo.perfil_acesso || userInfo.perfil || "FILIADO").toUpperCase();

        console.log("Perfil inicial (Cache):", perfil);

        // 2. Função para Recarregar Módulos
        const atualizarModulos = (novoPerfil) => {
            console.log("Atualizando módulos para perfil:", novoPerfil);
            if (inicializarFiliados) inicializarFiliados(novoPerfil);
            if (inicializarJogos) inicializarJogos(novoPerfil);
            userInfo.perfil_acesso = novoPerfil;
            localStorage.setItem("userInfo", JSON.stringify(userInfo));
        };

        // 3. Configura Navegação
        if (configurarNavegacao) {
            configurarNavegacao((abaAlvo) => {
                if (abaAlvo === 'sec-meus-dados') { if(carregarMeusDados) carregarMeusDados(); }
                else if (abaAlvo === 'sec-filiados') { if(inicializarFiliados) inicializarFiliados(perfil); }
                else if (abaAlvo === 'sec-ressarcimento') { if(inicializarRessarcimento) inicializarRessarcimento(); }
                else if (abaAlvo === 'sec-jogos') { if(inicializarJogos) inicializarJogos(perfil); }
                else if (abaAlvo === 'sec-publicacoes') { if(inicializarPublicacoes) inicializarPublicacoes(); }
            });
        }

        // 4. Configura Logout
        const btnLogout = document.getElementById("btn-logout");
        if (btnLogout) {
            btnLogout.onclick = () => {
                if (confirm("Deseja realmente sair?")) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("userInfo");
                    window.location.href = "/login.html";
                }
            };
        }

        // 5. Inicialização Inteligente
        try {
            if (carregarMeusDados) {
                const dadosFrescos = await carregarMeusDados();
                if (dadosFrescos && dadosFrescos.perfil_acesso) {
                    const perfilReal = dadosFrescos.perfil_acesso.toUpperCase();
                    if (perfilReal !== perfil) {
                        console.log(`Perfil atualizado: ${perfil} -> ${perfilReal}`);
                        perfil = perfilReal;
                        atualizarModulos(perfil);
                    }
                }
            }
        } catch (err) {
            console.error("Erro ao atualizar perfil:", err);
        }

        // Se o usuário já estiver em outra aba (por refresh), carrega ela agora
        const abaAtiva = document.querySelector(".af-section.active");
        if (abaAtiva && abaAtiva.id !== 'sec-meus-dados') {
            const btnAtivo = document.querySelector(`.af-nav-item[data-target="${abaAtiva.id}"]`);
            if (btnAtivo) btnAtivo.click();
        }

        if (exibirAlertaFlutuante) exibirAlertaFlutuante();
    });

})(typeof window !== 'undefined' ? window : global);
