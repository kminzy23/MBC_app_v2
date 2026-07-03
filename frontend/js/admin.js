(function () {
  var listEl = document.getElementById('admin-list');
  var form = document.getElementById('channel-form');
  var msg = document.getElementById('admin-msg');
  var editingId = null;

  function setMsg(t, err) { msg.textContent = t; msg.className = 'auth-msg ' + (err ? 'err' : 'ok'); }

  function readFields() {
    return {
      name: document.getElementById('f-name').value.trim(),
      type: document.getElementById('f-type').value,
      path: document.getElementById('f-path').value.trim(),
      thumbnail_url: document.getElementById('f-thumb').value.trim() || null,
      sort_order: parseInt(document.getElementById('f-sort').value, 10) || 0,
      enabled: document.getElementById('f-enabled').checked
    };
  }
  function fillForm(ch) {
    editingId = ch ? ch.id : null;
    document.getElementById('f-name').value = ch ? ch.name : '';
    document.getElementById('f-type').value = ch ? ch.type : 'tv';
    document.getElementById('f-path').value = ch ? ch.path : '';
    document.getElementById('f-thumb').value = ch && ch.thumbnail_url ? ch.thumbnail_url : '';
    document.getElementById('f-sort').value = ch ? ch.sort_order : 0;
    document.getElementById('f-enabled').checked = ch ? ch.enabled : true;
    document.getElementById('form-title').textContent = ch ? '채널 수정' : '채널 추가';
  }

  async function refresh() {
    listEl.innerHTML = '';
    var channels = await DB.listChannels({ all: true });
    channels.forEach(function (ch) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + ch.sort_order + '</td><td>' + ch.name + '</td><td>' + ch.type +
        '</td><td>' + ch.path + '</td><td>' + (ch.enabled ? '✓' : '—') + '</td>';
      var td = document.createElement('td');
      var edit = document.createElement('button');
      edit.textContent = '수정';
      edit.addEventListener('click', function () { fillForm(ch); });
      var del = document.createElement('button');
      del.textContent = '삭제';
      del.addEventListener('click', async function () {
        if (!confirm('삭제할까요?')) { return; }
        try { await DB.deleteChannel(ch.id); refresh(); }
        catch (e) { setMsg('삭제 실패: ' + e.message, true); }
      });
      td.appendChild(edit); td.appendChild(del); tr.appendChild(td);
      listEl.appendChild(tr);
    });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = readFields();
    var problem = channelFormProblem(f);
    if (problem) { setMsg(problem, true); return; }
    try {
      if (editingId) { await DB.updateChannel(editingId, f); setMsg('수정됨', false); }
      else { await DB.createChannel(f); setMsg('추가됨', false); }
      fillForm(null); refresh();
    } catch (e2) { setMsg('저장 실패: ' + e2.message, true); }
  });
  document.getElementById('new-btn').addEventListener('click', function () { fillForm(null); });
  document.getElementById('logout-btn').addEventListener('click', async function () {
    await Auth.signOut(); window.location.replace('index.html');
  });

  // 가드: 로그인 + 관리자만
  (async function init() {
    var session = await Auth.requireAuth();
    if (!session) { return; }
    if (!(await DB.isAdmin())) { window.location.replace('player.html'); return; }
    fillForm(null);
    refresh();
  })();
})();
