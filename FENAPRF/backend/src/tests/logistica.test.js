const logisticaController = require("../controllers/logistica.controller");
const pool = require("../config/db");
const { STATUS_EVENTO } = require("../../shared/logistica");

// Mocking pool.query
jest.mock("../config/db", () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

// Mocking log
jest.mock("../utils/log", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Mocking email service
jest.mock("../services/email.service", () => ({
  enviarEmailConfirmacaoInscricaoLogistica: jest.fn(),
  enviarEmailCancelamentoInscricaoLogistica: jest.fn()
}));

describe("Logística Controller", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: { id: 'user-uuid', perfil_acesso: 'ADMIN' }
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    jest.clearAllMocks();
  });

  test("listarEventos deve retornar lista de eventos", async () => {
    const mockEvents = [{ id: '1', titulo: 'Evento 1' }];
    pool.query.mockResolvedValue({ rows: mockEvents });

    await logisticaController.listarEventos(req, res);

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM logistica_eventos"), []);
    expect(res.json).toHaveBeenCalledWith(mockEvents);
  });

  test("criarEvento deve inserir novo evento e registrar auditoria", async () => {
    const mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    pool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValueOnce({}); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'new-id', titulo: 'Novo' }] }); // INSERT
    mockClient.query.mockResolvedValueOnce({}); // AUDIT
    mockClient.query.mockResolvedValueOnce({}); // COMMIT

    req.body = { titulo: 'Novo', data_inicio: '2026-01-01T10:00:00Z', data_fim: '2026-01-02T10:00:00Z' };

    await logisticaController.criarEvento(req, res);

    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining("BEGIN"));
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO logistica_eventos"), expect.any(Array));
    expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining("COMMIT"));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("registrarMinhaInscricao deve falhar se data_chegada >= data_saida", async () => {
    req.user.perfil_acesso = 'CONSELHEIRO';
    req.body = {
      evento_id: '550e8400-e29b-41d4-a716-446655440000',
      data_chegada: '2026-01-02T10:00:00Z',
      data_saida: '2026-01-01T10:00:00Z'
    };

    await logisticaController.registrarMinhaInscricao(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("chegada deve ser anterior") }));
  });
});
