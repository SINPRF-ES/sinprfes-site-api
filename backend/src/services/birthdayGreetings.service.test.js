const pool = require('../config/db');
const emailService = require('./email.service');
const {
  sendBirthdayGreetingsBatch,
  resolveRecipientKey,
  isValidEmail,
} = require('./birthdayGreetings.service');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('./email.service', () => ({
  enviarEmailAniversarioPersonalizado: jest.fn(),
}));

describe('birthdayGreetings.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates email format', () => {
    expect(isValidEmail('teste@sinprfes.org.br')).toBe(true);
    expect(isValidEmail('invalido')).toBe(false);
  });

  it('builds deterministic recipient keys for filiado and dependente', () => {
    expect(resolveRecipientKey({ tipo: 'FILIADO', id: 7 })).toBe('FILIADO:7');
    expect(resolveRecipientKey({ tipo: 'DEPENDENTE', id: 7, dependente_ordem: 2 })).toBe('DEPENDENTE:7:2');
  });

  it('sends personalized emails only for eligible people and records logs', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] })
      .mockResolvedValueOnce({ rows: [] });

    emailService.enviarEmailAniversarioPersonalizado
      .mockResolvedValueOnce({ id: 'msg-1' })
      .mockRejectedValueOnce(new Error('provider down'));

    const stats = await sendBirthdayGreetingsBatch({
      referenceDate: '2026-04-08',
      aniversariantes: [
        { id: 1, tipo: 'FILIADO', nome: 'Alice', email1: 'alice@sinprfes.org.br' },
        { id: 1, tipo: 'DEPENDENTE', dependente_ordem: 1, nome: 'Dep sem mail', email1: '' },
        { id: 2, tipo: 'FILIADO', nome: 'Bob', email1: 'bob@sinprfes.org.br' },
      ],
    });

    expect(emailService.enviarEmailAniversarioPersonalizado).toHaveBeenCalledTimes(2);
    expect(stats).toEqual({
      totalBirthdaysFound: 3,
      eligibleForIndividualSend: 2,
      sentSuccessfully: 1,
      failed: 1,
      skipped: 1,
    });
  });

  it('does not resend duplicate personalized email on same day', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const stats = await sendBirthdayGreetingsBatch({
      referenceDate: '2026-04-08',
      aniversariantes: [{ id: 99, tipo: 'FILIADO', nome: 'Duplicado', email1: 'dup@sinprfes.org.br' }],
    });

    expect(emailService.enviarEmailAniversarioPersonalizado).not.toHaveBeenCalled();
    expect(stats.sentSuccessfully).toBe(0);
    expect(stats.skipped).toBe(1);
  });
});
