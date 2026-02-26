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
          <!-- Resumo de Saúde -->
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

          <!-- Ações -->
          <div class="ui-card" style="padding:15px; display:flex; flex-direction:column; gap:10px;">
             <label for="diagnostico-push-body" style="font-size:0.85rem; color:#555;">Mensagem do teste push (opcional)</label>
             <textarea id="diagnostico-push-body" class="ui-textarea" rows="3" maxlength="240" placeholder="Se vazio, será usado um texto padrão automático."></textarea>
             <div style="display:flex; gap:10px; justify-content:flex-end;">
             <button id="btn-test-push-self" class="ui-button ui-button-primary ui-button-sm" style="background-color: var(--ui-success); border-color: var(--ui-success);">
                <span class="btn-text">🚀 Testar Push (em mim)</span>
                <span class="btn-loader" style="display:none;">⌛ Enviando...</span>
             </button>
             <button id="btn-refresh-diagnostico" class="ui-button ui-button-outline ui-button-sm">🔄 Atualizar</button>
             </div>
             <div id="diagnostico-push-test-result" style="display:none; font-size:0.85rem; padding:10px; border-radius:6px; border:1px solid var(--ui-border); background:var(--ui-bg);"></div>
          </div>

          <!-- Checklist -->
          <div class="ui-card" style="padding:15px;">
            <h4 style="margin:0 0 15px 0;">Checklist de Integridade Global</h4>
            <div id="health-checklist" style="display:flex; flex-direction:column; gap:10px;">
                <p>Consultando backend...</p>
            </div>
          </div>

          <!-- Meus Tokens (Paridade com App) -->
          <div class="ui-card" style="padding:15px;">
            <h4 style="margin:0 0 15px 0;">Meus Dispositivos / Tokens</h4>
            <div id="meus-tokens-container" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:15px;">
                <p>Carregando tokens...</p>
            </div>
          </div>

          <div class="ui-card" style="padding:15px; background-color: #f8f9fa; border-left: 4px solid #666;">
            <div style="display:flex; gap:10px; align-items: flex-start;">
                <span style="font-size: 1.2rem;">ℹ️</span>
                <p style="margin:0; font-size: 0.85rem; color: #555; line-height: 1.4;">
                    <strong>Dica de Suporte:</strong> Se você não estiver recebendo notificações no App, verifique se o "Projeto ID" do seu token ativo coincide com o ID configurado no EAS (Expo).
                    Tokens sem Project ID são automaticamente desativados pelo backend.
                </p>
            </div>
          </div>
        </div>
      `;

      this.vincularEventos();
      await Promise.all([
        this.carregarSaude(),
        this.carregarMeusTokens()
      ]);
    },

    vincularEventos() {
      const btnRefresh = document.getElementById("btn-refresh-diagnostico");
      if (btnRefresh) {
        btnRefresh.onclick = () => {
          this.carregarSaude();
          this.carregarMeusTokens();
        };
      }

      const btnTest = document.getElementById("btn-test-push-self");
      if (btnTest) {
        btnTest.onclick = () => this.testarPushEmMim();
      }
    },

    async testarPushEmMim() {
      const btn = document.getElementById("btn-test-push-self");
      if (!btn) return;
      const text = btn.querySelector(".btn-text");
      const loader = btn.querySelector(".btn-loader");
      const resultadoEl = document.getElementById("diagnostico-push-test-result");
      const bodyInput = document.getElementById("diagnostico-push-body");

      if (btn.disabled) return;

      try {
        btn.disabled = true;
        text.style.display = "none";
        loader.style.display = "inline";

        const agora = new Date();
        const bodyDigitado = (bodyInput?.value || "").trim();
        const body = bodyDigitado || `Teste push (Diagnóstico) em ${this.formatarDataHora(agora)}`;
        if (bodyInput && !bodyDigitado) bodyInput.value = body;

        const userInfo = window.Utils?.obterUserInfo?.() || {};
        const targetValue = "self";

        const payload = {
          title: "Diagnóstico: teste",
          body,
          targetType: "FILIADO",
          targetValue,
          data: {
            source: "diagnostico_site",
            ts: new Date().toISOString()
          }
        };

        console.log("[Diagnostico.PushTest] payload enviado", {
          keys: Object.keys(payload),
          bodyPreview: body.slice(0, 40),
          targetType: payload.targetType,
          targetValue,
          actor: {
            id: userInfo.id ?? userInfo.filiado_id ?? userInfo.user_id ?? null,
            nome: String(userInfo.nome || "").trim(),
            cpfMasked: this.mascararCpf(userInfo.cpf)
          }
        });

        const res = await window.Api.apiFetch("/api/push/campaigns/send", {
          method: "POST",
          body: payload
        });

        const data = await res.json().catch(() => ({}));
        const requestId = data?.requestId || res.headers.get("x-request-id") || "N/A";
        const status = res.status;
        const infoBase = `HTTP ${status} | requestId: ${requestId} | success: ${!!data.success} | sent: ${Number(data.sent || 0)} | failed: ${Number(data.failed || 0)} | noTokenOrDenied: ${Number(data.noTokenOrDenied || 0)}`;

        if (res.ok && data.success) {
          if (resultadoEl) {
            resultadoEl.style.display = "block";
            resultadoEl.style.borderColor = "var(--ui-success)";
            resultadoEl.innerHTML = `<strong>✅ Push de diagnóstico enviado.</strong><br>${infoBase}`;
          }
        } else {
          const bodyError = data?.errors?.body;
          const detalhe = (res.status === 400 && bodyError)
            ? `Falha de validação: body obrigatório`
            : (data.message || "Erro desconhecido");
          if (resultadoEl) {
            resultadoEl.style.display = "block";
            resultadoEl.style.borderColor = "var(--ui-danger)";
            resultadoEl.innerHTML = `<strong>❌ ${detalhe}</strong><br>${infoBase}`;
          }
        }
      } catch (err) {
        console.error("Erro ao testar push:", err);
        if (resultadoEl) {
          resultadoEl.style.display = "block";
          resultadoEl.style.borderColor = "var(--ui-danger)";
          resultadoEl.innerHTML = `<strong>❌ Erro técnico ao solicitar envio de push.</strong><br>${err.message}`;
        }
      } finally {
        btn.disabled = false;
        text.style.display = "inline";
        loader.style.display = "none";
      }
    },

    formatarDataHora(date) {
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    },

    mascararCpf(cpf) {
      const digits = String(cpf || "").replace(/\D+/g, "");
      if (!digits) return "";
      if (digits.length <= 4) return `***${digits}`;
      return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
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
            <div style="font-size:1.5rem; font-weight:bold; color: ${checklist.hasTokens ? 'var(--ui-success)' : 'var(--ui-danger)'};">
                ${checklist.hasTokens ? '✅ Operacional' : '❌ Atenção'}
            </div>
            <div style="font-size:0.85rem; color:#666; margin-top:5px;">
                ${checklist.token_count_valid} tokens válidos encontrados.
            </div>
          `;

          checklistEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; padding:10px; background:var(--ui-bg); border-radius:6px; border: 1px solid var(--ui-border);">
                <span style="font-size:1.2rem;">${checklist.hasTokens ? '✅' : '❌'}</span>
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:0.9rem;">Tokens de Push</div>
                    <div style="font-size:0.8rem; color:#666;">${checklist.token_count_valid} ativos de ${checklist.token_count_total} totais no scope SINDICATO.</div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px; padding:10px; background:#f9f9f9; border-radius:6px; border: 1px solid #eee;">
                <span style="font-size:1.2rem;">${checklist.missing_project_id === 0 ? '✅' : '⚠️'}</span>
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:0.9rem;">Configuração EAS (Project ID)</div>
                    <div style="font-size:0.8rem; color:#666;">${checklist.missing_project_id} tokens órfãos detectados (sem Project ID).</div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px; padding:10px; background:#f9f9f9; border-radius:6px; border: 1px solid #eee;">
                <span style="font-size:1.2rem;">✅</span>
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:0.9rem;">Conectividade Backend</div>
                    <div style="font-size:0.8rem; color:#666;">Banco de dados e API em conformidade com Railway Runtime.</div>
                </div>
            </div>
          `;
        } else {
          throw new Error(data.message || "Resposta inválida do servidor.");
        }
      } catch (err) {
        console.error("Erro ao carregar saúde:", err);
        if (pushStatusEl) pushStatusEl.innerHTML = '<span style="color:#e74c3c;">Falha ao carregar</span>';
        if (checklistEl) checklistEl.innerHTML = `<p style="color:#e74c3c; font-size:0.8rem;">Erro: ${err.message}</p>`;
      }
    },

    async carregarMeusTokens() {
      const container = document.getElementById("meus-tokens-container");
      if (!container) return;

      try {
        const res = await window.Api.apiFetch("/api/push/diagnostics/me");
        const data = await res.json();

        if (data.success && data.tokens) {
          if (data.tokens.length === 0) {
            container.innerHTML = `<p style="color:#999; font-style:italic; grid-column: 1/-1;">Nenhum dispositivo registrado para receber notificações.</p>`;
            return;
          }

          container.innerHTML = data.tokens.map((t, idx) => {
            const isRevoked = !!t.revoked_at;
            const isDisabled = !!t.disabled_at;
            const isActive = !isRevoked && !isDisabled;
            const statusColor = isActive ? 'var(--ui-success)' : 'var(--ui-danger)';
            const statusText = isActive ? 'ATIVO' : (isRevoked ? 'REVOGADO' : 'DESATIVADO');

            return `
              <div style="padding:12px; border:1px solid var(--ui-border); border-radius:8px; background:var(--ui-surface); border-left: 4px solid ${isActive ? 'var(--ui-primary)' : 'var(--ui-border)'}; opacity: ${isActive ? 1 : 0.7}">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-weight:bold; font-size:0.85rem; color:var(--ui-text);">Dispositivo #${idx + 1}</span>
                    <span style="font-size:0.7rem; font-weight:bold; color:var(--ui-primary-contrast); background:${statusColor}; padding:2px 6px; border-radius:4px;">${statusText}</span>
                </div>

                <div style="font-family:monospace; font-size:0.75rem; color:#666; background:#f4f4f4; padding:5px; border-radius:4px; margin-bottom:8px; word-break:break-all;">
                    ${t.expo_push_token}
                </div>

                <div style="display:grid; grid-template-columns: 80px 1fr; gap:4px; font-size:0.75rem;">
                    <span style="color:var(--ui-text-muted);">Scope:</span>
                    <span style="color:var(--ui-text); font-weight:500;">${t.app_scope || 'N/A'}</span>

                    <span style="color:var(--ui-text-muted);">Projeto:</span>
                    <span style="color:var(--ui-text); font-weight:500;">${t.expo_project_id || t.project_id || 'N/A'}</span>

                    <span style="color:var(--ui-text-muted);">Plataforma:</span>
                    <span style="color:var(--ui-text); font-weight:500;">${t.platform || 'N/A'}</span>

                    ${isDisabled ? `
                        <span style="color:var(--ui-text-muted);">Motivo:</span>
                        <span style="color:var(--ui-danger); font-weight:500;">${t.disabled_reason || 'Desconhecido'}</span>
                    ` : ''}
                </div>

                <div style="text-align:right; font-size:0.65rem; color:#aaa; margin-top:8px;">
                    Visto em: ${new Date(t.last_seen).toLocaleString('pt-BR')}
                </div>
              </div>
            `;
          }).join('');
        } else {
          throw new Error(data.message || "Erro ao carregar tokens.");
        }
      } catch (err) {
        console.error("Erro ao carregar meus tokens:", err);
        container.innerHTML = `<p style="color:#e74c3c; font-size:0.8rem; grid-column: 1/-1;">Erro ao carregar lista de dispositivos: ${err.message}</p>`;
      }
    }
  };

  root.Diagnostico = Diagnostico;

})(window);
