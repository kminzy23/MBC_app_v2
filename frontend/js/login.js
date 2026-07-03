(function () {
  var loginForm = document.getElementById('login-form');
  var signupForm = document.getElementById('signup-form');
  var resetForm = document.getElementById('reset-form');
  var msg = document.getElementById('auth-msg');

  function show(el) {
    [loginForm, signupForm, resetForm].forEach(function (f) { f.classList.add('hidden'); });
    el.classList.remove('hidden');
    msg.textContent = '';
  }
  function setMsg(text, isError) {
    msg.textContent = text;
    msg.className = 'auth-msg ' + (isError ? 'err' : 'ok');
  }

  // 화면 전환
  document.getElementById('to-signup').addEventListener('click', function (e) { e.preventDefault(); show(signupForm); });
  document.getElementById('to-login').addEventListener('click', function (e) { e.preventDefault(); show(loginForm); });
  document.getElementById('to-reset').addEventListener('click', function (e) {
    e.preventDefault();
    var email = document.getElementById('login-email').value.trim();
    if (!isValidEmail(email)) { setMsg('재설정 메일을 받을 이메일을 로그인 칸에 먼저 입력하세요.', true); return; }
    Auth.sendPasswordReset(email).then(function () {
      setMsg('비밀번호 재설정 메일을 보냈습니다. 메일함을 확인하세요.', false);
    });
  });

  // 로그인
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('login-email').value.trim();
    var pw = document.getElementById('login-pw').value;
    if (!isValidEmail(email)) { setMsg('이메일 형식이 올바르지 않습니다.', true); return; }
    setMsg('로그인 중…', false);
    var res = await Auth.signIn(email, pw);
    if (res.error) { setMsg('로그인 실패: ' + res.error.message, true); return; }
    window.location.replace('player.html');
  });

  // 회원가입
  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    var pw = document.getElementById('signup-pw').value;
    if (!isValidEmail(email)) { setMsg('이메일 형식이 올바르지 않습니다.', true); return; }
    var pwErr = passwordProblem(pw);
    if (pwErr) { setMsg(pwErr, true); return; }
    setMsg('가입 중…', false);
    var res = await Auth.signUp(email, pw);
    if (res.error) { setMsg('가입 실패: ' + res.error.message, true); return; }
    setMsg('가입 완료! 확인 메일의 링크를 눌러 인증한 뒤 로그인하세요.', false);
    show(loginForm);
  });

  // 비밀번호 복구 링크로 들어온 경우: 새 비밀번호 폼 표시
  Auth.client.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') { show(resetForm); }
  });
  resetForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var pw = document.getElementById('reset-pw').value;
    var pwErr = passwordProblem(pw);
    if (pwErr) { setMsg(pwErr, true); return; }
    var res = await Auth.client.auth.updateUser({ password: pw });
    if (res.error) { setMsg('변경 실패: ' + res.error.message, true); return; }
    setMsg('비밀번호가 변경됐습니다. 로그인하세요.', false);
    show(loginForm);
  });
})();
