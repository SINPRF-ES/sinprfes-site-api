/**
 * Módulo Segurança (Página Inicial)
 * Carregado como script clássico (window.Seguranca)
 */

(function (global) {
    if (global.Seguranca) return;

    function renderizarSeguranca(user, callbackRecarregar) {
        // 2FA removido. Biometria é gerida pelo App.
    }

    global.Seguranca = {
        renderizarSeguranca
    };

})(typeof window !== 'undefined' ? window : global);
