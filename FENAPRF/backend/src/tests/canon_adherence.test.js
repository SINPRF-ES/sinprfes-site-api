const assert = require('assert');
const Canon = require('../../shared/canon');

describe('Canon Adherence Tests', () => {

    describe('Enums', () => {
        it('should have all ASSEMBLEIA_ESTADOS', () => {
            const expected = ['CRIADO', 'EM_CREDENCIAMENTO', 'INICIADO', 'SUSPENSA', 'ENCERRADO'];
            expected.forEach(state => {
                assert.strictEqual(Canon.ASSEMBLEIA_ESTADOS[state], state);
            });
        });

        it('should have ASSEMBLEIA_VOTACAO_STATUS', () => {
            assert.strictEqual(Canon.ASSEMBLEIA_VOTACAO_STATUS.ATIVA, 'ATIVA');
            assert.strictEqual(Canon.ASSEMBLEIA_VOTACAO_STATUS.ENCERRADA, 'ENCERRADA');
        });
    });

    describe('RBAC', () => {
        const admin = { perfil_acesso: 'ADMIN' };
        const diretoria = { perfil_acesso: 'DIRETORIA', cargo: 'Diretor de Finanças' };
        const conselheiro = { perfil_acesso: 'CONSELHEIRO', cargo: 'Delegado Representante', uf: 'ES' };
        const presidenteFenaprf = { perfil_acesso: 'DIRETORIA', cargo: 'Presidente da FENAPRF' };
        const viceFenaprf = { perfil_acesso: 'DIRETORIA', cargo: 'Vice-Presidente da FENAPRF' };
        const diretorSec = { perfil_acesso: 'DIRETORIA', cargo: 'Diretor de Secretaria' };

        it('canCreateCredenciamentoToken should follow rules', () => {
            assert.strictEqual(Canon.canCreateCredenciamentoToken(presidenteFenaprf), true);
            assert.strictEqual(Canon.canCreateCredenciamentoToken(viceFenaprf), true);
            assert.strictEqual(Canon.canCreateCredenciamentoToken(diretorSec), true);
            assert.strictEqual(Canon.canCreateCredenciamentoToken(diretoria), false);
            assert.strictEqual(Canon.canCreateCredenciamentoToken(conselheiro), false);
        });

        it('canViewCredenciamentoToken should allow all Gestão', () => {
            assert.strictEqual(Canon.canViewCredenciamentoToken(admin), true);
            assert.strictEqual(Canon.canViewCredenciamentoToken(diretoria), true);
            assert.strictEqual(Canon.canViewCredenciamentoToken({ perfil_acesso: 'COLABORADOR' }), true);
            assert.strictEqual(Canon.canViewCredenciamentoToken(conselheiro), false);
        });

        it('canRequestPalavra should allow Diretoria and Conselheiro', () => {
            assert.strictEqual(Canon.canRequestPalavra(diretoria), true);
            assert.strictEqual(Canon.canRequestPalavra(conselheiro), true);
            assert.strictEqual(Canon.canRequestPalavra(admin), false);
        });

        it('isCouncilMember should include Conselheiros and Pres/Vice FENAPRF', () => {
            assert.strictEqual(Canon.isCouncilMember(conselheiro), true);
            assert.strictEqual(Canon.isCouncilMember(presidenteFenaprf), true);
            assert.strictEqual(Canon.isCouncilMember(viceFenaprf), true);
            assert.strictEqual(Canon.isCouncilMember(diretorSec), false);
        });
    });

    describe('Hierarchy and Branch', () => {
        const presES = { id: '1', cargo: 'Presidente', uf: 'ES', perfil_acesso: 'CONSELHEIRO' };
        const viceES = { id: '2', cargo: 'Vice-Presidente', uf: 'ES', perfil_acesso: 'CONSELHEIRO' };
        const drES = { id: '3', cargo: 'Delegado Representante', uf: 'ES', perfil_acesso: 'CONSELHEIRO' };

        const presRJ = { id: '4', cargo: 'Presidente', uf: 'RJ', perfil_acesso: 'CONSELHEIRO' };

        it('obterInfoBranchUser should return correct metadata', () => {
            const info = Canon.obterInfoBranchUser(presES);
            assert.strictEqual(info.branch, 'CONSELHO');
            assert.strictEqual(info.uf, 'ES');
            assert.strictEqual(info.rank, 1);
            assert.strictEqual(info.branchKey, 'CONSELHO:ES');
        });

        it('getBranchKey should work', () => {
            assert.strictEqual(Canon.getBranchKey(presES), 'CONSELHO:ES');
            assert.strictEqual(Canon.getBranchKey(viceES), 'CONSELHO:ES');
            assert.strictEqual(Canon.getBranchKey(presRJ), 'CONSELHO:RJ');
        });

        it('isSuperiorBranch should correctly compare ranks within same branch', () => {
            assert.strictEqual(Canon.isSuperiorBranch(presES, viceES), true);
            assert.strictEqual(Canon.isSuperiorBranch(viceES, presES), false);
            // Different branches or different UFs should return false as they are not "superior" in the same ramo
            assert.strictEqual(Canon.isSuperiorBranch(presES, presRJ), false);
        });

        it('compareBranchRank should work', () => {
            assert.strictEqual(Canon.compareBranchRank(presES, viceES), -1);
            assert.strictEqual(Canon.compareBranchRank(viceES, presES), 1);
            assert.strictEqual(Canon.compareBranchRank(presES, presES), 0);
        });
    });
});
