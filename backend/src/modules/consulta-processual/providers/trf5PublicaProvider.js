const PjeConsultaPublicaBaseProvider = require('./PjeConsultaPublicaBaseProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { createPjeParser } = require('../parsers/pjeProcessParser');

class Trf5PublicaProvider extends PjeConsultaPublicaBaseProvider {
  getId() { return 'trf5'; }
  getLabel() { return 'TRF5'; }
  isEnabled() { return getConsultaProcessualConfig().trf5Enabled; }

  getMaturityStatus() { return 'experimental'; }

  classifyError(err) {
    if (/Required selectors not found on home page/i.test(String(err?.message || ''))) {
      return {
        code: 'DOM_MAPPING_REQUIRED',
        message: err.message,
        stage: 'dom_diagnostics_required',
      };
    }
    return super.classifyError(err);
  }

  getBaseUrl() {
    return 'https://pje.trf5.jus.br/pje/ConsultaPublica/listView.seam';
  }

  getParser() {
    return createPjeParser(this.getId(), this.getLabel());
  }
}

module.exports = Trf5PublicaProvider;
