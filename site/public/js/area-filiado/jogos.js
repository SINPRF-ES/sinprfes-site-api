/**
 * Módulo Jogos (legado)
 * Mantém apenas visualização de participantes para perfis de gestão.
 */

(function (global) {
    if (global.Jogos) return;

    const MODALIDADES_JOGOS_2026 = [
        { id: 'atletismo_100m_masc', label: '100m Masculino' },
        { id: 'atletismo_100m_fem', label: '100m Feminino' },
        { id: 'atletismo_400m_masc', label: '400m Masculino' },
        { id: 'atletismo_400m_fem', label: '400m Feminino' },
        { id: 'atletismo_1500m_masc', label: '1500m Masculino' },
        { id: 'atletismo_1500m_fem', label: '1500m Feminino' },
        { id: 'atletismo_5000m_masc', label: '5000m Masculino' },
        { id: 'atletismo_5000m_fem', label: '5000m Feminino' },
        { id: 'beach_tenis_dupla_livre', label: 'Beach Tênis - Dupla Livre' },
        { id: 'beach_tenis_dupla_mista', label: 'Beach Tênis - Dupla Mista' },
        { id: 'canastra', label: 'Canastra' },
        { id: 'domino', label: 'Dominó' },
        { id: 'truco_duplas', label: 'Truco (Duplas)' },
        { id: 'xadrez', label: 'Xadrez' },
        { id: 'futebol_society_livre', label: 'Futebol Society (Livre)' },
        { id: 'futebol_society_master', label: 'Futebol Society (Master - Acima de 55 anos)' },
        { id: 'futsal_livre', label: 'Futsal (Livre)' },
        { id: 'futevolei', label: 'Futevôlei' },
        { id: 'voleibol_livre', label: 'Voleibol (Livre)' },
        { id: 'voleibol_praia_dupla_masc', label: 'Vôlei de Praia - Dupla Masculina' },
        { id: 'voleibol_praia_dupla_mista', label: 'Vôlei de Praia - Dupla Mista' },
        { id: 'jiu_jitsu', label: 'Jiu-Jitsu' },
        { id: 'natacao_50m_livre_masc', label: '50m Nado Livre (Masculino)' },
        { id: 'natacao_50m_livre_fem', label: '50m Nado Livre (Feminino)' },
        { id: 'natacao_50m_costas_masc', label: '50m Nado Costas (Masculino)' },
        { id: 'natacao_50m_costas_fem', label: '50m Nado Costas (Feminino)' },
        { id: 'natacao_50m_peito_masc', label: '50m Nado Peito (Masculino)' },
        { id: 'natacao_50m_peito_fem', label: '50m Nado Peito (Feminino)' },
        { id: 'natacao_50m_borboleta_masc', label: '50m Nado Borboleta (Masculino)' },
        { id: 'natacao_50m_borboleta_fem', label: '50m Nado Borboleta (Feminino)' },
        { id: 'natacao_revezamento_4x50m_livre', label: 'Revezamento 4x50m Livre' },
        { id: 'natacao_revezamento_2x50m_misto', label: 'Revezamento 2x50 Misto' },
        { id: 'sinuca_individual', label: 'Sinuca Individual' },
        { id: 'sinuca_duplas', label: 'Sinuca Duplas' },
        { id: 'tenis_quadra_individual_masc', label: 'Tênis de Quadra - Individual (Masculino)' },
        { id: 'tenis_quadra_duplas_livre', label: 'Tênis de Quadra - Duplas (Livre)' },
        { id: 'tenis_mesa_masc', label: 'Tênis de Mesa (Masculino)' },
        { id: 'tenis_mesa_fem', label: 'Tênis de Mesa (Feminino)' },
        { id: 'tenis_mesa_duplas', label: 'Tênis de Mesa (Duplas)' },
        { id: 'tiro_nra_masc', label: 'Tiro NRA (Masculino)' },
        { id: 'tiro_nra_fem', label: 'Tiro NRA (Feminino)' },
        { id: 'tiro_ispc_masc', label: 'Tiro ISPC (Masculino)' },
        { id: 'tiro_ispc_fem', label: 'Tiro ISPC (Feminino)' },
        { id: 'peteca', label: 'Peteca' },
        { id: 'damas', label: 'Damas' },
        { id: 'bocha', label: 'Bocha' },
    ];

    const PERFIS_JOGOS_MANAGER = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO', 'ORGANIZADOR'];

    function calcularIdade2026(dataNasc) {
        if (!dataNasc) return '';
        let ano = 0;
        if (dataNasc.includes('-')) ano = parseInt(dataNasc.split('-')[0], 10);
        else if (dataNasc.includes('/')) {
            const partes = dataNasc.split('/');
            if (partes.length === 3) ano = parseInt(partes[2], 10);
        }
        if (!ano || Number.isNaN(ano)) return '';
        return 2026 - ano;
    }

    function renderizarTabela(dados) {
        const wrapper = document.getElementById('tabela-jogos-wrapper');
        if (!wrapper) return;

        wrapper.innerHTML = `
            <table class="jogos-tabela ui-table" id="tabela-inscricoes-jogos">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Idade (2026)</th>
                        <th>Sexo</th>
                        <th>Modalidades</th>
                        <th>Qtd Fam.</th>
                        <th>Familiares</th>
                        <th>Observações</th>
                        <th>Telefone</th>
                        <th>E-mail(s)</th>
                    </tr>
                </thead>
                <tbody>
                    ${dados.map((i) => {
                        const idade = calcularIdade2026(i.data_nascimento);
                        const modsLabels = (i.modalidades || []).map((id) => {
                            const m = MODALIDADES_JOGOS_2026.find((x) => x.id === id);
                            return m ? m.label : id;
                        }).join(', ');
                        const emails = [i.email1, i.email2].filter(Boolean).join(' / ');
                        const sexoFormatado = i.sexo ? (i.sexo.charAt(0).toUpperCase() + i.sexo.slice(1).toLowerCase()) : '-';
                        const telefoneFormatado = window.Utils?.formatarTelefoneTexto ? window.Utils.formatarTelefoneTexto(i.telefone1) : (i.telefone1 || '-');

                        return `
                            <tr>
                                <td style="font-weight:bold;">${i.nome_filiado || '-'}</td>
                                <td style="text-align:center;">${idade || '-'}</td>
                                <td>${sexoFormatado}</td>
                                <td style="font-size:0.85rem;">${modsLabels}</td>
                                <td style="text-align:center;">${i.qtd_familiares || 0}</td>
                                <td style="font-size:0.85rem;">${i.familiares || '-'}</td>
                                <td style="font-size:0.85rem;">${i.observacoes || '-'}</td>
                                <td>${telefoneFormatado}</td>
                                <td style="font-size:0.85rem;">${emails || '-'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    function exportarParaCSV(dados) {
        const headers = ['Nome', 'Idade (2026)', 'Sexo', 'Modalidades', 'Qtd Familiares', 'Familiares', 'Observacoes', 'Telefone', 'Emails'];
        const rows = dados.map((i) => {
            const idade = calcularIdade2026(i.data_nascimento);
            const mods = (i.modalidades || []).map((id) => {
                const m = MODALIDADES_JOGOS_2026.find((x) => x.id === id);
                return m ? m.label : id;
            }).join('; ');
            const emails = [i.email1, i.email2].filter(Boolean).join(' / ');
            const sexoFormatado = i.sexo ? (i.sexo.charAt(0).toUpperCase() + i.sexo.slice(1).toLowerCase()) : '';
            const telefoneFormatado = window.Utils?.formatarTelefoneTexto ? window.Utils.formatarTelefoneTexto(i.telefone1) : (i.telefone1 || '');

            return [
                i.nome_filiado || '', idade, sexoFormatado, mods, i.qtd_familiares || 0,
                (i.familiares || '').replace(/\n/g, ' '),
                (i.observacoes || '').replace(/\n/g, ' '),
                telefoneFormatado,
                emails,
            ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `participantes_jogos_2026_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportarParaXLS() {
        const table = document.getElementById('tabela-inscricoes-jogos');
        if (!table) return;

        const html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="UTF-8"></head>
            <body>${table.outerHTML}</body>
            </html>
        `;
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `participantes_jogos_2026_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function inicializarJogos(perfil) {
        const secJogos = document.getElementById('sec-jogos');
        if (!secJogos) return;

        const isManager = PERFIS_JOGOS_MANAGER.includes((perfil || '').toUpperCase());

        if (!isManager) {
            secJogos.innerHTML = '<div class="ui-card"><p>Conteúdo disponível apenas para perfis de gestão.</p></div>';
            return;
        }

        secJogos.innerHTML = `
            <div class="jogos-page">
                <div class="jogos-card">
                    <div class="jogos-banner">
                        <h2>🏅 Jogos de Integração da PRF - 2026</h2>
                        <p>Painel legado de participantes.</p>
                    </div>
                    <div class="jogos-body">
                        <div class="planilha-container" style="margin-top:0; border-top:none; padding-top:0;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                                <h3 style="margin:0; color:#003366;">📊 Participantes (Gestão)</h3>
                                <div id="jogos-export-actions">
                                    <button id="btn-export-csv" class="btn-export">Exportar CSV</button>
                                    <button id="btn-export-xls" class="btn-export" style="background:#2980b9;">Exportar XLS</button>
                                </div>
                            </div>
                            <div id="tabela-jogos-wrapper" class="jogos-table-container" style="max-height: 600px;">Carregando...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        (async () => {
            try {
                const r = await window.Api.apiFetch('/api/jogos/inscricoes');
                if (!r.ok) throw new Error('Falha ao carregar participantes');
                const { inscricoes } = await r.json();

                if (!inscricoes || inscricoes.length === 0) {
                    const wrapper = document.getElementById('tabela-jogos-wrapper');
                    if (wrapper) wrapper.textContent = 'Nenhum participante registrado.';
                    return;
                }

                renderizarTabela(inscricoes);
                const btnCsv = document.getElementById('btn-export-csv');
                const btnXls = document.getElementById('btn-export-xls');
                if (btnCsv) btnCsv.onclick = () => exportarParaCSV(inscricoes);
                if (btnXls) btnXls.onclick = () => exportarParaXLS();
            } catch (err) {
                const wrapper = document.getElementById('tabela-jogos-wrapper');
                if (wrapper) wrapper.textContent = 'Erro ao carregar participantes.';
            }
        })();
    }

    global.Jogos = { inicializarJogos };
})(typeof window !== 'undefined' ? window : global);
