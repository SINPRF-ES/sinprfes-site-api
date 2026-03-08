const PjeConsultaPublicaBaseProvider = require('./PjeConsultaPublicaBaseProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { parseTrf1Rows } = require('../parsers/trf1ProcessParser');

class Trf5PublicaProvider extends PjeConsultaPublicaBaseProvider {
  getId() { return 'trf5'; }
  getLabel() { return 'TRF5'; }
  isEnabled() { return getConsultaProcessualConfig().trf5Enabled; }
  getBaseUrl() { return 'https://pje.trf5.jus.br/pje/ConsultaPublica/listView.seam'; }
  getParser() { return parseTrf1Rows; }
}

module.exports = Trf5PublicaProvider;
