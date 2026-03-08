const PjeConsultaPublicaBaseProvider = require('./PjeConsultaPublicaBaseProvider');
const { getConsultaProcessualConfig } = require('../utils/consultaProcessualConfig');
const { createPjeParser } = require('../parsers/pjeProcessParser');

class Trf3PublicaProvider extends PjeConsultaPublicaBaseProvider {
  getId() { return 'trf3'; }
  getLabel() { return 'TRF3'; }
  isEnabled() { return getConsultaProcessualConfig().trf3Enabled; }

  getMaturityStatus() { return 'experimental'; }

  classifyError(err) {
    if (/ERR_HTTP2_PROTOCOL_ERROR/i.test(String(err?.message || ''))) {
      return {
        code: 'HTTP2_HANDSHAKE_ISSUE',
        message: err.message,
        stage: 'transport_blocked',
      };
    }
    return super.classifyError(err);
  }

  getBaseUrl() {
    return 'https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam';
  }

  getParser() {
    return createPjeParser(this.getId(), this.getLabel());
  }
}

module.exports = Trf3PublicaProvider;
