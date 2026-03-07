class ConsultaProcessualProvider {
  getId() {
    throw new Error('Provider must implement getId()');
  }

  getLabel() {
    throw new Error('Provider must implement getLabel()');
  }

  isEnabled() {
    return true;
  }

  async consultarPorCpf(_ctx) {
    throw new Error('Provider must implement consultarPorCpf()');
  }
}

module.exports = ConsultaProcessualProvider;
