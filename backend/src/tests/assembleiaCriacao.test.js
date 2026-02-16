// src/tests/assembleiaCriacao.test.js
const controller = require('../controllers/assembleias.controller');
const service = require('../services/assembleias.service');

jest.mock('../services/assembleias.service');
jest.mock('../websocket/assembleia.socket');
jest.mock('../utils/log');

describe('Assembleias Controller - Creation with Edital', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 1, perfil_acesso: 'DIRETORIA' },
      body: {
        tipo: 'AGE',
        titulo: 'Assembleia Teste Edital',
        pauta: 'Pauta de teste',
        data_evento: '2026-12-31',
        hora_primeira_chamada: '10:00',
        hora_segunda_chamada: '10:30',
        edital_drive_file_id: 'drive-id-test'
      },
      requestId: 'test-creation-id'
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    jest.clearAllMocks();
  });

  test('Should persist edital_url when sent via snake_case', async () => {
    req.body.edital_url = 'https://cloudinary.com/test.pdf';

    service.criar.mockResolvedValue({ id: 'ass-1', ...req.body });

    await controller.criar(req, res);

    expect(service.criar).toHaveBeenCalledWith(expect.objectContaining({
      edital_url: 'https://cloudinary.com/test.pdf'
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('Should persist edital_url when sent via camelCase (editalUrl)', async () => {
    delete req.body.edital_url;
    req.body.editalUrl = 'https://cloudinary.com/camel.pdf';

    service.criar.mockResolvedValue({ id: 'ass-2', ...req.body });

    await controller.criar(req, res);

    expect(service.criar).toHaveBeenCalledWith(expect.objectContaining({
      edital_url: 'https://cloudinary.com/camel.pdf'
    }));
  });

  test('Should persist all metadata when provided', async () => {
    req.body.edital_url = 'https://cloudinary.com/meta.pdf';
    req.body.editalPublicId = 'pub-123';
    req.body.editalResourceType = 'raw';
    req.body.editalType = 'upload';
    req.body.editalFormat = 'pdf';

    service.criar.mockResolvedValue({ id: 'ass-3', ...req.body });

    await controller.criar(req, res);

    expect(service.criar).toHaveBeenCalledWith(expect.objectContaining({
      edital_url: 'https://cloudinary.com/meta.pdf',
      edital_public_id: 'pub-123',
      edital_resource_type: 'raw',
      edital_type: 'upload',
      edital_format: 'pdf'
    }));
  });

  test('Should treat empty strings as null', async () => {
    req.body.edital_url = '';
    req.body.editalUrl = '';

    service.criar.mockResolvedValue({ id: 'ass-4', ...req.body });

    await controller.criar(req, res);

    expect(service.criar).toHaveBeenCalledWith(expect.objectContaining({
      edital_url: null
    }));
  });
});
