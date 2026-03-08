const PjeConsultaPublicaBaseProvider = require('./PjeConsultaPublicaBaseProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { createPjeParser } = require('../parsers/pjeProcessParser');

class Trf6PublicaProvider extends PjeConsultaPublicaBaseProvider {
  getId() { return 'trf6'; }
  getLabel() { return 'TRF6'; }
  isEnabled() { return getConsultaProcessualConfig().trf6Enabled; }

  getMaturityStatus() {
    return this.isEnabled() ? 'experimental' : 'disabled';
  }

  classifyError(err) {
    if (/ERR_NAME_NOT_RESOLVED/i.test(String(err?.message || ''))) {
      return {
        code: 'PROVIDER_ENDPOINT_UNRESOLVED',
        message: err.message,
        stage: 'dns_resolution',
      };
    }
    return super.classifyError(err);
  }

  getBaseUrl() {
    return 'https://pje.trf6.jus.br/pje/ConsultaPublica/listView.seam';
  }

  getParser() {
    return createPjeParser(this.getId(), this.getLabel());
  }
}

module.exports = Trf6PublicaProvider;
