const PjeConsultaPublicaBaseProvider = require('./PjeConsultaPublicaBaseProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { createPjeParser } = require('../parsers/pjeProcessParser');

class Trf1PublicaProvider extends PjeConsultaPublicaBaseProvider {
  getId() { return 'trf1'; }
  getLabel() { return 'TRF1'; }
  isEnabled() { return getConsultaProcessualConfig().trf1Enabled; }

  getMaturityStatus() { return 'stable'; }

  getBaseUrl() {
    return 'https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam';
  }

  getParser() {
    return createPjeParser(this.getId(), this.getLabel());
  }

  getSearchTimeoutMs(cfg) {
    return Math.max(cfg.searchTimeoutMs, 30000);
  }

  getWaitPollIntervalMs() {
    return 350;
  }
}

module.exports = Trf1PublicaProvider;
