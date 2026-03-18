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
    const mClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mClient);

    mClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, titulo: 'I1', data_informe: '2026-03-10T12:00:00.000Z' }] }) // INSERT
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .post('/api/informes')
      .send({ titulo: 'I1', conteudo: 'C', audiencia: 'INTERNA', data_informe: '2026-03-10' });

    expect(res.status).toBe(201);
    expect(res.body.data_informe).toBe('2026-03-10');
    // console.log(mClient.query.mock.calls);
    const insertParams = mClient.query.mock.calls[2][1];
    expect(insertParams[6]).toBe('2026-03-10T12:00:00.000Z');
    const insertSql = mClient.query.mock.calls[2][0];
    expect(insertSql).toContain("'RASCUNHO'");
  });


  test('publicar promove informe para status PUBLICADA e status_editorial ATUAL', async () => {
    const mClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mClient);

    pool.query.mockResolvedValueOnce({ rows: [{ status_editorial: 'ATUAL', is_editable: true }] }); // estadoRows

    mClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'OLD_ID' }] }) // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }) // update previous
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, status: 'PUBLICADA', status_editorial: 'ATUAL', data_informe: '2026-03-10' }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }) // gerarPublicRefInforme select
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, public_ref: '20260310-informe-01' }] }) // UPDATE public_ref
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app).post(`/api/informes/${VALID_UUID}/publicar`);

    expect(res.status).toBe(200);
    const updateSql = mClient.query.mock.calls[3][0];
    expect(updateSql).toContain("status = 'PUBLICADA'");
    expect(updateSql).toContain("status_editorial = 'ATUAL'");
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

  test('detalha informe autenticado por public_ref', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: VALID_UUID, public_ref: '20260310-informe-01', status: 'PUBLICADA', capa_midia_id: null }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/informes/ref/20260310-informe-01');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(VALID_UUID);
    expect(res.body.public_ref).toBe('20260310-informe-01');
  });
});
