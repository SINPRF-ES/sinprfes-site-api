// public/js/area-filiado.js
import { obterUserInfo, exibirAlertaFlutuante } from './area-filiado/utils.js';
import { configurarNavegacao } from './area-filiado/navegacao.js';
import { carregarMeusDados } from './area-filiado/meus-dados.js';
import { inicializarFiliados } from './area-filiado/filiados-admin.js'; 
import { inicializarRessarcimento } from './area-filiado/ressarcimento.js';
import { inicializarJogos } from './area-filiado/jogos.js';
// 🟢 NOVO: Importar módulo de publicações
import { inicializarPublicacoes } from './area-filiado/publicacoes.js';

console.log("Sistema Área do Filiado: Iniciando...");

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Checa Login
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    // Tenta pegar do cache, mas define um padrão seguro
    let userInfo = obterUserInfo();
    let perfil = userInfo.perfil_acesso || userInfo.perfil || "FILIADO";
    perfil = perfil.toUpperCase();

    console.log("Perfil inicial (Cache):", perfil);

    // 2. Função para Recarregar Módulos com Permissões Atualizadas
    const atualizarModulos = (novoPerfil) => {
        console.log("Atualizando módulos para perfil:", novoPerfil);
        inicializarFiliados(novoPerfil);
        inicializarJogos(novoPerfil);
        // Salva no localStorage para o próximo refresh ser mais rápido
        userInfo.perfil_acesso = novoPerfil;
        localStorage.setItem("userInfo", JSON.stringify(userInfo));
    };

    // 3. Configura Navegação
    configurarNavegacao((abaAlvo) => {
        if (abaAlvo === 'sec-meus-dados') carregarMeusDados(); 
        else if (abaAlvo === 'sec-filiados') inicializarFiliados(perfil);
        else if (abaAlvo === 'sec-ressarcimento') inicializarRessarcimento();
        else if (abaAlvo === 'sec-jogos') inicializarJogos(perfil);
        // 🟢 NOVO: Gatilho da aba de publicações
        else if (abaAlvo === 'sec-publicacoes') inicializarPublicacoes();
    });

    // 4. Configura Logout
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            if(confirm("Deseja realmente sair?")) {
                localStorage.removeItem("token");
                localStorage.removeItem("userInfo");
                window.location.href = "/login.html";
            }
        });
    }

    // 5. Inicialização Inteligente
    try {
        const dadosFrescos = await carregarMeusDados();
        if (dadosFrescos && dadosFrescos.perfil_acesso) {
            const perfilReal = dadosFrescos.perfil_acesso.toUpperCase();
            if (perfilReal !== perfil) {
                console.log(`Perfil atualizado: ${perfil} -> ${perfilReal}`);
                perfil = perfilReal;
                atualizarModulos(perfil);
            }
        }
    } catch (err) {
        console.error("Erro ao atualizar perfil:", err);
    }

    // Se o usuário já estiver em outra aba (por refresh), carrega ela agora
    const abaAtiva = document.querySelector(".af-section.active");
    if (abaAtiva && abaAtiva.id !== 'sec-meus-dados') {
        const btnAtivo = document.querySelector(`.af-nav-item[data-target="${abaAtiva.id}"]`);
        if(btnAtivo) btnAtivo.click();
    }

    exibirAlertaFlutuante();
});