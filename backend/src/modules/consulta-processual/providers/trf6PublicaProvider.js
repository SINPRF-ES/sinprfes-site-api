const PjeConsultaPublicaBaseProvider = require('./PjeConsultaPublicaBaseProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { parseTrf1Rows } = require('../parsers/trf1ProcessParser');

class Trf6PublicaProvider extends PjeConsultaPublicaBaseProvider {
  getId() { return 'trf6'; }
  getLabel() { return 'TRF6'; }
  isEnabled() { return getConsultaProcessualConfig().trf6Enabled; }
  getBaseUrl() { return 'https://pje.trf6.jus.br/pje/ConsultaPublica/listView.seam'; }
  getParser() { return parseTrf1Rows; }
}

module.exports = Trf6PublicaProvider;
