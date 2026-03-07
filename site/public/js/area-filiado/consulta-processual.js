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

  function renderTable(items) {
    if (!items.length) {
      return '<div class="ui-card"><p>Nenhum processo encontrado para o CPF cadastrado.</p></div>';
    }

    const rows = items.map((item) => `
      <tr>
        <td><span class="filiado-badge badge-ativo">${escapeHtml(item.sourceLabel || item.source || '-')}</span></td>
        <td>${escapeHtml(item.processNumber || '-')}</td>
        <td>${escapeHtml(item.processClass || '-')}</td>
        <td>${escapeHtml(item.parties || '-')}</td>
        <td>${escapeHtml(item.lastMovement || '-')}</td>
        <td>${escapeHtml(formatDateTime(item.lastMovementAt))}</td>
        <td>${item.detailsUrl ? `<a class="ui-button ui-button-outline" target="_blank" rel="noopener noreferrer" href="${escapeHtml(item.detailsUrl)}">Abrir origem</a>` : '-'}</td>
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

  async function executarConsulta() {
    const feedback = document.getElementById('consulta-processual-feedback');
    const output = document.getElementById('consulta-processual-output');
    const lastUpdated = document.getElementById('consulta-processual-last-updated');

    if (!feedback || !output) return;

    feedback.textContent = 'Consultando fontes públicas...';
    output.innerHTML = '<div class="ui-card"><p>Consultando...</p></div>';

    try {
      const response = await global.Api.apiFetch('/api/consulta-processual/me');
      const data = await response.json();

      if (!response.ok || !data.ok) {
        const msg = data.message || data.error || 'Portal indisponível no momento.';
        feedback.textContent = msg;
        output.innerHTML = `<div class="ui-card"><p>${escapeHtml(msg)}</p></div>`;
        return;
      }

      const allItems = (data.sources || []).flatMap((s) => s.items || []);
      const providerErrors = (data.sources || []).filter((s) => s.status === 'error');
      if (providerErrors.length > 0 && allItems.length === 0) {
        feedback.textContent = 'Falha temporária em todas as fontes consultadas.';
      } else {
        feedback.textContent = `Consulta concluída: ${allItems.length} processo(s) encontrado(s). CPF: ${data.cpfMasked || '***'}`;
      }

      if (lastUpdated) {
        lastUpdated.textContent = `Última atualização: ${formatDateTime(data.queriedAt)}`;
      }

      output.innerHTML = renderTable(allItems);
    } catch (err) {
      feedback.textContent = 'Erro ao consultar processos. Tente novamente em instantes.';
      output.innerHTML = '<div class="ui-card"><p>Erro temporário ao consultar o TRF1.</p></div>';
    }
  }

  function inicializarConsultaProcessual() {
    const btn = document.getElementById('btn-consulta-processual');
    const feedback = document.getElementById('consulta-processual-feedback');
    const output = document.getElementById('consulta-processual-output');

    if (feedback) {
      feedback.textContent = 'Clique em “Consultar processos” para iniciar a busca automática pelo seu CPF cadastrado.';
    }
    if (output) {
      output.innerHTML = '<div class="ui-card"><p>Aguardando consulta.</p></div>';
    }

    if (btn && !btn.dataset.boundConsultaProcessual) {
      btn.dataset.boundConsultaProcessual = '1';
      btn.addEventListener('click', executarConsulta);
    }
  }

  global.ConsultaProcessual = { inicializarConsultaProcessual };
})(typeof window !== 'undefined' ? window : global);
