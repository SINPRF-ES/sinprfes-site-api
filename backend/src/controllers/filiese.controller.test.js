const { enviarFichaFiliacao } = require("./filiese.controller");
const { gerarPdfFichaFiliacao } = require("../services/pdf.service");
const { enviarEmailFichaFiliacao } = require("../services/email.service");

jest.mock("../services/pdf.service");
jest.mock("../services/email.service");
jest.mock("../utils/log");

describe("filiese.controller - CEP e Endereço Manual / Automático", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        nome: "João da Silva",
        cpf: "123.456.789-00",
        siape: "1234567",
        data_nascimento: "1990-01-01",
        telefone1: "27999998888",
        email_pessoal: "joao@exemplo.com",
        cep: "29200-080",
        logradouro: "Avenida Edízio Cirne",
        bairro: "Praia do Morro",
        cidade: "Guarapari",
        uf: "ES",
      },
      ip: "127.0.0.1",
      get: jest.fn().mockReturnValue("Jest-Test"),
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    gerarPdfFichaFiliacao.mockResolvedValue(Buffer.from("fake-pdf"));
    enviarEmailFichaFiliacao.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Processa solicitação com logradouro e bairro preenchidos normalmente (Caso A)", async () => {
    await enviarFichaFiliacao(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      })
    );

    expect(gerarPdfFichaFiliacao).toHaveBeenCalledWith(
      expect.objectContaining({
        logradouro: "Avenida Edízio Cirne",
        bairro: "Praia do Morro",
        cep: "29200-080",
      })
    );
  });

  test("Processa solicitação com logradouro preenchido manualmente (Caso B/D)", async () => {
    req.body.logradouro = "Rua do Campo sem Nome";
    req.body.bairro = "Zona Rural";

    await enviarFichaFiliacao(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(gerarPdfFichaFiliacao).toHaveBeenCalledWith(
      expect.objectContaining({
        logradouro: "Rua do Campo sem Nome",
        bairro: "Zona Rural",
      })
    );
  });

  test("Rejeita requisição quando logradouro ou bairro ausente", async () => {
    req.body.logradouro = "";

    await enviarFichaFiliacao(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Campo obrigatório ausente: logradouro",
    });
  });
});
