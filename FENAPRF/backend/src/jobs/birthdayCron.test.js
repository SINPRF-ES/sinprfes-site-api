// src/jobs/birthdayCron.test.js
const { runBirthdayScan } = require('./birthdayCron');
const pool = require('../config/db');
const filiadosService = require('../services/filiados.service');
const emailService = require('../services/email.service');

jest.mock('../config/db');
jest.mock('../services/filiados.service');
jest.mock('../services/email.service');

describe('birthdayCron - runBirthdayScan', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(mockClient);
    console.log = jest.fn();
    console.error = jest.fn();
  });

  it('should run successfully and update last_run_date', async () => {
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    // Mock DB response for job lock
    mockClient.query.mockImplementation((query, params) => {
      if (query.includes('SELECT last_run_date')) {
        return Promise.resolve({ rows: [{ last_run_date: '01/01/2000' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    filiadosService.buscarAniversariantesDoDia.mockResolvedValue([
      { nome: 'João Teste', tipo: 'FILIADO', data_nascimento: '1990-01-01' }
    ]);
    emailService.enviarRelatorioAniversariantes.mockResolvedValue();

    await runBirthdayScan();

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT last_run_date FROM job_runs'),
      ['BIRTHDAY_SCAN']
    );
    expect(filiadosService.buscarAniversariantesDoDia).toHaveBeenCalled();
    expect(emailService.enviarRelatorioAniversariantes).toHaveBeenCalledWith({
      dateStr: todayStr,
      aniversariantes: expect.any(Array)
    });
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE job_runs SET last_run_date = $1'),
      [todayStr, 'BIRTHDAY_SCAN']
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('START: BIRTHDAY_SCAN'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('lastRun=01/01/2000'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('BUSCA aniversariantes OK'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('EMAIL OK'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('UPDATE job_runs OK'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('COMMIT OK'));
  });

  it('should skip if already executed today (idempotency)', async () => {
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    mockClient.query.mockImplementation((query, params) => {
      if (query.includes('SELECT last_run_date')) {
        return Promise.resolve({ rows: [{ last_run_date: todayStr }] });
      }
      return Promise.resolve({ rows: [] });
    });

    await runBirthdayScan();

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Skip: BIRTHDAY_SCAN já executado hoje'));
    expect(filiadosService.buscarAniversariantesDoDia).not.toHaveBeenCalled();
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should rollback and throw error on failure', async () => {
    mockClient.query.mockImplementation((query, params) => {
      if (query.includes('SELECT last_run_date')) {
        return Promise.resolve({ rows: [{ last_run_date: '01/01/2000' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const error = new Error('DB Error');
    filiadosService.buscarAniversariantesDoDia.mockRejectedValue(error);

    await expect(runBirthdayScan()).rejects.toThrow('DB Error');

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Erro crítico ao processar aniversariantes'), expect.anything());
    expect(mockClient.release).toHaveBeenCalled();
  });
});
