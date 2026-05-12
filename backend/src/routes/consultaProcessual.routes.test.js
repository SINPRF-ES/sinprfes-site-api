const express = require('express');
const request = require('supertest');

jest.mock('../middlewares/auth', () => {
  const { createTestUser } = require('../tests/factories/testUserFactory');
  return (req, _res, next) => {
    req.user = createTestUser({ perfil_acesso: req.headers['x-test-perfil'] || 'FILIADO' });
    next();
  };
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

  test('aplica rate limit (429) após exceder 5 requisições em 15 minutos', async () => {
    const responses = [];

    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .get('/api/consulta-processual/me')
        .set('x-test-perfil', 'FILIADO');
      responses.push(res.status);
    }

    expect(responses.slice(0, 5).every((status) => status === 200 || status === 429)).toBe(true);
    expect(responses[5]).toBe(429);
  });

});
