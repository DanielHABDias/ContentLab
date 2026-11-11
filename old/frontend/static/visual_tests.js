(() => {
  const manifestNode = document.getElementById('visual-test-manifest');
  const video = document.getElementById('visual-test-video');
  const frame = document.getElementById('visual-frame');
  const status = document.getElementById('visual-test-status');
  const expectation = document.getElementById('visual-test-expectation');
  const casesNode = document.getElementById('visual-test-cases');
  if (!manifestNode || !video || !frame || !status || !casesNode) return;

  const manifest = JSON.parse(manifestNode.textContent || '{}');
  const cases = Array.isArray(manifest.cases) ? manifest.cases : [];
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('case');
  const selected = cases.find((item) => item.id === requested) || cases[0];
  const overrideTime = Number(params.get('time'));
  const targetTime = Number.isFinite(overrideTime) ? overrideTime : Number(selected?.time || 0);

  for (const item of cases) {
    const link = document.createElement('a');
    link.className = 'visual-test-case' + (selected && item.id === selected.id ? ' is-active' : '');
    link.href = '?case=' + encodeURIComponent(item.id);
    link.innerHTML = '<strong>' + item.label + '</strong><small>' +
      Number(item.time).toFixed(2) + 's · ' + item.expectation + '</small>';
    casesNode.appendChild(link);
  }

  const setReady = () => {
    video.pause();
    frame.dataset.ready = 'true';
    document.body.dataset.visualReady = 'true';
    status.innerHTML = '<strong>READY</strong> ' +
      (selected ? selected.id : 'custom') + ' @ ' + targetTime.toFixed(2) + 's';
    expectation.textContent = selected?.expectation || 'Checkpoint customizado.';
  };

  const seek = () => {
    const clamped = Math.max(0, Math.min(targetTime, Math.max(0, video.duration - 0.02)));
    if (Math.abs(video.currentTime - clamped) < 0.01 && video.readyState >= 2) {
      setReady();
      return;
    }
    video.currentTime = clamped;
  };

  video.addEventListener('loadedmetadata', seek, {once: true});
  video.addEventListener('seeked', setReady);
  video.addEventListener('error', () => {
    status.textContent = 'ERRO: não foi possível carregar a fixture visual.';
  });
  if (video.readyState >= 1) seek();
})();
