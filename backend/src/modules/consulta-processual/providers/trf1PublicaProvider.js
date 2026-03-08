const PjeConsultaPublicaBaseProvider = require('./PjeConsultaPublicaBaseProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { parseTrf1Rows } = require('../parsers/trf1ProcessParser');

class Trf1PublicaProvider extends PjeConsultaPublicaBaseProvider {
  getId() { return 'trf1'; }
  getLabel() { return 'TRF1'; }
  isEnabled() { return getConsultaProcessualConfig().trf1Enabled; }
  getBaseUrl() { return 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam'; }
  getParser() { return parseTrf1Rows; }

  async consultarPorCpf(ctx) {
    return this.consultarPorDocumento({
      document: ctx.cpf,
      documentMasked: ctx.cpfMasked,
      ...ctx
    });
  }
}

module.exports = Trf1PublicaProvider;
