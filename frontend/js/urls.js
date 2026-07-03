// HLS 재생 URL 조립 (순수 함수, DOM 의존 없음).
// same-origin 구성: 페이지와 같은 출처(loc.host)로 요청한다.
// Caddy가 /live/* 를 MediaMTX(:8888)로 프록시하므로 브라우저는 :8888을 직접 보지 않는다.
// loc = { protocol, host } — 브라우저에선 window.location 전달.
function buildHlsUrl(channel, loc) {
  return loc.protocol + '//' + loc.host + '/' + channel.path + '/index.m3u8';
}

// Node 테스트용 export (브라우저에선 module 미정의라 무시됨)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildHlsUrl };
}
