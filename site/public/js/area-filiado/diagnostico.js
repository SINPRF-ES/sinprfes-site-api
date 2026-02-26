/**
 * Módulo de Diagnóstico do Sistema (SINPRF-ES)
 * Paridade com a tela de Logs/Diagnóstico do App.
 */
(function (root) {
  'use strict';

  const Diagnostico = {
    inicializar() {
      console.log("Diagnóstico: Inicializando módulo...");
      this.render();
    },

    async render() {
      const container = document.getElementById("diagnostico-conteudo");
      if (!container) return;

      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px;">
            <div class="ui-card" style="padding:15px; border-left:4px solid var(--azul-fundo);">
                <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:#666;">Saúde do Push</h4>
                <div id="push-health-status">Carregando...</div>
            </div>
            <div class="ui-card" style="padding:15px; border-left:4px solid var(--ui-secondary);">
                <h4 style="margin:0 0 10px 0; font-size:0.9rem; color:#666;">Versão do Sistema</h4>
                <div style="font-size:1.2rem; font-weight:bold;">v1.0.0 (Canon)</div>
                <div style="font-size:0.8rem; color:#888; margin-top:5px;">Railway Runtime</div>
            </div>
          </div>

          <div class="ui-card" style="padding:15px;">
            <h4 style="margin:0 0 15px 0;">Checklist de Integridade</h4>
            <div id="health-checklist" style="display:flex; flex-direction:column; gap:10px;">
                <p>Consultando backend...</p>
            </div>
          </div>

          <div style="text-align:right;">
             <button id="btn-refresh-diagnostico" class="ui-button ui-button-outline ui-button-sm">🔄 Atualizar</button>
          </div>
        </div>
      `;

      const btnRefresh = document.getElementById("btn-refresh-diagnostico");
      if (btnRefresh) {
        btnRefresh.onclick = () => this.carregarSaude();
      }

      await this.carregarSaude();
    },

    async carregarSaude() {
      const pushStatusEl = document.getElementById("push-health-status");
      const checklistEl = document.getElementById("health-checklist");

      try {
        const res = await window.Api.apiFetch("/api/push/health");
        const data = await res.json();

        if (data.success && data.checklist) {
          const { checklist } = data;

          pushStatusEl.innerHTML = `
            <div style="font-size:1.5rem; font-weight:bold; color: ${checklist.hasTokens ? 'green' : 'red'};">
                ${checklist.hasTokens ? '✅ Operacional' : '❌ Atenção'}
            </div>
            <div style="font-size:0.85rem; color:#666; margin-top:5px;">
                ${checklist.token_count_valid} tokens válidos encontrados.
            </div>
          `;

          checklistEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; padding:8px; background:#f9f9f9; border-radius:6px;">
                <span>${checklist.hasTokens ? '✅' : '❌'}</span>
                <div style="flex:1;">
                    <strong>Tokens de Push:</strong> ${checklist.token_count_valid} ativos de ${checklist.token_count_total} totais.
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px; padding:8px; background:#f9f9f9; border-radius:6px;">
                <span>${checklist.missing_project_id === 0 ? '✅' : '⚠️'}</span>
                <div style="flex:1;">
                    <strong>Tokens sem Project ID:</strong> ${checklist.missing_project_id} (Podem falhar no envio).
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px; padding:8px; background:#f9f9f9; border-radius:6px;">
                <span>✅</span>
                <div style="flex:1;">
                    <strong>Backend Connectivity:</strong> Database operacional.
                </div>
            </div>
          `;
        } else {
          throw new Error("Resposta inválida do servidor.");
        }
      } catch (err) {
        console.error("Erro ao carregar saúde:", err);
        pushStatusEl.innerHTML = '<span style="color:red;">Falha ao carregar</span>';
        checklistEl.innerHTML = `<p style="color:red;">Erro: ${err.message}</p>`;
      }
    }
  };

  root.Diagnostico = Diagnostico;

})(window);
