// src/tests/repasse_verification.test.js
const repasseService = require("../services/repasse.service");
const pool = require("../config/db");
const { LOTACOES_REPASSE } = require('../shared/canon');

jest.mock("../config/db", () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

describe("Repasse Service - Verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getRepasseAno", () => {
    it("should return the correct structure and values with parallelized queries", async () => {
      const year = 2024;

      // Mock pool.query responses
      pool.query.mockImplementation((query, params) => {
        if (query.includes("repasse_mes")) {
          return Promise.resolve({ rows: [{ month: 1, per_capita: 100 }] });
        }
        if (query.includes("repasse_lotacao")) {
          return Promise.resolve({
            rows: [
              { month: 1, lotacao_key: "SEDE", prf_total: 10, reembolso_mes: 5 },
              { month: 1, lotacao_key: "DEL 01 - Viana", prf_total: 20, reembolso_mes: 0 }
            ]
          });
        }
        if (query.includes("COUNT(*)")) {
          // Count queries for each lotação
          if (params[0].includes("SEDE")) return Promise.resolve({ rows: [{ count: "8" }] });
          if (params[0].includes("VIANA")) return Promise.resolve({ rows: [{ count: "15" }] });
          return Promise.resolve({ rows: [{ count: "0" }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await repasseService.getRepasseAno(year);

      expect(result.year).toBe(year);
      expect(result.meses).toHaveLength(12);

      // Verify Month 1
      const jan = result.meses[0];
      expect(jan.month).toBe(1);
      expect(jan.perCapita).toBe(100);

      // SEDE in Jan
      const sedeJan = jan.localidades.find(l => l.lotacao === "SEDE");
      expect(sedeJan.filiadosAtivos).toBe(8);
      expect(sedeJan.prfTotal).toBe(10);
      expect(sedeJan.percentual).toBe(80);
      // factor for 80% is 0.7. base = 8 * 100 = 800. credito = 800 * 0.7 = 560.
      expect(sedeJan.creditoMes).toBe(560);
      expect(sedeJan.reembolsoMes).toBe(5);

      // DEL 01 - Viana in Jan
      const vianaJan = jan.localidades.find(l => l.lotacao === "DEL 01 - Viana");
      expect(vianaJan.filiadosAtivos).toBe(15);
      expect(vianaJan.prfTotal).toBe(20);
      expect(vianaJan.percentual).toBe(75);
      // factor for 75% is 0.4. base = 15 * 100 = 1500. credito = 1500 * 0.4 = 600.
      expect(vianaJan.creditoMes).toBe(600);

      // Verify accumulation logic
      // Since we only mocked Jan, others are 0.
      // Sede: 560 - 5 = 555.
      // Viana: 600 - 0 = 600.
      // Total: 1155.
      expect(sedeJan.acumuladoAno).toBe(555);
      expect(vianaJan.acumuladoAno).toBe(600);
      expect(result.totalAcumuladoGeral).toBe(1155);
    });
  });

  describe("getUltimosDadosParaRelatorio", () => {
    it("should fetch filiadosAtivos and prfTotal in parallel", async () => {
      pool.query.mockImplementation((query, params) => {
        if (query.includes("COUNT(*)")) {
          return Promise.resolve({ rows: [{ count: "10" }] });
        }
        if (query.includes("SELECT rl.year, rl.month, rl.prf_total")) {
          return Promise.resolve({ rows: [{ year: 2024, month: 5, prf_total: 20 }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await repasseService.getUltimosDadosParaRelatorio("SEDE");

      expect(result.filiadosAtivos).toBe(10);
      expect(result.prfTotal).toBe(20);
      expect(result.percentual).toBe(50);
      expect(result.competencia).toEqual({ year: 2024, month: 5 });
    });
  });
});
