// public/js/area-filiado.js
import { obterUserInfo, exibirAlertaFlutuante } from './area-filiado/utils.js';
import { configurarNavegacao } from './area-filiado/navegacao.js';
import { carregarMeusDados } from './area-filiado/meus-dados.js';
import { inicializarFiliados } from './area-filiado/filiados-admin.js';
import { inicializarRessarcimento } from './area-filiado/ressarcimento.js';
import { inicializarJogos } from './area-filiado/jogos.js';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Checa Login
    const userInfo = obterUserInfo();
    if (!localStorage.getItem("token")) {
        window.location.href = "/login.html";
        return;
    }

    const perfil = userInfo.perfil_acesso || "FILIADO";

    // 2. Configura Navegação e Router
    configurarNavegacao((abaAlvo) => {
        if (abaAlvo === 'sec-meus-dados') carregarMeusDados();
        if (abaAlvo === 'sec-filiados') inicializarFiliados(perfil);
        if (abaAlvo === 'sec-ressarcimento') inicializarRessarcimento();
        if (abaAlvo === 'sec-jogos') inicializarJogos(perfil);
    });

    // 3. Inicialização Padrão (Primeira carga)
    carregarMeusDados();
    exibirAlertaFlutuante();
});