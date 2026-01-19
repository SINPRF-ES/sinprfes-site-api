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
    }
  };

  // Exposição global garantida no Browser
  global.Formatters = Formatters;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
