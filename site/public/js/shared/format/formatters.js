/**
 * Utilitários de formatação para o Frontend (Site).
 * Sincronizado com mobile/src/shared/formatters.ts e mobile/src/utils/date.ts
 * Carregado como script clássico (window.Formatters)
 */

(function (global) {
  if (global.Formatters) return;

  const Formatters = {
    onlyDigits: function (text) {
      if (!text) return '';
      return String(text).replace(/\D/g, '');
    },

    formatCpf: function (cpf) {
      if (!cpf) return '';
      const digits = this.onlyDigits(cpf);
      if (digits.length !== 11) return digits;
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    },

    formatTelefone: function (tel) {
      if (!tel) return '';
      const digits = this.onlyDigits(tel);
      if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
      }
      if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      }
      return digits;
    },

    formatCep: function (cep) {
      if (!cep) return '';
      const digits = this.onlyDigits(cep);
      if (digits.length !== 8) return digits;
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    },

    /**
     * Converte ISO (YYYY-MM-DD...) para BR (DD/MM/YYYY)
     */
    formatISOToBR: function (isoStr) {
      if (!isoStr) return "";
      try {
        const datePart = String(isoStr).split('T')[0];
        const parts = datePart.split('-');
        if (parts.length !== 3) return isoStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      } catch (e) {
        return isoStr;
      }
    },

    /**
     * Converte BR (DD/MM/YYYY) para ISO (YYYY-MM-DD)
     */
    parseBRToISO: function (brStr) {
      if (!brStr) return null;
      const parts = brStr.split('/');
      if (parts.length !== 3) return null;
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    },

    /**
     * Converte qualquer formato reconhecido para ISO (YYYY-MM-DD)
     * Útil para o value de <input type="date">
     */
    toDateInputValue: function (v) {
      if (!v) return "";
      const s = String(v).trim();
      // dd/MM/yyyy
      const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (mBr) return `${mBr[3]}-${mBr[2]}-${mBr[1]}`;
      // yyyy-MM-dd
      const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
      return "";
    },

    formatAgencia: function (agencia) {
      if (!agencia) return '';
      const digits = this.onlyDigits(agencia).slice(0, 5);
      if (digits.length < 5) return digits;
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    },

    formatConta: function (conta) {
      if (!conta) return '';
      const digits = this.onlyDigits(conta).slice(0, 6);
      if (digits.length < 6) return digits;
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    },

    /**
     * Formata CPF em tempo real (LIVE MASK) para inputs.
     * XXX.XXX.XXX-XX
     */
    formatCpfLive: function (val) {
      if (!val) return '';
      let v = String(val).replace(/\D/g, "").slice(0, 11);
      if (v.length <= 3) return v;
      if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
      if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
      return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
    },

    applyMaskAgencia: function (el) {
      if (!el) return;
      const format = () => { el.value = this.formatAgencia(el.value); };
      el.addEventListener('input', format);
      format();
    },

    sanitizeToCentavos: function (input) {
      const digits = this.onlyDigits(input);
      const normalized = digits.replace(/^0+(?=\d)/, '');
      return normalized || '0';
    },

    formatCentavosBRL: function (centavos) {
      const safeCentavos = Number(this.sanitizeToCentavos(centavos));
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(safeCentavos / 100);
    },

    applyMaskConta: function (el) {
      if (!el) return;
      const format = () => { el.value = this.formatConta(el.value); };
      el.addEventListener('input', format);
      format();
    },

    /**
     * Formata uma data para HH:MM:SS no timezone America/Sao_Paulo.
     */
    formatTimeSP: function (date) {
      if (!date) return "--:--:--";
      try {
        const d = (typeof date === 'string') ? new Date(date) : date;
        return d.toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } catch (e) {
        console.error("Formatters.formatTimeSP error", e);
        return "--:--:--";
      }
    }
  };

  // Exposição global garantida no Browser
  global.Formatters = Formatters;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
