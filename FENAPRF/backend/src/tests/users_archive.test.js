const usersService = require('../services/users.service');
const pool = require('../config/db');

jest.mock('../config/db', () => ({
    connect: jest.fn(),
    query: jest.fn()
}));

describe('Users Archive History Service', () => {
    let mockClient;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        pool.connect.mockResolvedValue(mockClient);
    });

    test('arquivarUserPorId deve gravar na tabela user_movimentacoes', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({}) // UPDATE users
            .mockResolvedValueOnce({}) // INSERT user_movimentacoes
            .mockResolvedValueOnce({}) // COMMIT

        // Mock getMe which is called at the end
        pool.query.mockResolvedValueOnce({ rows: [{ id: 'user-123', arquivado_em: new Date() }] });

        await usersService.arquivarUserPorId('user-123', { motivo: 'Aposentadoria', atorId: 'admin-1' });

        expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO user_movimentacoes'), expect.arrayContaining(['user-123', 'admin-1', 'Aposentadoria']));
    });

    test('desarquivarUserPorId deve gravar na tabela user_movimentacoes', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({}) // UPDATE users
            .mockResolvedValueOnce({}) // INSERT user_movimentacoes
            .mockResolvedValueOnce({}) // COMMIT

        pool.query.mockResolvedValueOnce({ rows: [{ id: 'user-123', arquivado_em: null }] });

        await usersService.desarquivarUserPorId('user-123', { motivo: 'Retorno', atorId: 'admin-1' });

        expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO user_movimentacoes'), expect.arrayContaining(['user-123', 'admin-1', 'Retorno']));
    });

    test('listarHistoricoMovimentacoes deve retornar dados formatados', async () => {
        pool.query.mockResolvedValueOnce({ rows: [
            { id: 'mov-1', user_id: 'u-1', user_nome: 'João', acao: 'ARQUIVADO', criado_em: new Date() }
        ] });

        const res = await usersService.listarHistoricoMovimentacoes();
        expect(res).toHaveLength(1);
        expect(res[0].user_nome).toBe('João');
    });
});
