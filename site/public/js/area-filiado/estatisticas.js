(function (global) {
  if (global.EstatisticasGestao) return;

  function cardNumero(titulo, valor, emoji, hint = '') {
    return `
      <div class="ui-card" style="min-height:120px; display:flex; flex-direction:column; justify-content:center; gap:6px;">
        <span style="font-size:0.95rem; color:#475467;">${emoji} ${titulo}</span>
        <strong style="font-size:2rem; color:var(--azul-fundo); line-height:1;">${Number(valor || 0).toLocaleString('pt-BR')}</strong>
        ${hint ? `<small style="color:#667085;">${hint}</small>` : ''}
      </div>
    `;
  }

  function tabela(lista, col1, col2) {
    if (!Array.isArray(lista) || lista.length === 0) {
      return '<p style="color:#667085;">Sem dados para exibir.</p>';
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

  function getToken() {
    return localStorage.getItem('token') || localStorage.getItem('token_gestao') || localStorage.getItem('token_filiado');
  }

  function getApiBase() {
    return (window.Utils && window.Utils.resolveApiBase)
      ? window.Utils.resolveApiBase()
      : (window.API_BASE_URL || window.ENV_CONFIG?.API_URL || '').replace(/\/+$/, '');
  }

  async function sincronizarCloudflare() {
    const feedback = document.getElementById('estatisticas-sync-feedback');
    const token = getToken();
    if (!token) return;

    if (feedback) feedback.textContent = 'Sincronizando dados de borda (Cloudflare)...';

    try {
      const resp = await fetch(`${getApiBase()}/api/analytics/sync-cloudflare`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        }
      });

      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || payload.success === false) {
        throw new Error(payload.error || payload.reason || `HTTP ${resp.status}`);
      }

      if (feedback) feedback.textContent = 'Sincronização concluída. Atualizando painel...';
      await inicializarEstatisticas();
    } catch (error) {
      if (feedback) feedback.textContent = `Falha na sincronização: ${error.message}`;
    }
  }

  async function inicializarEstatisticas() {
    const mount = document.getElementById('estatisticas-gestao-root');
    if (!mount) return;

    mount.innerHTML = '<div class="ui-card"><p>Carregando estatísticas de acesso...</p></div>';

    const token = getToken();
    if (!token) {
      mount.innerHTML = '<div class="ui-card"><p>Sessão inválida. Faça login novamente.</p></div>';
      return;
    }

    try {
      const resp = await fetch(`${getApiBase()}/api/analytics/resumo`, {
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
      const cf = payload.cloudflare || {};
      const cfMetricas = cf.metricas || {};
      const periodoCf = (cf.recorte?.inicio && cf.recorte?.fim)
        ? `${cf.recorte.inicio} até ${cf.recorte.fim}`
        : 'aguardando sincronização';

      mount.innerHTML = `
        <div class="ui-card" style="margin-bottom:12px; display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;">
          <div>
            <h3 style="margin:0;">Painel consolidado</h3>
            <p style="margin:4px 0 0; color:#667085;">Fuso aplicado: <strong>${payload.timezone || 'America/Sao_Paulo'}</strong>. Exibição inicial: <strong>todos os dados</strong>.</p>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
            <button id="btn-estatisticas-sync-cloudflare" class="ui-button ui-button-outline" style="max-width:260px;">Sincronizar Cloudflare agora</button>
            <small id="estatisticas-sync-feedback" style="color:#667085;">Último recorte Cloudflare: ${periodoCf}</small>
          </div>
        </div>

        <h3 style="margin:0 0 8px;">Acessos registrados pelo site</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px;">
          ${cardNumero('Acessos hoje', metricas.diario, '📅')}
          ${cardNumero('Acessos no mês', metricas.mensal, '🗓️')}
          ${cardNumero('Acessos totais', metricas.total, '🌐')}
        </div>

        <h3 style="margin:0 0 8px;">Tráfego de borda (Cloudflare)</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px;">
          ${cardNumero('Requests hoje', cfMetricas.diario, '☁️')}
          ${cardNumero('Requests no mês', cfMetricas.mensal, '📆')}
          ${cardNumero('Requests totais', cfMetricas.total, '🛰️')}
          ${cardNumero('Cache hit ratio', cfMetricas.cache_hit_ratio || 0, '⚡', '% de requests servidos do cache')}
          ${cardNumero('Ameaças bloqueadas', cfMetricas.ameacas_total, '🛡️')}
        </div>

        <div class="ui-card" style="margin-bottom:12px;">
          <h3 style="margin-top:0;">Origem dos acessos (todos os dados)</h3>
          ${tabela(origens.map((o) => ({ nome: `${o.origem_tipo}: ${o.origem_valor}`, total: o.acessos })), 'Origem', 'Acessos')}
        </div>

        <div class="ui-card">
          <h3 style="margin-top:0;">Páginas mais acessadas (todos os dados)</h3>
          ${tabela(paginas.map((p) => ({ nome: p.path, total: p.acessos })), 'Página', 'Acessos')}
        </div>
      `;

      const btnSync = document.getElementById('btn-estatisticas-sync-cloudflare');
      if (btnSync) {
        btnSync.onclick = () => sincronizarCloudflare();
      }
    } catch (error) {
      console.error('[estatisticas] falha ao carregar', error);
      mount.innerHTML = '<div class="ui-card"><p>Não foi possível carregar as estatísticas no momento.</p></div>';
    }
  }

  global.EstatisticasGestao = { inicializarEstatisticas };
})(typeof window !== 'undefined' ? window : globalThis);
