// 채널 폼 입력 검증 순수함수 (DOM/네트워크 없음).
function channelFormProblem(fields) {
  if (!fields || typeof fields.name !== 'string' || !fields.name.trim()) {
    return '채널 이름을 입력하세요.';
  }
  if (typeof fields.path !== 'string' || !fields.path.trim()) {
    return '스트림 경로(path)를 입력하세요.';
  }
  if (fields.type !== 'tv' && fields.type !== 'radio') {
    return "타입은 'tv' 또는 'radio' 여야 합니다.";
  }
  return null;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { channelFormProblem };
}
