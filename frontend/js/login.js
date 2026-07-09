(function () {
  var loginForm = document.getElementById('login-form');
  var signupForm = document.getElementById('signup-form');
  var resetForm = document.getElementById('reset-form');
  var msg = document.getElementById('auth-msg');
  var verifyNotice = document.getElementById('verify-notice');
  var verifyEmail = document.getElementById('verify-email');

  function show(el) {
    [loginForm, signupForm, resetForm].forEach(function (f) { f.classList.add('hidden'); });
    if (verifyNotice) { verifyNotice.classList.add('hidden'); }
    el.classList.remove('hidden');
    msg.textContent = '';
  }
  // 가입 후 "메일 확인" 안내 화면
  function showVerify(email) {
    [loginForm, signupForm, resetForm].forEach(function (f) { f.classList.add('hidden'); });
    msg.textContent = '';
    if (verifyEmail) { verifyEmail.textContent = email; }
    if (verifyNotice) { verifyNotice.classList.remove('hidden'); }
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
    if (res.error) {
      var m = res.error.message || '';
      if (/rate limit/i.test(m)) { setMsg('메일 발송 한도에 걸렸어요. 잠시 후 다시 시도해 주세요.', true); }
      else { setMsg('가입 실패: ' + m, true); }
      return;
    }
    // 이메일 확인이 꺼져 있으면 세션이 바로 생김 → 플레이어로. 켜져 있으면 안내 화면.
    if (res.data && res.data.session) { window.location.replace('player.html'); return; }
    showVerify(email);
  });
  document.getElementById('verify-to-login').addEventListener('click', function () { show(loginForm); });

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
