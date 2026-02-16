// src/controllers/contentBlock.controller.test.js
const contentBlockController = require('./contentBlock.controller');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../../data/content_blocks.json');

describe('ContentBlock Controller (JSON)', () => {
  beforeEach(() => {
    // Mock user
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

    // Ensure data directory exists
    if (!fs.existsSync(path.dirname(DATA_PATH))) {
      fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    }

    // Reset data
    const initialData = [
      { id: '1', page: 'home', title: 'T1', is_active: true, ordenacao: 1 },
      { id: '2', page: 'home', title: 'T2', is_active: false, ordenacao: 2 }
    ];
    fs.writeFileSync(DATA_PATH, JSON.stringify(initialData, null, 2));
  });

  test('getBlocks should return only active blocks by default', async () => {
    this.req.query = { page: 'home' };
    await contentBlockController.getBlocks(this.req, this.res);
    expect(this.res.json).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: '1' })
    ]));
    expect(this.res.json.mock.calls[0][0]).toHaveLength(1);
  });

  test('getBlocks should return all blocks if includeInactive=true', async () => {
    this.req.query = { page: 'home', includeInactive: 'true' };
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
    await contentBlockController.updateBlock(this.req, this.res);
    expect(this.res.json).toHaveBeenCalledWith(expect.objectContaining({
      body: '<p>Hello</p>'
    }));
  });
});
