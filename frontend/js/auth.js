(function () {
  // supabase-js UMD는 전역 `supabase`를 노출한다.
  var sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  function signUp(email, password) {
    return sb.auth.signUp({
      email: email,
      password: password,
      options: { emailRedirectTo: window.location.origin + '/index.html' }
    });
  }
  function signIn(email, password) {
    return sb.auth.signInWithPassword({ email: email, password: password });
  }
  function signOut() {
    return sb.auth.signOut();
  }
  async function getSession() {
    var res = await sb.auth.getSession();
    return res.data.session;
  }
  async function requireAuth() {
    var session = await getSession();
    if (!session) { window.location.replace('index.html'); return null; }
    return session;
  }
  function sendPasswordReset(email) {
    return sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/index.html'
    });
  }

  window.Auth = {
    client: sb,
    signUp: signUp, signIn: signIn, signOut: signOut,
    getSession: getSession, requireAuth: requireAuth, sendPasswordReset: sendPasswordReset
  };
})();
