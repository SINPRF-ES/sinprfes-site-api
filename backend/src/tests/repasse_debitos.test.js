const repasseService = require("../services/repasse.service");
const pool = require("../config/db");

jest.mock("../config/db", () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

describe("Repasse Service - Debitos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listarMovimentos", () => {
    it("should return movements for a given year and lotacao", async () => {
      const mockRows = [{ id: 1, valor: 100, observacao: "Teste" }];
      pool.query.mockResolvedValue({ rows: mockRows });

      const result = await repasseService.listarMovimentos(2026, "SEDE");
      expect(result).toEqual(mockRows);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("FROM repasse_movimentos"),
        [2026, "SEDE"]
      );
    });
  });

  describe("criarMovimento", () => {
    it("should create a movement with valid data", async () => {
      const payload = { ano_ref: 2026, lotacao_id: "SEDE", valor: 50, observacao: "Gasto Teste" };
      pool.query.mockResolvedValue({ rows: [payload] });

      const result = await repasseService.criarMovimento(payload, 1);
      expect(result).toEqual(payload);
    });

    it("should throw error for invalid valor", async () => {
      const payload = { ano_ref: 2026, lotacao_id: "SEDE", valor: -10, observacao: "Gasto Teste" };
      await expect(repasseService.criarMovimento(payload, 1)).rejects.toThrow("Dados inválidos");
    });

    it("should throw error for short observation", async () => {
      const payload = { ano_ref: 2026, lotacao_id: "SEDE", valor: 50, observacao: "Oi" };
      await expect(repasseService.criarMovimento(payload, 1)).rejects.toThrow("Observação deve ter");
    });

    it("should create movement from valor_centavos", async () => {
      const payload = { ano_ref: 2026, lotacao_id: "SEDE", valor_centavos: 12345, observacao: "Gasto em centavos" };
      pool.query.mockResolvedValue({ rows: [{ id: 2, ...payload, valor: 123.45 }] });

      const result = await repasseService.criarMovimento(payload, 1);
      expect(result.valor).toBe(123.45);
    });
  });

  describe("atualizarMovimento", () => {
    it("should update a movement", async () => {
      const payload = { valor: 60, observacao: "Gasto Editado" };
      pool.query.mockResolvedValue({ rows: [{ id: 1, ...payload }] });

      const result = await repasseService.atualizarMovimento(1, payload, 1);
      expect(result.valor).toBe(60);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND deleted_at IS NULL'),
        [1, 60, 'Gasto Editado', 1]
      );
    });
  });

  describe("excluirMovimento", () => {
    it("should soft delete movement with justificativa", async () => {
      pool.query.mockResolvedValue({ rows: [{ id: 1, delete_reason: "Lançamento duplicado" }] });

      const result = await repasseService.excluirMovimento(1, { justificativa: "Lançamento duplicado" }, 1);
      expect(result.delete_reason).toBe("Lançamento duplicado");
    });

    it("should reject short justificativa", async () => {
      await expect(repasseService.excluirMovimento(1, { justificativa: "abc" }, 1)).rejects.toThrow("Justificativa deve ter");
    });
  });
});


describe("retirarAlocacaoEvento", () => {
  it("should revoke active allocation", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 10, data_evento: '2026-05-20', data_limite_alocacao: '2099-01-01' }] })
      .mockResolvedValueOnce({ rows: [{ id: 90, status: 'REVOGADA' }] })
      .mockResolvedValueOnce({});
    const client = { query, release: jest.fn() };
    pool.connect.mockResolvedValue(client);

    const result = await repasseService.retirarAlocacaoEvento(10, 99, { justificativa: 'Solicitação do filiado' }, 99);
    expect(result.id).toBe(90);
    expect(query).toHaveBeenCalledWith('BEGIN');
    expect(query).toHaveBeenCalledWith('COMMIT');
  });


  it("should require justification", async () => {
    await expect(repasseService.retirarAlocacaoEvento(10, 99, { justificativa: 'abc' }, 99)).rejects.toThrow('Justificativa deve ter entre 5 e 1000 caracteres.');
  });
  it("should reject after deadline", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 10, data_evento: '2026-05-20', data_limite_alocacao: '2020-01-01' }] })
      .mockResolvedValueOnce({});
    const client = { query, release: jest.fn() };
    pool.connect.mockResolvedValue(client);

    await expect(repasseService.retirarAlocacaoEvento(10, 99, { justificativa: 'Solicitação do filiado' }, 99)).rejects.toThrow('Prazo para retirar alocação encerrado');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
});

describe("excluirEvento", () => {
  it("should soft delete event with justification and revoke allocations", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 22, data_evento: '2026-05-20' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 22, delete_reason: 'Evento cancelado' }] })
      .mockResolvedValueOnce({});
    const client = { query, release: jest.fn() };
    pool.connect.mockResolvedValue(client);

    const result = await repasseService.excluirEvento(22, { justificativa: 'Evento cancelado' }, 1);
    expect(result.delete_reason).toBe('Evento cancelado');
    expect(query).toHaveBeenCalledWith('BEGIN');
    expect(query).toHaveBeenCalledWith('COMMIT');
  });

  it("should reject short justification", async () => {
    await expect(repasseService.excluirEvento(1, { justificativa: 'abc' }, 1)).rejects.toThrow('Justificativa deve ter');
  });
});
