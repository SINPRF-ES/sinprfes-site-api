// src/controllers/contentBlock.controller.test.js
jest.mock('../services/cloudinary.service', () => ({
  uploadFileBuffer: jest.fn(),
  gerarAssinaturaUpload: jest.fn(),
  STANDARD_IMAGE_TRANSFORMATION_STRING: 'c_fill,w_300,h_300'
}));

jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const contentBlockController = require('./contentBlock.controller');
const cloudinary = require('../services/cloudinary.service');
const pool = require('../config/db');

describe('ContentBlock Controller (PostgreSQL)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    this.req = {
      query: {},
      params: {},
      body: {},
      user: { id: 1 }
    };
    this.res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });

  test('getBlocks should return only active blocks by default', async () => {
    this.req.query = { page: 'home' };
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 10, page: 'home', title: 'T1', is_active: true, ordenacao: 1 }] });

    await contentBlockController.getBlocks(this.req, this.res);

    expect(this.res.json).toHaveBeenCalledWith([
      expect.objectContaining({ id: '10', title: 'T1', page: 'home' })
    ]);
  });

  test('getBlocks should return all blocks if includeInactive=true', async () => {
    this.req.query = { page: 'home', includeInactive: 'true' };
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

    await contentBlockController.getBlocks(this.req, this.res);
    expect(this.res.json.mock.calls[0][0]).toHaveLength(2);
  });

  test('updateBlock should fail if title is too long', async () => {
    this.req.params = { id: '1' };
    this.req.body = { title: 'a'.repeat(121) };

    await contentBlockController.updateBlock(this.req, this.res);
    expect(this.res.status).toHaveBeenCalledWith(400);
  });

  test('updateBlock should sanitize body', async () => {
    this.req.params = { id: '1' };
    this.req.body = { body: '<script>alert(1)</script><p>Hello</p>' };

    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, page: 'home', body: '<p>Hello</p>' }]
    });

    await contentBlockController.updateBlock(this.req, this.res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE content_blocks'),
      expect.arrayContaining([expect.anything(), '<p>Hello</p>'])
    );
    expect(this.res.json).toHaveBeenCalledWith(expect.objectContaining({ body: '<p>Hello</p>' }));
  });

  test('uploadMedia should return 400 when no file is provided', async () => {
    this.req.file = undefined;

    await contentBlockController.uploadMedia(this.req, this.res);

    expect(this.res.status).toHaveBeenCalledWith(400);
    expect(this.res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Arquivo não enviado'
    }));
  });

  test('uploadMedia should upload image buffer to cloudinary', async () => {
    this.req.file = {
      mimetype: 'image/webp',
      buffer: Buffer.from('img')
    };
    cloudinary.uploadFileBuffer.mockResolvedValue({
      secure_url: 'https://cdn.example/image.webp',
      public_id: 'sinprfes/avatars/cms/abc'
    });

    await contentBlockController.uploadMedia(this.req, this.res);

    expect(cloudinary.uploadFileBuffer).toHaveBeenCalledWith(
      this.req.file.buffer,
      expect.objectContaining({
        folder: 'sinprfes/avatars/cms',
        resource_type: 'image',
        standardizeImage: false
      })
    );
    expect(this.res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      url: 'https://cdn.example/image.webp'
    }));
  });
});
