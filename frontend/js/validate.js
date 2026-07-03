// 입력 검증 순수함수 (DOM/네트워크 없음).
function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 6) {
    return '비밀번호는 6자 이상이어야 합니다.';
  }
  return null;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isValidEmail, passwordProblem };
}
