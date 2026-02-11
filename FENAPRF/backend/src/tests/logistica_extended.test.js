const logisticaController = require('../controllers/logistica.controller');
const pool = require('../config/db');
const { STATUS_EVENTO } = require('../../shared/logistica');

jest.mock('../config/db', () => ({
    connect: jest.fn(),
    query: jest.fn()
}));

jest.mock('../utils/log', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

describe('Logística Extended Actions', () => {
    let mockRes;
    let mockClient;

    beforeEach(() => {
        jest.clearAllMocks();
        mockRes = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        pool.connect.mockResolvedValue(mockClient);
    });

    test('encerrarEvento deve atualizar status e registrar auditoria', async () => {
        const evtId = '00000000-0000-4000-a000-000000000123';
        const userId = '00000000-0000-4000-a000-000000000456';
        const req = {
            params: { id: evtId },
            user: { id: userId },
            body: { justificativa: 'Evento finalizado' }
        };

        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: evtId, status: STATUS_EVENTO.ATIVO }] }) // SELECT old
            .mockResolvedValueOnce({ rows: [{ id: evtId, status: STATUS_EVENTO.ENCERRADO }] }) // UPDATE
            .mockResolvedValueOnce({}) // Auditoria
            .mockResolvedValueOnce({}); // COMMIT

        await logisticaController.encerrarEvento(req, mockRes);

        expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE logistica_eventos'), expect.arrayContaining([STATUS_EVENTO.ENCERRADO, userId, 'Evento finalizado', evtId]));
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: STATUS_EVENTO.ENCERRADO }));
    });

    test('cancelarEvento deve atualizar status e registrar auditoria', async () => {
        const evtId = '00000000-0000-4000-a000-000000000789';
        const userId = '00000000-0000-4000-a000-000000000456';
        const req = {
            params: { id: evtId },
            user: { id: userId },
            body: { justificativa: 'Motivo de cancelamento' }
        };

        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: evtId, status: STATUS_EVENTO.ATIVO }] }) // SELECT old
            .mockResolvedValueOnce({ rows: [{ id: evtId, status: STATUS_EVENTO.CANCELADO }] }) // UPDATE
            .mockResolvedValueOnce({}) // Auditoria
            .mockResolvedValueOnce({}); // COMMIT

        await logisticaController.cancelarEvento(req, mockRes);

        expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE logistica_eventos'), expect.arrayContaining([STATUS_EVENTO.CANCELADO, userId, 'Motivo de cancelamento', evtId]));
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: STATUS_EVENTO.CANCELADO }));
    });

    test('registrarMinhaInscricao deve bloquear se evento não estiver ativo', async () => {
        const userId = '00000000-0000-4000-a000-000000000001';
        const evtId = '00000000-0000-4000-a000-000000000002';
        const req = {
            user: { id: userId, perfil_acesso: 'CONSELHEIRO' },
            body: { evento_id: evtId, data_chegada: '2025-01-01', data_saida: '2025-01-02' }
        };

        mockClient.query.mockResolvedValueOnce({ rows: [{ status: STATUS_EVENTO.ENCERRADO, titulo: 'Fechado' }] });

        await logisticaController.registrarMinhaInscricao(req, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Evento encerrado.' });
    });
});
