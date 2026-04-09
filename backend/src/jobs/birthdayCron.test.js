// src/jobs/birthdayCron.test.js
const { runBirthdayScan } = require('./birthdayCron');
const pool = require('../config/db');
const filiadosService = require('../services/filiados.service');
const emailService = require('../services/email.service');
const aniversariosAutoService = require('../services/aniversariosAuto.service');
const birthdayGreetingsService = require('../services/birthdayGreetings.service');

jest.mock('../config/db');
jest.mock('../services/filiados.service');
jest.mock('../services/email.service');
jest.mock('../services/aniversariosAuto.service');
jest.mock('../services/birthdayGreetings.service');

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
    console.warn = jest.fn();
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
    aniversariosAutoService.criarAniversarioAutomatico.mockResolvedValue({ created: true, published: true });
    birthdayGreetingsService.getReferenceDateISO.mockReturnValue('2026-04-08');
    birthdayGreetingsService.sendBirthdayGreetingsBatch.mockResolvedValue({
      totalBirthdaysFound: 1,
      eligibleForIndividualSend: 1,
      sentSuccessfully: 1,
      failed: 0,
      skipped: 0,
    });

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
    expect(birthdayGreetingsService.sendBirthdayGreetingsBatch).toHaveBeenCalledWith({
      aniversariantes: expect.any(Array),
      referenceDate: '2026-04-08',
    });
    expect(aniversariosAutoService.criarAniversarioAutomatico).toHaveBeenCalledWith({ aniversariantes: expect.any(Array) });
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE job_runs SET last_run_date = $1'),
      [todayStr, 'BIRTHDAY_SCAN']
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
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
    expect(filiadosService.buscarAniversariantesDoDia).not.toHaveBeenCalled();
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should create missing BIRTHDAY_SCAN control row and continue execution', async () => {
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    let selectCount = 0;
    mockClient.query.mockImplementation((query) => {
      if (query.includes('SELECT last_run_date')) {
        selectCount += 1;
        if (selectCount === 1) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [{ last_run_date: '01/01/1900' }] });
      }
      if (query.includes('INSERT INTO job_runs')) {
        return Promise.resolve({ rowCount: 1, rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    filiadosService.buscarAniversariantesDoDia.mockResolvedValue([]);
    emailService.enviarRelatorioAniversariantes.mockResolvedValue();
    birthdayGreetingsService.getReferenceDateISO.mockReturnValue('2026-04-08');
    birthdayGreetingsService.sendBirthdayGreetingsBatch.mockResolvedValue({
      totalBirthdaysFound: 0,
      eligibleForIndividualSend: 0,
      sentSuccessfully: 0,
      failed: 0,
      skipped: 0,
    });

    await runBirthdayScan();

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO job_runs (job_name, last_run_date, updated_at)'),
      ['BIRTHDAY_SCAN', '01/01/1900']
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT last_run_date FROM job_runs WHERE job_name = $1 FOR UPDATE'),
      ['BIRTHDAY_SCAN']
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE job_runs SET last_run_date = $1'),
      [todayStr, 'BIRTHDAY_SCAN']
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });



  it('should not create aniversario automatico when there are no birthdays', async () => {
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    mockClient.query.mockImplementation((query, params) => {
      if (query.includes('SELECT last_run_date')) {
        return Promise.resolve({ rows: [{ last_run_date: '01/01/2000' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    filiadosService.buscarAniversariantesDoDia.mockResolvedValue([]);
    emailService.enviarRelatorioAniversariantes.mockResolvedValue();
    birthdayGreetingsService.getReferenceDateISO.mockReturnValue('2026-04-08');
    birthdayGreetingsService.sendBirthdayGreetingsBatch.mockResolvedValue({
      totalBirthdaysFound: 0,
      eligibleForIndividualSend: 0,
      sentSuccessfully: 0,
      failed: 0,
      skipped: 0,
    });

    await runBirthdayScan();

    expect(emailService.enviarRelatorioAniversariantes).toHaveBeenCalledWith({
      dateStr: todayStr,
      aniversariantes: []
    });
    expect(birthdayGreetingsService.sendBirthdayGreetingsBatch).toHaveBeenCalledWith({
      aniversariantes: [],
      referenceDate: '2026-04-08',
    });
    expect(aniversariosAutoService.criarAniversarioAutomatico).not.toHaveBeenCalled();
  });

  it('should keep summary email flow even when personalized sends fail individually', async () => {
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    mockClient.query.mockImplementation((query) => {
      if (query.includes('SELECT last_run_date')) {
        return Promise.resolve({ rows: [{ last_run_date: '01/01/2000' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    filiadosService.buscarAniversariantesDoDia.mockResolvedValue([{ nome: 'Pessoa', tipo: 'FILIADO' }]);
    emailService.enviarRelatorioAniversariantes.mockResolvedValue();
    birthdayGreetingsService.getReferenceDateISO.mockReturnValue('2026-04-08');
    birthdayGreetingsService.sendBirthdayGreetingsBatch.mockResolvedValue({
      totalBirthdaysFound: 1,
      eligibleForIndividualSend: 1,
      sentSuccessfully: 0,
      failed: 1,
      skipped: 0,
    });
    aniversariosAutoService.criarAniversarioAutomatico.mockResolvedValue({ created: true, published: true });

    await runBirthdayScan();

    expect(emailService.enviarRelatorioAniversariantes).toHaveBeenCalledWith({
      dateStr: todayStr,
      aniversariantes: expect.any(Array),
    });
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
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
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Job.BirthdayScan.ErroCritico'));
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should skip when bootstrap insert conflicts and row was already executed today', async () => {
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });

    let selectCount = 0;
    mockClient.query.mockImplementation((query) => {
      if (query.includes('SELECT last_run_date')) {
        selectCount += 1;
        if (selectCount === 1) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [{ last_run_date: todayStr }] });
      }
      if (query.includes('INSERT INTO job_runs')) {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    await runBirthdayScan();

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO job_runs (job_name, last_run_date, updated_at)'),
      ['BIRTHDAY_SCAN', '01/01/1900']
    );
    expect(filiadosService.buscarAniversariantesDoDia).not.toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
