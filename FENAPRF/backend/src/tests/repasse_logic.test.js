const { factorFromPercentual } = require('../services/repasse.service');

describe('Repasse Logic - Factors', () => {
  test('should return 0 for percent < 70', () => {
    expect(factorFromPercentual(0)).toBe(0);
    expect(factorFromPercentual(69.99)).toBe(0);
  });

  test('should return 0.4 for 70 <= percent < 80', () => {
    expect(factorFromPercentual(70)).toBe(0.4);
    expect(factorFromPercentual(79.99)).toBe(0.4);
  });

  test('should return 0.7 for 80 <= percent < 90', () => {
    expect(factorFromPercentual(80)).toBe(0.7);
    expect(factorFromPercentual(89.99)).toBe(0.7);
  });

  test('should return 1.0 for percent >= 90', () => {
    expect(factorFromPercentual(90)).toBe(1.0);
    expect(factorFromPercentual(100)).toBe(1.0);
  });
});
