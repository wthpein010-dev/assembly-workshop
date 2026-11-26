import { mountFactoryWorkbench } from './factory-workbenches.js';

const zones = [
  { id: 'entrance', label: '车间入口', blurb: '沿车间主通道前进，进入各个作业区。' },
  { id: 'warehouse', label: '收货与仓储', blurb: '来料在这里点收、上架，再按工单发往生产线。' },
  { id: 'assembly', label: '装配区', blurb: '完成部件检查、安装以及整机通电前复核。', route: 'missions' },
  { id: 'inspection', label: '质检区', blurb: '检查首件并核对检验记录，再把结果交给下一工位。', route: 'missions' },
  { id: 'repair', label: '维修区', blurb: '按故障现象定位原因，在返修台完成复测。', route: 'missions' },
  { id: 'packing', label: '包装与出货', blurb: '成品完成封装、标签复核和称重后发往集货区。' },
  { id: 'automation', label: '自动化装配区', blurb: '沿参观通道看双线输送和机械臂作业，再到校准台与老化测试架。', route: 'missions' },
];

const destinations = [
  ['social', '班组交流'], ['online', '联机大厅'], ['help', '互助任务'], ['event', '工坊建设周'],
];
const routeLabels = { hall: '返回大厅', missions: '打开任务手册', station: '前往模拟工位', team: '打开组队训练' };

export function factoryPage(ctx) {
  const escape = ctx.escape;
  return `
    <section class="container factory-page" data-factory-page aria-labelledby="factory-title">
      <div class="section-heading factory-heading">
        <h1 id="factory-title">工坊地图</h1>
        <a class="btn btn-secondary" href="#hall">返回大厅</a>
      </div>
      <div class="factory-layout" data-factory-layout>
        <div class="factory-viewer">
          <div class="factory-scene" data-factory-scene data-state="loading" data-mode="overview" aria-busy="true">
            <img class="factory-fallback" src="${escape(ctx.asset('yard'))}" alt="" draggable="false">
            <canvas data-factory-canvas tabindex="-1" aria-label="三维工厂" aria-describedby="factory-controls" aria-hidden="true" draggable="false"></canvas>
            <div class="factory-hud">
              <div class="factory-location"><i aria-hidden="true"></i><span data-factory-location>车间入口</span></div>
              <div class="factory-camera-controls">
                <div class="factory-modes" role="group" aria-label="工厂视角">
                  <button type="button" data-factory-mode="overview" aria-pressed="true" disabled>总览</button>
                  <button type="button" data-factory-mode="walk" aria-pressed="false" disabled>步行</button>
                </div>
                <button type="button" class="factory-fullscreen" data-factory-action="fullscreen" aria-label="全屏" title="全屏" hidden>⛶</button>
              </div>
            </div>
            <div class="factory-loading" data-factory-loading>
              <span>加载三维工厂</span>
              <progress data-factory-progress max="1" value="0" aria-label="工厂加载进度"></progress>
            </div>
            <div class="factory-loading" data-factory-error hidden>
              <p role="status">暂时无法打开三维工厂，仍可查看区域导览。</p>
              <button type="button" class="btn btn-primary" data-factory-action="retry">重试</button>
            </div>
            <div class="factory-crosshair" aria-hidden="true"></div>
            <p class="factory-bench-hint" data-factory-bench-hint hidden></p>
            <div class="factory-stick" data-factory-move aria-hidden="true">
              <span class="factory-stick-knob"></span>
            </div>
            <button type="button" class="btn btn-primary factory-interact" data-factory-action="interact" hidden>互动</button>
          </div>
          <div class="factory-console" id="factory-controls">
            <p data-factory-controls hidden>
              <span class="factory-overview-help">点编号进入工作台 · 点击画面后 <kbd>WASD</kbd> / 方向键平移 · 右键拖拽 · 滚轮缩放</span>
              <span class="factory-pan-touch-help">拖动地图平移，点编号进入工作台。</span>
              <span class="factory-key-help"><kbd>WASD</kbd> / <kbd>方向键</kbd> 移动 · 点击画面转向 · 靠近工作台按 <kbd>E</kbd> 操作 · <kbd>Esc</kbd> 释放</span>
              <span class="factory-touch-help">左侧圆盘移动，拖动画面转向。靠近工作台后点「操作工作台」。</span>
            </p>
            <button type="button" class="btn btn-secondary" data-factory-action="reset" hidden>回到入口</button>
          </div>
          <p class="factory-notice" data-factory-announcement role="status" aria-live="polite"></p>
        </div>
        <aside class="factory-directory" data-factory-directory aria-labelledby="factory-directory-title">
          <h2 id="factory-directory-title">车间导览</h2>
          <div class="factory-directory-switch" role="group" aria-label="导览内容" data-factory-catalog-switch hidden>
            <button type="button" data-factory-catalog="benches" aria-pressed="false" aria-controls="factory-benches">工作台</button>
            <button type="button" data-factory-catalog="zones" aria-pressed="true" aria-controls="factory-zones">区域</button>
          </div>
          <div id="factory-benches" class="factory-points" data-factory-benches role="group" aria-label="进入工作台" hidden></div>
          <div id="factory-zones" class="factory-zones" data-factory-zones>
            <div class="factory-points" data-factory-points role="group" aria-label="定位区域"></div>
            <div class="factory-detail">
              <h3 data-factory-active-zone>${escape(zones[0].label)}</h3>
              <p data-factory-blurb>${escape(zones[0].blurb)}</p>
              <a class="btn btn-secondary" href="#missions" data-factory-training hidden>打开任务手册</a>
            </div>
          </div>
        </aside>
        <section class="factory-bench-panel" data-factory-bench-panel aria-labelledby="factory-bench-title" hidden>
          <header class="factory-bench-header">
            <h2 id="factory-bench-title" data-factory-bench-title tabindex="-1"></h2>
            <button type="button" class="btn btn-secondary" data-factory-action="leave-bench">离开工作台</button>
          </header>
          <p class="factory-bench-transition" data-factory-bench-message role="status"></p>
          <div data-factory-bench-game></div>
        </section>
      </div>
      <nav class="factory-destinations" aria-label="工坊活动">
        ${destinations.map(([route, label]) => `<a class="btn btn-secondary" href="#${route}">${label}</a>`).join('')}
      </nav>
    </section>`;
}

