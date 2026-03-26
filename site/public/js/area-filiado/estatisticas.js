(function (global) {
  if (global.EstatisticasGestao) return;

  function cardNumero(titulo, valor, emoji) {
    return `
      <div class="ui-card" style="min-height:120px; display:flex; flex-direction:column; justify-content:center; gap:6px;">
        <span style="font-size:0.95rem; color:#475467;">${emoji} ${titulo}</span>
        <strong style="font-size:2rem; color:var(--azul-fundo); line-height:1;">${Number(valor || 0).toLocaleString('pt-BR')}</strong>
      </div>
    `;
  }

  function tabela(lista, col1, col2) {
    if (!Array.isArray(lista) || lista.length === 0) {
      return '<p style="color:#667085;">Sem dados no período selecionado.</p>';
    }

    return `
      <div style="overflow:auto;">
        <table class="ui-table" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px; border-bottom:1px solid #e4e7ec;">${col1}</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #e4e7ec;">${col2}</th>
            </tr>
          </thead>
          <tbody>
            ${lista.map((item) => `
              <tr>
                <td style="padding:8px; border-bottom:1px solid #f2f4f7;">${item.nome}</td>
                <td style="padding:8px; text-align:right; border-bottom:1px solid #f2f4f7; font-weight:600;">${Number(item.total || 0).toLocaleString('pt-BR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function inicializarEstatisticas() {
    const mount = document.getElementById('estatisticas-gestao-root');
    if (!mount) return;

    mount.innerHTML = '<div class="ui-card"><p>Carregando estatísticas de acesso...</p></div>';

    const token = localStorage.getItem('token') || localStorage.getItem('token_gestao') || localStorage.getItem('token_filiado');
    if (!token) {
      mount.innerHTML = '<div class="ui-card"><p>Sessão inválida. Faça login novamente.</p></div>';
      return;
    }

    const API_BASE = (window.Utils && window.Utils.resolveApiBase)
      ? window.Utils.resolveApiBase()
      : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || '').replace(/\/+$/, '');

    try {
      const resp = await fetch(`${API_BASE}/api/analytics/resumo`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        }
      });

      if (resp.status === 403) {
        mount.innerHTML = '<div class="ui-card"><p>Este módulo é restrito aos perfis de gestão.</p></div>';
        return;
      }

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const payload = await resp.json();
      const metricas = payload.metricas || {};
      const origens = Array.isArray(payload.origens) ? payload.origens : [];
      const paginas = Array.isArray(payload.paginas) ? payload.paginas : [];

      mount.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px;">
          ${cardNumero('Acessos hoje', metricas.diario, '📅')}
          ${cardNumero('Acessos no mês', metricas.mensal, '🗓️')}
          ${cardNumero('Acessos totais', metricas.total, '🌐')}
        </div>

        <div class="ui-card" style="margin-bottom:12px;">
          <h3 style="margin-top:0;">Origem dos acessos (últimos ${payload.janela_origens_dias || 30} dias)</h3>
          ${tabela(origens.map((o) => ({ nome: `${o.origem_tipo}: ${o.origem_valor}`, total: o.acessos })), 'Origem', 'Acessos')}
        </div>

        <div class="ui-card">
          <h3 style="margin-top:0;">Páginas mais acessadas (últimos ${payload.janela_origens_dias || 30} dias)</h3>
          ${tabela(paginas.map((p) => ({ nome: p.path, total: p.acessos })), 'Página', 'Acessos')}
        </div>
      `;
    } catch (error) {
      console.error('[estatisticas] falha ao carregar', error);
      mount.innerHTML = '<div class="ui-card"><p>Não foi possível carregar as estatísticas no momento.</p></div>';
    }
  }

  global.EstatisticasGestao = { inicializarEstatisticas };
})(typeof window !== 'undefined' ? window : globalThis);
