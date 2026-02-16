// scripts/format-check.js

const assert = require('assert');
const formatters = require('../../shared/format');

console.log('Running sanity checks for shared formatters...');

// Test cases
const tests = [
  // formatCpf
  { func: 'formatCpf', input: '12345678901', expected: '123.456.789-01' },
  { func: 'formatCpf', input: '1234567890', expected: '1234567890' }, // Invalid length
  { func: 'formatCpf', input: 'abc', expected: 'abc' },
  { func: 'formatCpf', input: null, expected: '' },

  // formatTelefone
  { func: 'formatTelefone', input: '11999998888', expected: '(11) 99999-8888' },
  { func: 'formatTelefone', input: '1133334444', expected: '(11) 3333-4444' },
  { func: 'formatTelefone', input: '12345', expected: '12345' }, // Invalid length
  { func: 'formatTelefone', input: '', expected: '' },

  // onlyDigits
  { func: 'onlyDigits', input: ' (11) 99999-8888a', expected: '11999998888' },
  { func: 'onlyDigits', input: '123.456.789-01', expected: '12345678901' },

  // normalizeCpf
  { func: 'normalizeCpf', input: '123.456.789-01', expected: '12345678901' },

  // normalizeTelefone
  { func: 'normalizeTelefone', input: '(11) 99999-8888', expected: '11999998888' },

  // normalizeCep
  { func: 'normalizeCep', input: '12345-678', expected: '12345678' },
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  try {
    const result = formatters[test.func](test.input);
    assert.strictEqual(result, test.expected, `Test ${index + 1} (${test.func}) failed`);
    console.log(`[PASS] ${test.func}('${test.input}') => '${result}'`);
    passed++;
  } catch (error) {
    console.error(`[FAIL] ${error.message}`);
    failed++;
  }
});

console.log(`\nTests finished. Passed: ${passed}, Failed: ${failed}`);

if (failed > 0) {
  process.exit(1); // Exit with error code if any test fails
}
