(function () {
  var sb = window.Auth.client; // Phase 3에서 만든 supabase 클라이언트 재사용

  async function listChannels(opts) {
    opts = opts || {};
    var q = sb.from('channels').select('*').order('sort_order', { ascending: true });
    if (!opts.all) { q = q.eq('enabled', true); }
    var res = await q;
    if (res.error) { throw res.error; }
    return res.data;
  }
  async function createChannel(fields) {
    var res = await sb.from('channels').insert(fields).select().single();
    if (res.error) { throw res.error; }
    return res.data;
  }
  async function updateChannel(id, fields) {
    var res = await sb.from('channels').update(fields).eq('id', id).select().single();
    if (res.error) { throw res.error; }
    return res.data;
  }
  async function deleteChannel(id) {
    var res = await sb.from('channels').delete().eq('id', id);
    if (res.error) { throw res.error; }
    return true;
  }
  async function isAdmin() {
    var res = await sb.from('profiles').select('is_admin').maybeSingle();
    if (res.error || !res.data) { return false; }
    return !!res.data.is_admin;
  }

  window.DB = {
    listChannels: listChannels, createChannel: createChannel,
    updateChannel: updateChannel, deleteChannel: deleteChannel, isAdmin: isAdmin
  };
})();
