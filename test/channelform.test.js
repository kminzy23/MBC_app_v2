const assert = require('assert');
const { channelFormProblem } = require('../frontend/js/channelform.js');

assert.strictEqual(channelFormProblem({ name: 'TV1', type: 'tv', path: 'live/tv1' }), null);
assert.strictEqual(typeof channelFormProblem({ name: '', type: 'tv', path: 'live/tv1' }), 'string');   // 이름 없음
assert.strictEqual(typeof channelFormProblem({ name: 'X', type: 'tv', path: '' }), 'string');          // 경로 없음
assert.strictEqual(typeof channelFormProblem({ name: 'X', type: 'movie', path: 'p' }), 'string');      // 잘못된 타입
assert.strictEqual(channelFormProblem({ name: '라디오', type: 'radio', path: 'live/r1' }), null);
console.log('channelform.test.js passed');
