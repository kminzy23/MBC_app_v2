const assert = require('assert');
const { isValidEmail, passwordProblem } = require('../frontend/js/validate.js');

assert.strictEqual(isValidEmail('a@b.com'), true);
assert.strictEqual(isValidEmail('bad'), false);
assert.strictEqual(isValidEmail('a@b'), false);
assert.strictEqual(isValidEmail(''), false);

assert.strictEqual(passwordProblem('123456'), null);
assert.strictEqual(typeof passwordProblem('123'), 'string'); // 너무 짧음
assert.strictEqual(typeof passwordProblem(''), 'string');
console.log('validate.test.js passed');
