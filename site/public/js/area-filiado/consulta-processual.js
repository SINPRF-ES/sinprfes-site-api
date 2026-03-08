(function (global) {
  if (global.ConsultaProcessual) return;

  function escapeHtml(v) {
    if (global.Utils && global.Utils.escapeHTML) return global.Utils.escapeHTML(v);
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateTime(v) {
    if (!v) return '-';
    const dt = new Date(v);
    if (Number.isNaN(dt.getTime())) return '-';
    return dt.toLocaleString('pt-BR');
  }

  function getUserInfo() {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || '{}') || {};
    } catch (_err) {
      return {};
    }
  }

  function hasDiretoriaPermission() {
    const info = getUserInfo();
    const perfil = String(info.perfil_acesso || info.perfil || info.role || '').toUpperCase();
    return perfil === 'ADMIN' || perfil === 'DIRETORIA';
  }

  function hasDebugPermission() {
    const info = getUserInfo();
    const perfil = String(info.perfil_acesso || info.perfil || info.role || '').toUpperCase();
    const perms = Array.isArray(info.permissions) ? info.permissions : [];
    return perfil === 'ADMIN' || perfil === 'DIRETORIA' || perms.includes('*') || perms.includes('EDIT_CONTENT');
  }

  function renderTable(items) {
    if (!items.length) {
      return '<div class="ui-card"><p>Nenhum processo encontrado.</p></div>';
    }

    const rows = items.map((item) => `
      <tr>
        <td class="cell-center">
          <span class="filiado-badge badge-ativo">${escapeHtml(item.sourceLabel || item.source || '-')}</span>
          ${item.isSindicato ? '<br><span class="filiado-badge" style="background-color:#555; color:#fff; font-size:10px; margin-top:4px;">SINDICATO</span>' : ''}
        </td>
        <td class="cell-process-number">${escapeHtml(item.processNumber || '-')}</td>
        <td class="cell-process-class">${escapeHtml(item.processClass || '-')}</td>
        <td class="cell-wrap">${escapeHtml(item.parties || '-')}</td>
        <td class="cell-wrap">${escapeHtml(item.listLastMovementText || item.lastMovement || '-')}</td>
        <td class="cell-center cell-datetime">${escapeHtml(formatDateTime(item.listLastMovementAt || item.lastMovementAt))}</td>
        <td class="cell-center">${item.detailsUrl ? `<a class="ui-button ui-button-outline" target="_blank" rel="noopener noreferrer" href="${escapeHtml(item.detailsUrl)}">Abrir origem</a>` : '-'}</td>
      </tr>
    `).join('');

    return `
      <div class="consulta-processual-table-wrap ui-card">
        <table class="consulta-processual-table">
          <thead>
            <tr>
              <th>Origem</th>
              <th>Número do processo</th>
              <th>Classe</th>
              <th>Partes</th>
              <th>Última movimentação</th>
              <th>Data/Hora</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderDebugSummary(report) {
    if (!report) return '<p>Sem relatório de debug.</p>';

    const sourceCards = (report.sourceReports || []).map((src) => {
      return `
        <div class="ui-card" style="padding:10px; border-left:4px solid ${src.failureStage ? '#d35400' : '#2ecc71'};">
          <div><strong>Fonte:</strong> ${escapeHtml(src.source || '-')} (${escapeHtml(src.status || '-')})</div>
          <div><strong>Falha provável:</strong> ${escapeHtml(src.failureStage || 'não identificada')}</div>
          <div><strong>Resultados declarados:</strong> ${escapeHtml(String(src.metrics?.declaredResultsCount || 0))}</div>
          <div><strong>Links:</strong> ${escapeHtml(String(src.metrics?.linksFound || 0))} | <strong>CNJ:</strong> ${escapeHtml(String(src.metrics?.cnjMatchesFound || 0))}</div>
          <div><strong>Blocos brutos:</strong> ${escapeHtml(String(src.metrics?.rawBlocksFound || 0))} | <strong>Normalizados:</strong> ${escapeHtml(String(src.metrics?.normalizedItemsCount || 0))}</div>
          <div><strong>Detalhes abertos:</strong> ${escapeHtml(String(src.metrics?.detailPagesOpened || 0))}</div>
          <div><strong>Descartes:</strong> ${escapeHtml(JSON.stringify(src.discardReasons || {}))}</div>
          <div><strong>Artefatos:</strong> ${escapeHtml(String(src.artifactsCount || 0))}</div>
        </div>
      `;
    }).join('');

    const timelineRows = (report.timeline || []).slice(0, 400).map((ev) => `
      <tr>
        <td>${escapeHtml(ev.type || '-')}</td>
        <td>${escapeHtml(ev.source || '-')}</td>
        <td>${escapeHtml(ev.step || '-')}</td>
        <td>${escapeHtml(ev.reason || '-')}</td>
      </tr>
    `).join('');

    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="ui-card" style="padding:10px;">
          <strong>Conclusão consolidada:</strong> ${escapeHtml(report.likelyFailureStage || 'não determinada')}
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:10px;">${sourceCards || '<p>Sem fontes no relatório.</p>'}</div>
        <div class="ui-card" style="padding:10px; overflow:auto; max-height:360px;">
          <h4 style="margin-top:0;">Timeline consolidada (steps + warnings)</h4>
          <table class="consulta-processual-table" style="min-width:680px;">
            <thead><tr><th>Tipo</th><th>Fonte</th><th>Etapa</th><th>Motivo</th></tr></thead>
            <tbody>${timelineRows || '<tr><td colspan="4">Sem eventos.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function ensureDebugArea() {
    const root = document.getElementById('consulta-processual-debug');
    if (root) return root;
    const output = document.getElementById('consulta-processual-output');
    if (!output) return null;

    const wrapper = document.createElement('div');
    wrapper.id = 'consulta-processual-debug';
    wrapper.style.marginTop = '12px';
    output.insertAdjacentElement('afterend', wrapper);
    return wrapper;
  }

  async function executarConsulta() {
    const feedback = document.getElementById('consulta-processual-feedback');
    const output = document.getElementById('consulta-processual-output');
    const lastUpdated = document.getElementById('consulta-processual-last-updated');
    const modeSelector = document.getElementById('consulta-processual-mode');
    const mode = modeSelector ? modeSelector.value : 'personal';

    if (!feedback || !output) return;

    feedback.textContent = 'Consultando fontes públicas...';
    output.innerHTML = '<div class="ui-card"><p>Consultando...</p></div>';

    try {
      const response = await global.Api.apiFetch(`/api/consulta-processual/me?mode=${mode}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        const msg = data.message || data.error || 'Portal indisponível no momento.';
        feedback.textContent = msg;
        output.innerHTML = `<div class="ui-card"><p>${escapeHtml(msg)}</p></div>`;
        return;
      }

      const items = Array.isArray(data.items)
        ? data.items.filter((item) => item && item.processNumber)
        : [];
      const totalItems = Number.isFinite(Number(data.totalItems)) ? Number(data.totalItems) : items.length;

      console.log('consulta-processual response', data);

      const providerErrors = (data.sources || []).filter((s) => s.status === 'error');
      if (providerErrors.length > 0 && items.length === 0) {
        feedback.textContent = 'Falha temporária em todas as fontes consultadas.';
      } else {
        const docLabel = mode === 'institutional' ? 'CNPJ' : 'CPF';
        feedback.textContent = `Consulta concluída: ${totalItems} processo(s) encontrado(s). ${docLabel}: ${data.cpfMasked || '***'}`;
      }

      if (lastUpdated) {
        lastUpdated.textContent = `Última atualização: ${formatDateTime(data.queriedAt)}`;
      }

      output.innerHTML = renderTable(items);
    } catch (_err) {
      feedback.textContent = 'Erro ao consultar processos. Tente novamente em instantes.';
      output.innerHTML = '<div class="ui-card"><p>Erro temporário ao consultar os tribunais.</p></div>';
    }
  }

  async function executarDiagnosticoConsulta() {
    const feedback = document.getElementById('consulta-processual-feedback');
    const debugArea = ensureDebugArea();
    const modeSelector = document.getElementById('consulta-processual-mode');
    const mode = modeSelector ? modeSelector.value : 'personal';

    if (!debugArea || !feedback) return;

    feedback.textContent = 'Executando diagnóstico consolidado da consulta processual...';
    debugArea.innerHTML = '<div class="ui-card"><p>Gerando telemetria consolidada...</p></div>';

    try {
      const response = await global.Api.apiFetch(`/api/consulta-processual/debug/me?mode=${mode}`);
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || data.error || 'Falha na consulta de diagnóstico.');
      }

      const report = data.debugReport || null;
      const fileName = report?.export?.jsonFileName || `consulta-processual-debug-${Date.now()}.json`;

      debugArea.innerHTML = `
        <div class="ui-card" style="padding:12px; margin-bottom:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <strong>Modo diagnóstico:</strong> ativo (consolidado)
          <button id="btn-export-consulta-debug" class="ui-button ui-button-outline">⬇️ Exportar JSON</button>
        </div>
        ${renderDebugSummary(report)}
      `;

      const btnExport = document.getElementById('btn-export-consulta-debug');
      if (btnExport) {
        btnExport.addEventListener('click', () => downloadJson(fileName, data));
      }

      feedback.textContent = `Diagnóstico concluído. Estágio provável da falha: ${report?.likelyFailureStage || 'não determinado'}.`;
    } catch (err) {
      feedback.textContent = 'Falha ao executar diagnóstico consolidado.';
      debugArea.innerHTML = `<div class="ui-card"><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  function ensureModeSelector() {
    if (!hasDiretoriaPermission()) return;
    const container = document.querySelector('.consulta-processual-actions') || document.getElementById('btn-consulta-processual')?.parentElement;
    if (!container || document.getElementById('consulta-processual-mode')) return;

    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '12px';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '10px';
    wrapper.innerHTML = `
      <label for="consulta-processual-mode" style="font-weight:bold;">Modo de consulta:</label>
      <select id="consulta-processual-mode" class="ui-input" style="width:auto; margin-bottom:0;">
        <option value="personal">Consultar meus processos (CPF)</option>
        <option value="institutional">Consultar processos do sindicato (CNPJ)</option>
      </select>
    `;
    container.insertAdjacentElement('beforebegin', wrapper);
  }

  function inicializarConsultaProcessual() {
    ensureModeSelector();

    const btn = document.getElementById('btn-consulta-processual');
    const btnDebug = document.getElementById('btn-consulta-processual-debug');
    const feedback = document.getElementById('consulta-processual-feedback');
    const output = document.getElementById('consulta-processual-output');

    if (feedback) {
      feedback.textContent = 'Selecione o modo e clique em “Consultar processos” para iniciar a busca automática.';
    }
    if (output) {
      output.innerHTML = '<div class="ui-card"><p>Aguardando consulta.</p></div>';
    }

    if (btnDebug) {
      btnDebug.style.display = hasDebugPermission() ? 'inline-flex' : 'none';
    }

    if (btn && !btn.dataset.boundConsultaProcessual) {
      btn.dataset.boundConsultaProcessual = '1';
      btn.addEventListener('click', executarConsulta);
    }

    if (btnDebug && !btnDebug.dataset.boundConsultaProcessualDebug) {
      btnDebug.dataset.boundConsultaProcessualDebug = '1';
      btnDebug.addEventListener('click', executarDiagnosticoConsulta);
    }
  }

  global.ConsultaProcessual = { inicializarConsultaProcessual };
})(typeof window !== 'undefined' ? window : global);
