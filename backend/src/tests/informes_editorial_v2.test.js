const request = require('supertest');
const pool = require('../config/db');

jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

jest.mock('../middlewares/auth', () => (req, _res, next) => {
  req.user = { id: 1, perfil_acesso: 'ADMIN' };
  next();
});

jest.mock('../middlewares/requirePermission', () => () => (_req, _res, next) => next());

const app = require('../app');

const VALID_UUID = 'bf923c6a-4959-4674-9844-0c201630983d';
const VALID_MEDIA_UUID = '7f923c6a-4959-4674-9844-0c201630983d';

describe('Informes Canonical Contract Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    pool.connect.mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    });
    pool.query.mockResolvedValue({ rows: [] });
  });

  test('normaliza data_informe como data-only no payload de criação', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'I1', data_noticia: '2026-03-10T12:00:00.000Z' }] });

    const res = await request(app)
      .post('/api/informes')
      .send({ titulo: 'I1', conteudo: 'C', audiencia: 'INTERNA', data_informe: '2026-03-10' });

    expect(res.status).toBe(201);
    expect(res.body.data_informe).toBe('2026-03-10');
    const insertParams = pool.query.mock.calls[1][1];
    expect(insertParams[7]).toBe('2026-03-10T12:00:00.000Z');
  });

  test('bloqueia definir capa em informe arquivado', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ status_editorial: 'ARQUIVADA', is_editable: false }] });

    const res = await request(app)
      .put(`/api/informes/${VALID_UUID}/capa`)
      .send({ coverMediaId: VALID_MEDIA_UUID });

    expect(res.status).toBe(409);
  });

  test('define capa somente com mídia imagem do próprio informe', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ status_editorial: 'ATUAL', is_editable: true }] })
      .mockResolvedValueOnce({ rows: [{ id: VALID_MEDIA_UUID, url: 'https://img', tipo: 'IMAGEM' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put(`/api/informes/${VALID_UUID}/capa`)
      .send({ coverMediaId: VALID_MEDIA_UUID });

    expect(res.status).toBe(200);
    expect(res.body.capa_midia_id).toBe(VALID_MEDIA_UUID);
  });
});
