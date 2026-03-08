const Trf5PublicaProvider = require('./trf5PublicaProvider');

describe('Trf5PublicaProvider diagnostics heuristics', () => {
  test('rankDocumentFieldCandidates prioriza campo com CPF/CNPJ', () => {
    const provider = new Trf5PublicaProvider();
    const { documentFieldChosen } = provider.rankDocumentFieldCandidates([
      { tag: 'input', type: 'text', id: 'foo', name: 'other', placeholder: null, labelText: 'Nome', parentText: '', grandParentText: '', visible: true, bbox: { y: 300 } },
      { tag: 'input', type: 'text', id: 'doc', name: 'documentoParte', placeholder: 'CPF/CNPJ', labelText: 'CPF/CNPJ da parte', parentText: '', grandParentText: '', visible: true, bbox: { y: 220 } },
    ]);

    expect(documentFieldChosen).toBeTruthy();
    expect(documentFieldChosen.id).toBe('doc');
    expect(documentFieldChosen.score).toBeGreaterThan(70);
  });

  test('rankSearchCandidates prioriza ação de pesquisar', () => {
    const provider = new Trf5PublicaProvider();
    const { searchActionChosen } = provider.rankSearchCandidates([
      { tag: 'button', type: '', text: 'Limpar', valueMasked: null, labelText: '', name: 'clear', id: 'clear', parentText: '', visible: true, bbox: { y: 300 } },
      { tag: 'button', type: '', text: 'Pesquisar', valueMasked: null, labelText: '', name: 'search', id: 'search', parentText: '', visible: true, bbox: { y: 240 } },
    ], { bbox: { y: 210 } });

    expect(searchActionChosen).toBeTruthy();
    expect(searchActionChosen.text).toContain('Pesquisar');
    expect(searchActionChosen.score).toBeGreaterThan(60);
  });
});
