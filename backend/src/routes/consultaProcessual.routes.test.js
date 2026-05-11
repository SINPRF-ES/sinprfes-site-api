const express = require('express');
const request = require('supertest');

jest.mock('../middlewares/auth', () => (req, _res, next) => {
  req.user = { id: 1, perfil_acesso: req.headers['x-test-perfil'] || 'FILIADO', situacao_sindical: 'FILIADO_SINPRF_ES' };
  next();
});

jest.mock('../modules/consulta-processual/controller/consultaProcessual.controller', () => ({
  consultarMe: (_req, res) => res.json({ ok: true }),
  consultarDebugMe: (_req, res) => res.json({ ok: true, debug: true }),
}));

const router = require('./consultaProcessual.routes');

describe('consultaProcessual.routes authorization', () => {
  const app = express();
  app.use('/api/consulta-processual', router);

  test('permite FILIADO autenticado na consulta própria', async () => {
    const res = await request(app)
      .get('/api/consulta-processual/me')
      .set('x-test-perfil', 'FILIADO');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('permite DIRETORIA', async () => {
    const res = await request(app)
      .get('/api/consulta-processual/me')
      .set('x-test-perfil', 'DIRETORIA');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('permite rota debug para DIRETORIA', async () => {
    const res = await request(app)
      .get('/api/consulta-processual/debug/me')
      .set('x-test-perfil', 'DIRETORIA');

    expect(res.status).toBe(200);
    expect(res.body.debug).toBe(true);
  });
});
