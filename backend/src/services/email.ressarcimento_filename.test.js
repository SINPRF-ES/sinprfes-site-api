const { gerarNomeArquivoRessarcimento } = require("../utils/format");
const { enviarEmailRessarcimento } = require("./email.service");
const { gerarPdfRessarcimento } = require("./pdf.service");
const { Resend } = require("resend");

jest.mock("resend");

describe("Ressarcimento PDF Filename Naming and Email Dispatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key_123";
    process.env.MAIL_FROM = "no-reply@sinprfes.org.br";
    process.env.MAIL_TO_RESSARCIMENTO = "ressarcimento@sinprfes.org.br";
  });

  describe("gerarNomeArquivoRessarcimento Utility", () => {
    test("1. Standard name formatting (João da Silva Souza on 07/09/2026)", () => {
      const dados = {
        nome: "João da Silva Souza",
        criadoEm: "2026-09-07T14:30:00.000Z",
      };
      const filename = gerarNomeArquivoRessarcimento(dados);
      expect(filename).toBe("Ressarcimento_João_da_Silva_Souza_07_09_2026.pdf");
    });

    test("2. Acceptance criterion name with accents (Marcelo Fávero Brandão on 07/09/2026)", () => {
      const dados = {
        nome: "Marcelo Fávero Brandão",
        criadoEm: "2026-09-07T10:00:00.000Z",
      };
      const filename = gerarNomeArquivoRessarcimento(dados);
      expect(filename).toBe("Ressarcimento_Marcelo_Fávero_Brandão_07_09_2026.pdf");
    });

    test("3. Excess whitespace and dangerous characters sanitization", () => {
      const dados = {
        nome: "   João   da / \\ \"Silva\"  <Souza>   ",
        criadoEm: "2026-09-07T18:00:00.000Z",
      };
      const filename = gerarNomeArquivoRessarcimento(dados);
      expect(filename).toBe("Ressarcimento_João_da_Silva_Souza_07_09_2026.pdf");
      expect(filename).not.toContain("__");
      expect(filename).not.toContain("/");
      expect(filename).not.toContain("\"");
    });

    test("4. Date format must strictly be DD_MM_AAAA with .pdf extension", () => {
      const dados = {
        nome: "Maria Santos",
        criadoEm: "2026-12-25T08:00:00.000Z",
      };
      const filename = gerarNomeArquivoRessarcimento(dados);
      expect(filename).toMatch(/^Ressarcimento_Maria_Santos_\d{2}_\d{2}_\d{4}\.pdf$/);
      expect(filename).toContain("_25_12_2026.pdf");
      expect(filename.endsWith(".pdf")).toBe(true);
      expect(filename).not.toContain("-");
      expect(filename).not.toContain("/");
    });

    test("5. Fallback for empty or missing applicant name", () => {
      const dados = {
        nome: "   ",
        criadoEm: "2026-09-07T12:00:00.000Z",
      };
      const filename = gerarNomeArquivoRessarcimento(dados);
      expect(filename).toBe("Ressarcimento_Solicitante_07_09_2026.pdf");
    });
  });

  describe("enviarEmailRessarcimento Attachment Naming", () => {
    test("6. Sends attachment with new filename to both Sindicato and Solicitante", async () => {
      const sendMock = jest.fn().mockResolvedValue({ data: { id: "msg_123" }, error: null });
      Resend.prototype.emails = { send: sendMock };

      const dados = {
        nome: "Marcelo Fávero Brandão",
        cpf: "12345678901",
        email_destino: "marcelo@example.com",
        criadoEm: "2026-09-07T12:00:00.000Z",
        data_inicio: "2026-09-01",
        data_fim: "2026-09-05",
        local: "Vitória - ES",
        descricao: "Evento de apresentação das propostas do SINPRF-ES com a participação dos candidatos Maguinha, Bonadiman e Dárcio.",
        valor_total: 150.0,
      };

      const dummyPdfBuffer = Buffer.from("PDF_DUMMY_CONTENT");

      await enviarEmailRessarcimento(dados, dummyPdfBuffer);

      expect(sendMock).toHaveBeenCalledTimes(2);

      const expectedFilename = "Ressarcimento_Marcelo_Fávero_Brandão_07_09_2026.pdf";

      // First call (Sindicato)
      const sindicatoPayload = sendMock.mock.calls[0][0];
      expect(sindicatoPayload.attachments).toHaveLength(1);
      expect(sindicatoPayload.attachments[0].filename).toBe(expectedFilename);
      expect(sindicatoPayload.attachments[0].content).toBe(dummyPdfBuffer.toString("base64"));
      expect(sindicatoPayload.text).toContain("- Local / destino: Vitória - ES");
      expect(sindicatoPayload.text).toContain("- Descrição da atividade: Evento de apresentação das propostas do SINPRF-ES com a participação dos candidatos Maguinha, Bonadiman e Dárcio.");
      expect(sindicatoPayload.text).toContain("- Valor total solicitado: R$ 150.00");

      // Second call (Solicitante copy)
      const solicitantePayload = sendMock.mock.calls[1][0];
      expect(solicitantePayload.attachments).toHaveLength(1);
      expect(solicitantePayload.attachments[0].filename).toBe(expectedFilename);
      expect(solicitantePayload.attachments[0].content).toBe(dummyPdfBuffer.toString("base64"));
      expect(solicitantePayload.text).toContain("- Descrição da atividade: Evento de apresentação das propostas do SINPRF-ES com a participação dos candidatos Maguinha, Bonadiman e Dárcio.");
    });

    test("7. Uses fallback '-' when descricao is missing or empty", async () => {
      const sendMock = jest.fn().mockResolvedValue({ data: { id: "msg_124" }, error: null });
      Resend.prototype.emails = { send: sendMock };

      const dados = {
        nome: "João Silva",
        cpf: "12345678901",
        email_destino: "joao@example.com",
        criadoEm: "2026-09-07T12:00:00.000Z",
        data_inicio: "2026-09-01",
        data_fim: "2026-09-05",
        local: "Vitória - ES",
        valor_total: 150.0,
      };

      await enviarEmailRessarcimento(dados, Buffer.from("PDF_DUMMY"));

      const payload = sendMock.mock.calls[0][0];
      expect(payload.text).toContain("- Descrição da atividade: -");
    });
  });

  describe("PDF Generation Non-Regression", () => {
    test("7. gerarPdfRessarcimento produces valid PDF buffer without altering content generation", async () => {
      const dados = {
        nome: "Marcelo Fávero Brandão",
        cpf: "12345678901",
        telefone_contato: "27999999999",
        email_destino: "marcelo@example.com",
        data_inicio: "2026-09-01",
        data_fim: "2026-09-05",
        local: "Vitória/ES",
        descricao: "Atividade de representação sindical",
        diarias: 1,
        valor_diarias: 500.0,
        km_total: 100,
        valor_km: 150.0,
        valor_outros: 0,
        valor_total: 650.0,
      };

      const pdfBuffer = await gerarPdfRessarcimento(dados, []);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(100);
      // PDF magic header %PDF
      expect(pdfBuffer.toString("latin1", 0, 4)).toBe("%PDF");
    });
  });
});
