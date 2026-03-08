const PjeConsultaPublicaBaseProvider = require('./PjeConsultaPublicaBaseProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { createPjeParser } = require('../parsers/pjeProcessParser');

class Trf3PublicaProvider extends PjeConsultaPublicaBaseProvider {
  getId() { return 'trf3'; }
  getLabel() { return 'TRF3'; }
  isEnabled() { return getConsultaProcessualConfig().trf3Enabled !== false; }

  getBaseUrl() {
    return 'https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam';
  }

  getParser() {
    return createPjeParser(this.getId(), this.getLabel());
  }
}

module.exports = Trf3PublicaProvider;
