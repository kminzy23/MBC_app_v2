(function () {
  var video = document.getElementById('player');
  var statusEl = document.getElementById('player-status');
  var listEl = document.getElementById('channel-list');
  var hls = null;

  function setStatus(msg) { statusEl.textContent = msg; }

  function nativeHlsSupported() {
    return video.canPlayType('application/vnd.apple.mpegurl') !== '';
  }

  function stopPlayback() {
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src');
    video.load();
  }

  function playChannel(channel) {
    var url = buildHlsUrl(channel, window.location);
    var playerArea = document.querySelector('.player-area');
    if (channel.type === 'radio') { playerArea.classList.add('mode-radio'); }
    else { playerArea.classList.remove('mode-radio'); }
    setStatus(channel.name + ' 로딩 중…');
    stopPlayback();

    // hls.js를 우선 사용한다(데스크톱 크롬·안드로이드 등). 크롬은 canPlayType이
    // 'maybe'를 반환하지만 실제로 HLS를 디먹스하지 못하므로 네이티브를 먼저 쓰면 안 된다.
    // 네이티브 HLS는 hls.js가 지원되지 않는 iOS 사파리에서만 폴백으로 사용한다.
    if (window.Hls && Hls.isSupported()) {
      var recoverAttempts = 0;
      var MAX_RECOVER = 3;
      hls = new Hls({ manifestLoadingMaxRetry: 2 });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        recoverAttempts = 0;
        video.play().catch(function () {});
        setStatus(channel.name + ' 재생 중');
      });
      hls.on(Hls.Events.ERROR, function (evt, data) {
        if (!data.fatal) { return; }
        // on-demand 뮤서 시작 직후·네트워크 순단 등 일시 오류는 복구를 먼저 시도한다.
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && recoverAttempts < MAX_RECOVER) {
          recoverAttempts++;
          setStatus(channel.name + ' 재접속 중… (' + recoverAttempts + '/' + MAX_RECOVER + ')');
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && recoverAttempts < MAX_RECOVER) {
          recoverAttempts++;
          setStatus(channel.name + ' 복구 중… (' + recoverAttempts + '/' + MAX_RECOVER + ')');
          hls.recoverMediaError();
        } else {
          setStatus(channel.name + ' 재생 불가 (오프에어)');
          stopPlayback();
        }
      });
    } else if (nativeHlsSupported()) {
      video.src = url;
      video.play().catch(function () {});
      video.addEventListener('loadedmetadata',
        function () { setStatus(channel.name + ' 재생 중'); }, { once: true });
      video.addEventListener('error',
        function () { setStatus(channel.name + ' 재생 불가 (오프에어)'); }, { once: true });
    } else {
      setStatus('이 브라우저는 HLS를 지원하지 않습니다.');
    }
  }

  function renderChannels(channels) {
    listEl.innerHTML = '';
    channels.forEach(function (ch) {
      var li = document.createElement('li');
      li.className = 'channel-card channel-' + ch.type;
      li.dataset.id = ch.id;
      li.innerHTML =
        '<span class="channel-name">' + ch.name + '</span>' +
        '<span class="channel-type">' + (ch.type === 'radio' ? '라디오' : 'TV') + '</span>' +
        '<span class="channel-status" data-status>확인 중…</span>';
      li.addEventListener('click', function () { playChannel(ch); });
      listEl.appendChild(li);
    });
  }

  function probeChannels(channels) {
    channels.forEach(function (ch) {
      var url = buildHlsUrl(ch, window.location);
      var card = listEl.querySelector('.channel-card[data-id="' + ch.id + '"]');
      var badge = card ? card.querySelector('[data-status]') : null;
      if (!badge) { return; }
      fetch(url, { method: 'GET' })
        .then(function (res) {
          badge.textContent = res.ok ? '온에어' : '오프에어';
          badge.className = 'channel-status ' + (res.ok ? 'on-air' : 'off-air');
        })
        .catch(function () {
          badge.textContent = '오프에어';
          badge.className = 'channel-status off-air';
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderChannels(CHANNELS);
    probeChannels(CHANNELS);
  });

  window.__player = {
    renderChannels: renderChannels,
    playChannel: playChannel,
    probeChannels: probeChannels
  };
})();
