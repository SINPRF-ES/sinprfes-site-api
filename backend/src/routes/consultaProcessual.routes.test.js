const express = require('express');
const request = require('supertest');

jest.mock('../middlewares/auth', () => (req, _res, next) => {
  req.user = { id: 1, perfil_acesso: req.headers['x-test-perfil'] || 'FILIADO' };
  next();
});

jest.mock('../modules/consulta-processual/controller/consultaProcessual.controller', () => ({
  consultarMe: (_req, res) => res.json({ ok: true }),
}));

const router = require('./consultaProcessual.routes');

describe('consultaProcessual.routes authorization', () => {
  const app = express();
  app.use('/api/consulta-processual', router);

  test('bloqueia perfil sem permissão', async () => {
    const res = await request(app)
      .get('/api/consulta-processual/me')
      .set('x-test-perfil', 'FILIADO');

    expect(res.status).toBe(403);
  });

  test('permite DIRETORIA', async () => {
    const res = await request(app)
      .get('/api/consulta-processual/me')
      .set('x-test-perfil', 'DIRETORIA');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
