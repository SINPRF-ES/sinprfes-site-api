const Trf1PublicaProvider = require('./trf1PublicaProvider');
const Trf3PublicaProvider = require('./trf3PublicaProvider');
const Trf5PublicaProvider = require('./trf5PublicaProvider');
const Trf6PublicaProvider = require('./trf6PublicaProvider');

// Baseline congelado de providers:
// - trf1: stable (referência oficial)
// - trf3/trf5: experimental
// - trf6: disabled por padrão
// Providers fora do baseline não devem alterar a semântica principal do módulo.
function buildConsultaProviders() {
  return [
    new Trf1PublicaProvider(),
    new Trf3PublicaProvider(),
    new Trf5PublicaProvider(),
    new Trf6PublicaProvider(),
  ];
}

module.exports = { buildConsultaProviders };
