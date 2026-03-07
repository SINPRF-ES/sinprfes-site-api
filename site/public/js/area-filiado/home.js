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

        const isComunicador = perfil === 'COMUNICADOR';

        const actions = [
            { label: 'Meus Dados', subtitle: 'Atualize seu cadastro', icon: '👤', target: 'sec-meus-dados' },
            { label: 'Informes', subtitle: 'Avisos e comunicados', icon: '📰', target: 'sec-noticias' },
            { label: 'Ressarcimento', subtitle: 'Solicite seu reembolso', icon: '💸', target: 'sec-ressarcimento' },
        ];

        if (!isComunicador) {
            actions.push({ label: 'Assembleias', subtitle: 'Votações e sessões', icon: '🗳️', target: 'sec-assembleias' });
            actions.push({ label: 'Listar Filiados', subtitle: 'Consulte o quadro', icon: '👥', target: 'sec-filiados' });
            actions.push({ label: 'Publicações', subtitle: 'Biblioteca e Atos', icon: '📚', target: 'sec-publicacoes' });
            actions.push({ label: 'Repasse', subtitle: 'Apoio operacional e alocações', icon: '💱', target: 'sec-repasse' });
        }

        if (ehGestao) {
            actions.push({ label: 'Relatórios', subtitle: 'Dossiês e PDFs', icon: '📊', target: 'sec-relatorios' });
        }

        grid.innerHTML = actions.map(a => {
            const targetId = `nav-${a.target.replace('sec-', '')}`;
            return `
                <div class="action-card"
                     role="button"
                     tabindex="0"
                     aria-label="${a.label}: ${a.subtitle}"
                     onclick="document.getElementById('${targetId}').click()"
                     onkeydown="if(event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.getElementById('${targetId}').click(); }">
                    <div class="icon" aria-hidden="true">${a.icon}</div>
                    <div class="label">${a.label}</div>
                    <div class="subtitle">${a.subtitle}</div>
                </div>
            `;
        }).join('');

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
