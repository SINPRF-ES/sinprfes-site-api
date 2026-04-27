const { handleDbError } = require("./dbError");

function createResponseMock() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

describe("handleDbError", () => {
  test("retorna mensagem amigável para código customizado CPF_DUPLICADO", () => {
    const res = createResponseMock();
    const err = { code: "CPF_DUPLICADO", message: "duplicate key value violates unique constraint" };

    handleDbError(err, res, "req-123", "Erro interno ao criar filiado.");

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Este CPF já está cadastrado.",
      code: "CPF_DUPLICADO",
      requestId: "req-123"
    });
  });

  test("retorna mensagem amigável quando violação 23505 for da constraint de CPF", () => {
    const res = createResponseMock();
    const err = {
      code: "23505",
      constraint: "filiados_cpf_key",
      message: "duplicate key value violates unique constraint \"filiados_cpf_key\""
    };

    handleDbError(err, res, "req-456", "Erro interno ao criar filiado.");

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Este CPF já está cadastrado.",
      code: "23505",
      requestId: "req-456"
    });
  });
});
