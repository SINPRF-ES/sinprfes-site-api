/**
 * Módulo Página Inicial (Dashboard)
 * Carregado como script clássico (window.Home)
 */

(function (global) {
    if (global.Home) return;

    function inicializarHome(perfil) {
        const grid = document.getElementById("home-actions-grid");
        if (!grid) return;

        const ehGestao = ["ADMIN", "DIRETORIA", "FUNCIONARIO"].includes(perfil);

        const actions = [
            { label: 'Meus Dados', subtitle: 'Atualize seu cadastro', icon: '👤', target: 'sec-meus-dados' },
            { label: 'Notícias', subtitle: 'Avisos e comunicados', icon: '📰', target: 'sec-noticias' },
            { label: 'Assembleias', subtitle: 'Votações e sessões', icon: '🗳️', target: 'sec-assembleias' },
            { label: 'Listar Filiados', subtitle: 'Consulte o quadro', icon: '👥', target: 'sec-filiados' },
            { label: 'Publicações', subtitle: 'Biblioteca e Atos', icon: '📚', target: 'sec-publicacoes' },
            { label: 'Ressarcimento', subtitle: 'Solicite seu reembolso', icon: '💸', target: 'sec-ressarcimento' },
        ];

        if (ehGestao) {
            actions.push({ label: 'Repasse', subtitle: 'Gestão de localidades', icon: '💱', target: 'sec-repasse' });
            actions.push({ label: 'Relatórios', subtitle: 'Dossiês e PDFs', icon: '📊', target: 'sec-relatorios' });
        }

        grid.innerHTML = actions.map(a => `
            <div class="action-card" onclick="document.getElementById('tab-${a.target.replace('sec-', '')}').click()">
                <div class="icon">${a.icon}</div>
                <div class="label">${a.label}</div>
                <div class="subtitle">${a.subtitle}</div>
            </div>
        `).join('');

        // Atualiza saudação
        const userInfo = window.Utils?.obterUserInfo();
        if (userInfo && userInfo.nome) {
            const primeiroNome = userInfo.nome.split(' ')[0];
            const saudacao = document.getElementById("home-boas-vindas");
            if (saudacao) saudacao.textContent = `Olá, ${primeiroNome}! 👋`;
        }
    }

    global.Home = {
        inicializarHome
    };

})(typeof window !== 'undefined' ? window : global);