export function bindFactoryPage(root, ctx) {
  const page = root.matches('[data-factory-page]') ? root : root.querySelector('[data-factory-page]');
  if (!page) return () => {};

  const find = selector => page.querySelector(selector);
  const sceneLayout = find('[data-factory-layout]');
  const stage = find('[data-factory-scene]');
  const canvasSelector = '[data-factory-canvas]';
  let canvas = find(canvasSelector);
  const loading = find('[data-factory-loading]');
  const progress = find('[data-factory-progress]');
  const failure = find('[data-factory-error]');
  const controls = find('[data-factory-controls]');
  const reset = find('[data-factory-action="reset"]');
  const fullscreen = find('[data-factory-action="fullscreen"]');
  const doc = page.ownerDocument;
  const interact = find('[data-factory-action="interact"]');
  const stick = find('[data-factory-move]');
  const location = find('[data-factory-location]');
  const announcement = find('[data-factory-announcement]');
  const directory = find('[data-factory-directory]');
  const catalogSwitch = find('[data-factory-catalog-switch]');
  const catalogButtons = [...catalogSwitch.querySelectorAll('[data-factory-catalog]')];
  const benchList = find('[data-factory-benches]');
  const zoneCatalog = find('[data-factory-zones]');
  const benchPanel = find('[data-factory-bench-panel]');
  const benchTitle = find('[data-factory-bench-title]');
  const benchMessage = find('[data-factory-bench-message]');
  const benchGame = find('[data-factory-bench-game]');
  const benchHint = find('[data-factory-bench-hint]');
  const pointGroup = find('[data-factory-points]');
  const pointButtons = zones.map(point => {
    const button = page.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'factory-point';
    button.dataset.factoryPoint = point.id;
    button.setAttribute('aria-pressed', String(point.id === 'entrance'));
    const label = page.ownerDocument.createElement('span');
    label.textContent = point.label;
    button.append(label);
    pointGroup.append(button);
    return button;
  });
  const modeButtons = [...page.querySelectorAll('[data-factory-mode]')];
  const activeName = find('[data-factory-active-zone]');
  const blurb = find('[data-factory-blurb]');
  const training = find('[data-factory-training]');
  const listeners = new AbortController();
  const eventOptions = { signal: listeners.signal };
  const visitor = !ctx.state().profile;
  const practiced = new Set();
  const benchButtons = new Map();
  let points = new Map(zones.map(point => [point.id, point]));
  let scene;
  let selected = 'entrance';
  let generation = 0;
  let ready = false;
  let mode = 'overview';
  let transitioning = false;
  let focusAfterMode = false;
  let movePointer = null;
  let lookPointer = null;
  let lookPosition;
  let walkPoint = null;
  let nearbyBench = null;
  let benchSession = null;
  let unmountGame;
  let catalog = 'zones';
  let catalogTouched = false;
  let disposed = false;

  function announce(text) {
    if (announcement.textContent !== text) announcement.textContent = text;
  }

  function showPoint(id) {
    const point = points.get(id);
    if (!point) return;
    selected = id;
    activeName.textContent = point.label;
    blurb.textContent = point.blurb;
    if (!benchSession) location.textContent = point.label;
    for (const button of pointButtons) button.setAttribute('aria-pressed', String(button.dataset.factoryPoint === id));
    training.hidden = !point.route;
    if (point.route) {
      const needsRole = visitor && point.route !== 'hall';
      training.setAttribute('href', '#' + (needsRole ? 'create' : point.route));
      training.textContent = needsRole ? '建角后开始训练' : (routeLabels[point.route] ?? '打开关联页面');
    }
  }

  function showCatalog(name) {
    catalog = name;
    benchList.hidden = name !== 'benches';
    zoneCatalog.hidden = name !== 'zones';
    for (const button of catalogButtons) button.setAttribute('aria-pressed', String(button.dataset.factoryCatalog === name));
  }

  function markPracticed(id) {
    practiced.add(id);
    const button = benchButtons.get(id);
    if (!button) return;
    button.lastElementChild.textContent = '已练习';
    button.dataset.practiced = 'true';
  }

  function showWorkbenches(benches) {
    benchButtons.clear();
    benchList.replaceChildren();
    benches.forEach((bench, index) => {
      const button = doc.createElement('button');
      const number = doc.createElement('span');
      const label = doc.createElement('span');
      const status = doc.createElement('span');
      button.type = 'button';
      button.className = 'factory-point factory-bench-entry';
      button.dataset.factoryBench = bench.id;
      number.className = 'factory-bench-number';
      number.textContent = String(index + 1).padStart(2, '0');
      number.setAttribute('aria-hidden', 'true');
      label.textContent = bench.label;
      status.className = 'factory-bench-status';
      button.append(number, label, status);
      benchList.append(button);
      benchButtons.set(bench.id, button);
      if (practiced.has(bench.id)) markPracticed(bench.id);
    });
    catalogSwitch.hidden = benches.length === 0;
    showCatalog(benches.length ? (catalogTouched ? catalog : 'benches') : 'zones');
  }

  function syncControls() {
    const working = Boolean(benchSession);
    const canInteract = ready && !working && !transitioning && mode === 'walk';
    for (const button of modeButtons) button.disabled = !ready || working;
    reset.hidden = !ready || working;
    interact.hidden = !canInteract || !(nearbyBench || walkPoint?.route);
    interact.textContent = nearbyBench ? '操作工作台' : '互动';
    interact.setAttribute('aria-label', nearbyBench ? `操作${nearbyBench.label}` : '互动');
    benchHint.hidden = !canInteract || !nearbyBench;
    benchHint.textContent = nearbyBench?.label ?? '';
    showFullscreen();
  }

  function showBench(bench, phase) {
    unmountGame?.();
    unmountGame = undefined;
    benchSession = phase === 'closed' ? null : bench;
    directory.hidden = Boolean(benchSession);
    benchPanel.hidden = !benchSession;
    if (!benchSession) {
      delete sceneLayout.dataset.benchPhase;
      delete stage.dataset.benchPhase;
      location.textContent = walkPoint?.label ?? '车间通道';
      syncControls();
      if (stage.getBoundingClientRect().top < 0) stage.scrollIntoView({ block: 'start' });
      canvas.focus({ preventScroll: true });
      return;
    }
    sceneLayout.dataset.benchPhase = phase;
    stage.dataset.benchPhase = phase;
    benchTitle.textContent = bench.label;
    location.textContent = '工作台视角';
    syncControls();
    benchMessage.textContent = phase === 'focusing' ? '正在对准台面…' : phase === 'leaving' ? '正在返回通道…' : '';
    if (phase === 'focusing') {
      focusAfterMode = false;
      stopMoving();
      stopLooking();
      announce('');
      if (doc.fullscreenElement === stage) void doc.exitFullscreen().catch(() => {});
      if (stage.getBoundingClientRect().top < 0) stage.scrollIntoView({ block: 'start' });
    }
    if (phase === 'ready') {
      unmountGame = mountFactoryWorkbench(benchGame, { id: bench.id, onComplete: () => markPracticed(bench.id) });
      benchTitle.focus({ preventScroll: true });
    }
  }

  function stopMoving(pointerId = movePointer) {
    if (pointerId === null || pointerId !== movePointer) return;
    movePointer = null;
    if (stick.hasPointerCapture(pointerId)) stick.releasePointerCapture(pointerId);
    stick.style.setProperty('--stick-x', '0px');
    stick.style.setProperty('--stick-y', '0px');
    scene?.moveTouch(0, 0);
  }

  function stopLooking(pointerId = lookPointer) {
    if (pointerId === null || pointerId !== lookPointer) return;
    lookPointer = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  }

  function showMode(next, changing = false) {
    if (next !== mode) {
      walkPoint = null;
      if (!benchSession) location.textContent = next === 'walk' ? '车间通道' : '厂区总览';
    }
    mode = next;
    transitioning = changing;
    stage.dataset.mode = next;
    page.dataset.factoryView = next;
    stage.dataset.transitioning = String(changing);
    for (const button of modeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.factoryMode === next));
    }
    syncControls();
    if (changing || next !== 'walk') {
      stopMoving();
      stopLooking();
    }
    if (ready && !changing && focusAfterMode) {
      focusAfterMode = false;
      canvas.focus({ preventScroll: true });
    }
  }

  function showFullscreen() {
    const expanded = doc.fullscreenElement === stage;
    const label = expanded ? '退出全屏' : '全屏';
    fullscreen.hidden = !ready || Boolean(benchSession) || !doc.fullscreenEnabled || !stage.requestFullscreen;
    fullscreen.setAttribute('aria-label', label);
    fullscreen.setAttribute('aria-pressed', String(expanded));
    fullscreen.title = label;
  }

  async function toggleFullscreen() {
    try {
      if (doc.fullscreenElement === stage) await doc.exitFullscreen();
      else await stage.requestFullscreen();
      canvas.focus({ preventScroll: true });
    } catch {
      announce('此浏览器暂时无法切换全屏。');
    }
  }

  function showState(state) {
    ready = state === 'ready';
    stage.dataset.state = state;
    stage.setAttribute('aria-busy', String(state === 'loading'));
    loading.hidden = state !== 'loading';
    failure.hidden = state !== 'failed';
    controls.hidden = !ready;
    canvas.tabIndex = ready ? 0 : -1;
    if (ready) canvas.removeAttribute('aria-hidden');
    else canvas.setAttribute('aria-hidden', 'true');
    showMode(mode, transitioning);
  }

  async function loadScene() {
    const current = ++generation;
    const active = () => !disposed && current === generation;
    stopMoving();
    stopLooking();
    scene?.destroy();
    scene = undefined;
    if (current > 1) {
      const replacement = canvas.cloneNode(false);
      canvas.replaceWith(replacement);
      canvas = replacement;
    }
    progress.value = 0;
    announce('');
    showState('loading');
    showMode('overview');
    try {
      const { createFactoryScene } = await import('./factory-view.js');
      if (!active()) return;
      scene = createFactoryScene(canvas, {
        onProgress(value) {
          if (active() && Number.isFinite(value)) progress.value = Math.min(1, Math.max(0, value));
        },
        onReady(layout) {
          if (!active()) return;
          const next = new Map(zones.map(point => [point.id, point]));
          for (const point of layout?.points ?? []) next.set(point.id, { ...next.get(point.id), ...point });
          points = next;
          for (const button of pointButtons) {
            button.firstElementChild.textContent = points.get(button.dataset.factoryPoint).label;
          }
          showWorkbenches(layout?.benches ?? []);
          showPoint(selected);
        },
        onMode(next, changing) {
          if (active()) showMode(next, changing);
        },
        onZone(point) {
          if (!active()) return;
          if (mode === 'walk') walkPoint = point;
          if (point?.id) showPoint(point.id);
          else if (mode === 'walk' && !benchSession) location.textContent = '车间通道';
          syncControls();
        },
        onBenchNearby(bench) {
          if (!active()) return;
          nearbyBench = bench;
          syncControls();
        },
        onBench(bench, phase) {
          if (active()) showBench(bench, phase);
        },
        onStatus(text) {
          if (active() && !benchSession) announce(text ?? '');
        },
        onInteract(point) {
          if (!active() || !point) return;
          showPoint(point.id);
          const route = point.route ?? points.get(point.id)?.route;
          if (route) ctx.go(visitor && route !== 'hall' ? 'create' : route);
        },
      });
      await scene.ready;
      if (!active()) return;
      showState('ready');
      if (selected !== 'entrance') scene.jumpTo(selected);
    } catch {
      if (!active()) return;
      scene?.destroy();
      scene = undefined;
      showState('failed');
      announce('');
    }
  }

  function dragStick(event) {
    const { left, top, width, height } = stick.getBoundingClientRect();
    const radius = Math.min(width, height) * .36;
    if (!radius) return;
    const x = (event.clientX - left - width / 2) / radius;
    const y = (event.clientY - top - height / 2) / radius;
    const distance = Math.max(1, Math.hypot(x, y));
    stick.style.setProperty('--stick-x', `${x / distance * radius}px`);
    stick.style.setProperty('--stick-y', `${y / distance * radius}px`);
    scene.moveTouch(x / distance, y / distance);
  }

  const canWalk = () => ready && scene && mode === 'walk' && !transitioning && !benchSession;
  page.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.factoryCatalog) {
      catalogTouched = true;
      showCatalog(button.dataset.factoryCatalog);
      return;
    }
    if (button.dataset.factoryBench && ready && !benchSession) {
      scene.focusBench(button.dataset.factoryBench);
      return;
    }
    if (button.dataset.factoryPoint) {
      catalogTouched = true;
      showPoint(button.dataset.factoryPoint);
      if (ready) scene.jumpTo(button.dataset.factoryPoint);
      return;
    }
    const next = button.dataset.factoryMode;
    if (next && ready && !benchSession && next !== mode) {
      focusAfterMode = true;
      scene.setMode(next);
      return;
    }
    const action = button.dataset.factoryAction;
    if (action === 'retry') loadScene();
    if (action === 'leave-bench' && benchSession) scene.exitBench();
    if (action === 'fullscreen' && ready && !benchSession) void toggleFullscreen();
    if (action === 'reset' && ready && !benchSession) {
      scene.reset();
      showPoint('entrance');
    }
    if (action === 'interact' && canWalk()) scene.interact();
  }, eventOptions);

  stick.addEventListener('pointerdown', event => {
    if (!canWalk() || movePointer !== null || event.button !== 0) return;
    event.preventDefault();
    movePointer = event.pointerId;
    stick.setPointerCapture(movePointer);
    dragStick(event);
  }, eventOptions);
  stick.addEventListener('pointermove', event => {
    if (canWalk() && event.pointerId === movePointer) dragStick(event);
  }, eventOptions);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stick.addEventListener(type, event => stopMoving(event.pointerId), eventOptions);
  }

  stage.addEventListener('pointerdown', event => {
    if (event.target !== canvas || !canWalk() || event.pointerType === 'mouse' || lookPointer !== null) return;
    event.preventDefault();
    lookPointer = event.pointerId;
    lookPosition = [event.clientX, event.clientY];
    canvas.setPointerCapture(lookPointer);
  }, eventOptions);
  stage.addEventListener('pointermove', event => {
    if (!canWalk() || event.pointerId !== lookPointer) return;
    const [x, y] = lookPosition;
    lookPosition = [event.clientX, event.clientY];
    scene.lookTouch(event.clientX - x, event.clientY - y);
  }, eventOptions);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stage.addEventListener(type, event => stopLooking(event.pointerId), eventOptions);
  }
  doc.addEventListener('fullscreenchange', showFullscreen, eventOptions);
  window.addEventListener('blur', () => {
    stopMoving();
    stopLooking();
  }, eventOptions);

  void loadScene();
  return () => {
    if (disposed) return;
    disposed = true;
    stopMoving();
    stopLooking();
    unmountGame?.();
    listeners.abort();
    if (doc.fullscreenElement === stage) void doc.exitFullscreen().catch(() => {});
    scene?.destroy();
  };
}
