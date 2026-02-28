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
