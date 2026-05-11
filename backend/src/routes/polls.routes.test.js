const express = require("express");
const request = require("supertest");

jest.mock("../middlewares/auth", () => {
  const { createTestUser } = require('../tests/factories/testUserFactory');
  return (req, _res, next) => {
    req.user = createTestUser({ perfil_acesso: req.headers["x-test-perfil"] || "FILIADO" });
    next();
  };
});

jest.mock("../controllers/polls.controller", () => ({
  create: (_req, res) => res.status(201).json({ success: true, action: "create" }),
  update: (_req, res) => res.json({ success: true, action: "update" }),
  publish: (_req, res) => res.json({ success: true, action: "publish" }),
  list: (_req, res) => res.json({ success: true, action: "list" }),
  getById: (_req, res) => res.json({ success: true, action: "getById" }),
  vote: (_req, res) => res.status(201).json({ success: true, action: "vote" }),
  results: (_req, res) => res.json({ success: true, action: "results" }),
}));

const router = require("./polls.routes");

describe("polls.routes authorization", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/polls", router);

  test("permite FILIADO listar enquetes publicadas", async () => {
    const res = await request(app)
      .get("/api/polls")
      .set("x-test-perfil", "FILIADO");

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("list");
  });

  test("permite FILIADO votar em enquete publicada", async () => {
    const res = await request(app)
      .post("/api/polls/10/vote")
      .set("x-test-perfil", "FILIADO")
      .send({ option_ids: [1] });

    expect(res.status).toBe(201);
    expect(res.body.action).toBe("vote");
  });

  test("mantém criação restrita à gestão", async () => {
    const res = await request(app)
      .post("/api/polls")
      .set("x-test-perfil", "FILIADO")
      .send({ title: "Teste" });

    expect(res.status).toBe(403);
  });

  test("permite DIRETORIA criar enquete", async () => {
    const res = await request(app)
      .post("/api/polls")
      .set("x-test-perfil", "DIRETORIA")
      .send({ title: "Teste" });

    expect(res.status).toBe(201);
    expect(res.body.action).toBe("create");
  });
});
