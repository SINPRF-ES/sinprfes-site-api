const PjeConsultaPublicaBaseProvider = require('./PjeConsultaPublicaBaseProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { parseTrf1Rows } = require('../parsers/trf1ProcessParser');

class Trf3PublicaProvider extends PjeConsultaPublicaBaseProvider {
  getId() { return 'trf3'; }
  getLabel() { return 'TRF3'; }
  isEnabled() { return getConsultaProcessualConfig().trf3Enabled; }
  getBaseUrl() { return 'https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam'; }
  getParser() { return parseTrf1Rows; }
}

module.exports = Trf3PublicaProvider;
