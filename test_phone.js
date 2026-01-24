const { onlyDigits, formatTelefone } = require('./mobile/src/shared/format/formatters');

const testCases = [
  null,
  '',
  '1',
  '11',
  '119',
  '119999',
  '1199998888',
  '11999998888',
  '11999998888123'
];

testCases.forEach(c => {
  console.log(`Input: "${c}" -> Output: "${formatTelefone(c)}"`);
});
