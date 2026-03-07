const Trf1PublicaProvider = require('./trf1PublicaProvider');

function buildConsultaProviders() {
  return [new Trf1PublicaProvider()];
}

module.exports = { buildConsultaProviders };
