const pushService = require('../services/push.service');
const pool = require('../config/db');

jest.mock('../config/db', () => ({
    query: jest.fn()
}));

describe('Push Filters Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('resolvePushTargets deve filtrar por UF', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ expo_push_token: 'token-1' }] });

        const res = await pushService.resolvePushTargets('UF', 'ES');

        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('f.uf = $1'), ['ES']);
        expect(res).toEqual(['token-1']);
    });

    test('resolvePushTargets deve filtrar por DIRETORIA', async () => {
        pool.query.mockResolvedValueOnce({ rows: [{ expo_push_token: 'token-dir' }] });

        await pushService.resolvePushTargets('DIRETORIA');

        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("f.perfil_acesso = 'DIRETORIA'"), []);
    });

    test('resolvePushTargets deve filtrar por PRESIDENTES', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });

        await pushService.resolvePushTargets('PRESIDENTES');

        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("f.cargo ILIKE 'Presidente%'"), []);
    });

    test('resolvePushTargets deve filtrar por PADRAO (Diretoria+Conselheiro)', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });

        await pushService.resolvePushTargets('PADRAO');

        expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("f.perfil_acesso IN ('DIRETORIA', 'CONSELHEIRO')"), []);
    });
});
