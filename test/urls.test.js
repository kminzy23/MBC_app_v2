const assert = require('assert');
const { buildHlsUrl } = require('../frontend/js/urls.js');

// same-origin: 페이지와 같은 host(:8080)로 스트림 URL을 만든다 (:8888 노출 안 함)
assert.strictEqual(
  buildHlsUrl({ path: 'live/tv1' }, { protocol: 'http:', host: 'localhost:8080' }),
  'http://localhost:8080/live/tv1/index.m3u8'
);
// 폰 접속(다른 host)에서도 그 host를 그대로 가리켜야 함
assert.strictEqual(
  buildHlsUrl({ path: 'live/radio1' }, { protocol: 'http:', host: '192.168.101.191:8080' }),
  'http://192.168.101.191:8080/live/radio1/index.m3u8'
);
console.log('urls.test.js passed');
