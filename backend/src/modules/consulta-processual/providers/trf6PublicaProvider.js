const PjeConsultaPublicaBaseProvider = require('./PjeConsultaPublicaBaseProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { createPjeParser } = require('../parsers/pjeProcessParser');

class Trf6PublicaProvider extends PjeConsultaPublicaBaseProvider {
  getId() { return 'trf6'; }
  getLabel() { return 'TRF6'; }
  isEnabled() { return getConsultaProcessualConfig().trf6Enabled !== false; }

  getBaseUrl() {
    return 'https://pje.trf6.jus.br/pje/ConsultaPublica/listView.seam';
  }

  getParser() {
    return createPjeParser(this.getId(), this.getLabel());
  }
}

module.exports = Trf6PublicaProvider;
