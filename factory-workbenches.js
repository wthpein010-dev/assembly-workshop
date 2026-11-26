const props = {
  ram16: ['内存条 B16', 'part-memory', 'B16'],
  ram8: ['内存条 B08', 'part-memory', 'B08'],
  lead: ['连接线 C32', 'part-cable', 'C32'],
  ssd: ['固态硬盘', 'part-ssd', 'SSD'],
  screw: ['固定螺丝', 'part-screw', 'M2'],
  'fan-line': ['风扇线', 'part-cable', 'FAN'],
  'data-line': ['数据线', 'part-cable', 'DATA'],
  'light-line': ['灯条线', 'part-cable', 'LED'],
  sample: ['工件 A07', 'part-memory', 'A07'],
  probe: ['检测探针', null, '⌁'],
  'bad-ssd': ['原硬盘 D17', 'part-ssd', 'D17'],
  'new-ssd': ['对照硬盘 D18', 'part-ssd', 'D18'],
  seal: ['封签 PK-07', 'part-tag', 'PK-07'],
  'matched-label': ['箱签 PK-07', 'part-tag', 'PK-07'],
  'other-label': ['箱签 PK-19', 'part-tag', 'PK-19'],
  meter: ['读取工件量表', null, '⌁'],
};

const receivers = {
  'kit-basket': ['备料篮', '核对单 K07', 'tray'],
  'return-basket': ['退料篮', '余料回收', 'tray'],
  dimm: ['内存插槽', 'DIMM', 'socket'],
  'ssd-bay': ['硬盘托位', 'SSD', 'socket'],
  mount: ['固定孔', 'M2', 'socket'],
  fan: ['风扇接口', 'FAN', 'socket'],
  data: ['数据接口', 'DATA', 'socket'],
  light: ['灯条接口', 'LED', 'socket'],
  pass: ['放行盘', '合格品', 'tray'],
  reject: ['复检盘', '异常品', 'tray'],
  'diagnostic-port': ['测试触点', 'D17', 'socket'],
  isolation: ['隔离托盘', '待复核', 'tray'],
  carton: ['产品外箱', 'PK-07', 'tray'],
  flap: ['箱盖封签位', 'PK-07', 'socket'],
  side: ['箱侧标签位', '物流标识', 'socket'],
};

const move = (title, prompt, items, targets, solution, success, error) => ({
  kind: 'move', title, prompt, items, targets, solution, success, error,
});
const scan = (title, prompt, items, solution, success, error) => ({
  kind: 'scan', title, prompt, items, solution, success, error,
});
const command = (title, prompt, item, label, success) => ({ kind: 'command', title, prompt, item, label, success });

const scenarios = {
  materials: {
    theme: '备料单 K07',
    stages: [
      scan('扫物料码', '备料单需要 B16 内存条和 C32 连接线。先扫对内存条。', ['ram8', 'ram16'], 'ram16',
        '识别到物料 B16，与备料单一致。', '这个条码对应 B08。核对工单上的 B16 后重扫。'),
      move('配内存条', '将刚登记的 B16 放进备料篮。', ['ram16', 'ram8'], ['kit-basket', 'return-basket'], ['ram16', 'kit-basket'],
        '备料篮已接收 B16。', '这张备料单只接收 B16，目标是备料篮。'),
      move('补齐套件', '将 C32 放进同一备料篮，配齐这张工单。', ['lead', 'screw'], ['kit-basket', 'return-basket'], ['lead', 'kit-basket'],
        'B16 和 C32 已配齐，可以交给装配台。', '请把 C32 连接线送进备料篮。'),
    ],
  },
  assembly: {
    theme: '装配底板 A12',
    stages: [
      move('压入内存', '按工单顺序先装 B16，把内存条送入内存插槽。', ['ram16', 'ssd'], ['dimm', 'ssd-bay'], ['ram16', 'dimm'],
        '内存条入位，两侧卡扣已确认。', '这一步先装内存条，槽位丝印为 DIMM。'),
      move('装入硬盘', '从托盘拿固态硬盘，装入硬盘托位。', ['ssd', 'screw'], ['ssd-bay', 'mount'], ['ssd', 'ssd-bay'],
        '硬盘触点已入位，下一步固定。', '托位标有 SSD。先装硬盘，再固定。'),
      move('固定硬盘', '把 M2 固定螺丝放到对应孔位。', ['screw', 'lead'], ['mount', 'ssd-bay'], ['screw', 'mount'],
        '固定点已锁定，装配检查完成。', '请检查 M2 固定孔和当前托盘零件。'),
    ],
  },
  wiring: {
    theme: '模拟线束面板',
    stages: [
      move('接风扇线', '按接口丝印，将风扇线接入 FAN。', ['fan-line', 'data-line', 'light-line'], ['fan', 'data', 'light'], ['fan-line', 'fan'],
        'FAN 通道已接通。', '风扇线要接入 FAN，两个标签应一致。'),
      move('接数据线', '将数据线接入 DATA，保留 LED 为空。', ['data-line', 'light-line'], ['fan', 'data', 'light'], ['data-line', 'data'],
        'DATA 通道已接通。', '检查 DATA 标识，LED 口在本轮留空。'),
      command('检查通路', '已接两条线。启动低压模拟测试，检查通路。', 'continuity', '运行通路检查', 'FAN 和 DATA 的通路检查均通过。'),
    ],
  },
  packing: {
    theme: '包装单 PK-07',
    stages: [
      move('装箱', '把复核后的工件 A07 装进产品外箱。', ['sample', 'seal'], ['carton', 'flap'], ['sample', 'carton'],
        '工件已入箱。', '工件先进外箱，封签留到下一步。'),
      move('封签', '用 PK-07 封签盖住箱盖封签位。', ['seal', 'other-label'], ['flap', 'side'], ['seal', 'flap'],
        '箱盖已经封签，等待复核。', '使用 PK-07 封签，贴在箱盖封签位。'),
      scan('核对箱签', '扫描与包装单一致的箱签，确认可以出站。', ['matched-label', 'other-label'], 'matched-label',
        '箱签和封签记录一致，已完成包装。', '包装单号是 PK-07，请重新扫码。'),
    ],
  },
  repair: {
    theme: '维修单 D17',
    stages: [
      move('检测原件', '把检测探针移到标为 D17 的测试触点。', ['probe', 'new-ssd'], ['diagnostic-port', 'ssd-bay'], ['probe', 'diagnostic-port'],
        '检测提示 D17 读数异常。', '用探针探测 D17 触点后，再判断是否更换。'),
      move('隔离故障件', '把原硬盘 D17 放入隔离托盘。', ['bad-ssd', 'new-ssd'], ['isolation', 'ssd-bay'], ['bad-ssd', 'isolation'],
        'D17 已隔离，故障记录仍保留。', '仅隔离原硬盘 D17，保留对照件。'),
      move('装上对照件', '将 D18 对照硬盘装入 SSD 托位。', ['new-ssd', 'bad-ssd'], ['ssd-bay', 'isolation'], ['new-ssd', 'ssd-bay'],
        'D18 已替换入位。', '请用 D18 占用 SSD 托位，D17 已标记隔离。'),
      command('复测', '启动模拟复测，确认故障是否消除。', 'retest', '开始复测', 'D18 的读数已恢复至合格区间。'),
    ],
  },
  calibration: {
    theme: '传感器校准台',
    stages: [{
      kind: 'adjust', title: '对准校验点', prompt: '用方向键或方向钮移动传感器，使中心与目标重合，再运行检测。',
      item: 'validate', label: '运行定位检测', success: '中心已对准，定位检测通过。',
      error: '中心与目标仍有偏移。保留当前位置，微调后再测。',
    }],
  },
};

function inspection(attempt) {
  const reading = attempt % 2 ? 18 : 10;
  const healthy = reading <= 12;
  return {
    theme: '首件质检 A07',
    stages: [
      command('启动检测台', '给模拟面板通电，再读取 A07 量表。', 'power', '启动模拟检测', '检测台已就绪。'),
      {
        ...scan('读量表', '点击量表读取 A07 数据。合格范围为 8 至 12 格。', ['meter'], 'meter', '', ''),
        readout: `A07 读数 ${reading} 格 · 合格范围 8–12 格`,
        success: `量表已记录 ${reading} 格。对照合格范围处理工件。`,
      },
      move('分流工件', '根据刚才的量表结果，把 A07 放入正确托盘。', ['sample'], ['pass', 'reject'],
        ['sample', healthy ? 'pass' : 'reject'],
        healthy ? '读数在合格区间，A07 已放行。' : '读数超出范围，A07 已送去复检。',
        '再对照量表显示的读数和合格区间。'),
    ],
  };
}

export function createWorkbenchRun(id, attempts = 1) {
  const scenario = id === 'inspection' ? inspection(attempts) : Object.hasOwn(scenarios, id) ? scenarios[id] : null;
  if (!scenario) return null;
  return {
    id, scenario, attempts, step: 0, mistakes: 0, result: null, feedback: null, readout: '',
    position: { x: 0, y: 0 }, goal: attempts % 2 ? { x: 2, y: -1 } : { x: -2, y: 1 },
    placements: {}, startedAt: Date.now(),
  };
}

function matchesStep(stage, run, action) {
  if (stage.kind === 'move' && action.type === 'move' && stage.items.includes(action.item) && stage.targets.includes(action.target)) {
    return action.item === stage.solution[0] && action.target === stage.solution[1];
  }
  if (stage.kind === 'scan' && action.type === 'scan' && stage.items.includes(action.item)) return action.item === stage.solution;
  if (action.type !== 'command' || action.item !== stage.item) return null;
  if (stage.kind === 'command') return true;
  if (stage.kind === 'adjust') return run.position.x === run.goal.x && run.position.y === run.goal.y;
  return null;
}

export function performWorkbenchAction(run, action) {
  if (!run || !action || run.result || action.step !== run.step) return false;
  if (action.type === 'retry') {
    if (run.feedback?.kind !== 'wrong') return false;
    run.feedback = null;
    return true;
  }
  if (run.feedback?.kind === 'wrong') return false;

  const stage = run.scenario.stages[run.step];
  if (stage.kind === 'adjust' && action.type === 'nudge') {
    if (!['x', 'y'].includes(action.axis) || ![-1, 1].includes(action.delta)) return false;
    const next = run.position[action.axis] + action.delta;
    if (next < -3 || next > 3) return false;
    run.position[action.axis] = next;
    return true;
  }

  const matched = matchesStep(stage, run, action);
  if (matched === null) return false;
  if (!matched) {
    run.mistakes++;
    run.feedback = { kind: 'wrong', message: stage.error, target: action.target };
    return true;
  }

  if (stage.readout) run.readout = stage.readout;
  if (action.type === 'move') {
    const items = run.placements[action.target] ?? [];
    run.placements[action.target] = [...items, action.item];
  }
  run.step++;
  run.feedback = { kind: 'good', message: stage.success, target: action.target };
  if (run.step === run.scenario.stages.length) {
    run.result = Object.freeze({
      id: run.id, score: Math.max(0, 100 - run.mistakes * 10), mistakes: run.mistakes, steps: run.step,
      attempts: run.attempts, elapsedMs: Math.max(0, Date.now() - run.startedAt),
    });
  }
  return true;
}

function propArt(id) {
  const [, asset, mark] = props[id];
  return asset
    ? `<img class="fwb-part" src="${new URL('./assets/' + asset + '.webp', import.meta.url).href}" alt="" draggable="false">`
    : `<span class="fwb-emblem" aria-hidden="true">${mark}</span>`;
}

const signed = (value) => value === 0 ? '0' : value > 0 ? '+' + value : '−' + Math.abs(value);
const axes = (point) => `X ${signed(point.x)} / Y ${signed(point.y)}`;

function progress(run) {
  const { stages, theme } = run.scenario;
  const steps = stages.map(({ title }, index) => {
    const state = run.step > index ? 'done' : run.step === index ? 'current' : 'pending';
    return `<li data-state="${state}"${state === 'current' ? ' aria-current="step"' : ''}>
      <span aria-hidden="true">${state === 'done' ? '✓' : index + 1}</span><small>${title}</small>
    </li>`;
  }).join('');
  return `<div class="fwb-progress">
    <p><strong>${theme}</strong><span>${run.step} / ${stages.length} 完成</span></p>
    <progress max="${stages.length}" value="${run.step}" aria-label="工序进度"></progress>
    ${stages.length > 1 ? `<ol aria-label="工序">${steps}</ol>` : ''}
  </div>`;
}

function itemButton(id, kind, disabled) {
  const [label, , mark] = props[id];
  const moving = kind === 'move';
  return `<button type="button" class="fwb-piece" ${moving
    ? `data-fwb-item="${id}" draggable="${!disabled}" aria-pressed="false"`
    : `data-fwb-scan="${id}"`}${disabled ? ' disabled' : ''}>
    ${propArt(id)}
    <strong>${label}</strong>
    <small>${moving ? mark : id === 'meter' ? '模拟量表' : '<span class="fwb-barcode" aria-hidden="true"></span>扫码'}</small>
  </button>`;
}

function moveForm(stage, run, disabled) {
  return `<div class="fwb-control">
    <p class="fwb-strip-label">可用物料</p>
    <div class="fwb-tray" aria-label="可用物料">${stage.items.map((id) => itemButton(id, 'move', disabled)).join('')}</div>
    <p class="fwb-strip-label">放置区</p>
    <div class="fwb-targets" aria-label="放置区">
      ${stage.targets.map((id) => {
        const [label, mark, category] = receivers[id];
        const placed = run.placements[id];
        const tone = run.feedback?.target === id ? run.feedback.kind : '';
        return `<button type="button" class="fwb-slot" data-fwb-slot="${id}" data-shape="${category}" data-tone="${tone}"${disabled ? ' disabled' : ''}>
          ${placed?.length
            ? `<span class="fwb-slot-loaded" title="${placed.map((part) => props[part][0]).join('、')}">${propArt(placed.at(-1))}<b>${placed.length}</b></span>`
            : '<span class="fwb-slot-mark" aria-hidden="true"></span>'}
          <strong>${label}</strong><small>${mark}</small>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function commandButton(stage, disabled) {
  return `<button type="button" class="fwb-primary fwb-command" data-fwb-command="${stage.item}"${disabled ? ' disabled' : ''}>
    <span aria-hidden="true">⏻</span>${stage.label}</button>`;
}

function adjustForm(stage, run, disabled) {
  const pos = (point) => `--fwb-x:${(point.x + 3.5) * 100 / 7}%;--fwb-y:${(3.5 - point.y) * 100 / 7}%`;
  const sides = [['x', -1, '向左', '←'], ['y', 1, '向上', '↑'], ['y', -1, '向下', '↓'], ['x', 1, '向右', '→']];
  return `<div class="fwb-adjust">
    <div class="fwb-grid" data-fwb-adjust role="group" tabindex="${disabled ? -1 : 0}"
      aria-label="校准平面。当前位置 ${axes(run.position)}。目标 ${axes(run.goal)}。方向键微调">
      <span class="fwb-goal" style="${pos(run.goal)}" aria-hidden="true"></span>
      <span class="fwb-position" style="${pos(run.position)}" aria-hidden="true"></span>
    </div>
    <p class="fwb-axes"><span>当前位置 <b>${axes(run.position)}</b></span><span>目标 <b>${axes(run.goal)}</b></span></p>
    <div class="fwb-arrows" aria-label="调整方向">${sides.map(([axis, delta, label, symbol]) =>
      `<button type="button" aria-label="${label}" data-fwb-axis="${axis}" data-fwb-delta="${delta}"
        ${disabled || Math.abs(run.position[axis] + delta) > 3 ? ' disabled' : ''}>${symbol}</button>`).join('')}
    </div>
    ${commandButton(stage, disabled)}
  </div>`;
}

function actionForm(stage, run, disabled) {
  if (stage.kind === 'move') return moveForm(stage, run, disabled);
  if (stage.kind === 'adjust') return adjustForm(stage, run, disabled);
  if (stage.kind === 'command') return `<div class="fwb-console">${commandButton(stage, disabled)}</div>`;
  return `<div class="fwb-scan" aria-label="${stage.title}">${stage.items.map((id) => itemButton(id, 'scan', disabled)).join('')}</div>`;
}

function resultPage(run) {
  const { score, mistakes, elapsedMs } = run.result;
  return `<section class="fwb-result" aria-label="本轮结果">
    <h3><span aria-hidden="true">✓</span> 本台练习完成</h3>
    <dl>
      <div><dt>得分</dt><dd>${score}<small> 分</small></dd></div>
      <div><dt>返工</dt><dd>${mistakes}<small> 次</small></dd></div>
      <div><dt>用时</dt><dd>${Math.max(1, Math.ceil(elapsedMs / 1000))}<small> 秒</small></dd></div>
    </dl>
  </section>`;
}

const keyboardMove = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['y', 1], ArrowDown: ['y', -1] };

export function mountFactoryWorkbench(container, { id, onComplete } = {}) {
  let run = createWorkbenchRun(id);
  if (!run || !container) return () => {};
  const document = container.ownerDocument;
  const root = document.createElement('div');
  root.className = 'factory-workbench';
  root.dataset.fwb = id;
  root.innerHTML = '<div data-fwb-body></div><p class="fwb-note" data-fwb-feedback role="status" aria-live="polite"></p><div class="fwb-footer" data-fwb-footer></div>';
  const content = root.querySelector('[data-fwb-body]');
  const notice = root.querySelector('[data-fwb-feedback]');
  const footer = root.querySelector('[data-fwb-footer]');
  let selected = null;
  let dragPayload = '';
  const controller = new AbortController();

  function syncSelection(item) {
    selected = item;
    for (const button of root.querySelectorAll('[data-fwb-item]')) {
      button.setAttribute('aria-pressed', String(button.dataset.fwbItem === item));
    }
    root.classList.toggle('fwb-is-placing', !!item);
    notice.dataset.tone = item ? 'ready' : run.feedback?.kind ?? 'ready';
    notice.textContent = item ? '已选 ' + props[item][0] + '，点放置区即可放入。'
      : run.feedback?.message ?? '可用鼠标拖放，也可先点物料再点放置区。';
  }

  function render() {
    const stage = run.scenario.stages[run.step];
    const blocked = run.feedback?.kind === 'wrong';
    selected = null;
    dragPayload = '';
    root.classList.remove('fwb-is-placing');
    root.dataset.fwbPhase = run.result ? 'complete' : blocked ? 'retry' : stage.kind;
    root.dataset.fwbStep = String(run.step);
    content.innerHTML = progress(run) + (run.result ? resultPage(run) : `<section class="fwb-active">
      <h3>${stage.title}</h3><p>${stage.prompt}</p>
      ${run.readout ? `<p class="fwb-reading">${run.readout}</p>` : ''}
      ${actionForm(stage, run, blocked)}
    </section>`);
    notice.dataset.tone = run.feedback?.kind ?? 'ready';
    notice.textContent = run.feedback?.message ?? (stage.kind === 'move' ? '可用鼠标拖放，也可先点物料再点放置区。'
      : stage.kind === 'adjust' ? '点击方向钮，或聚焦校准平面后使用方向键。' : '');
    footer.innerHTML = run.result ? '<button type="button" class="fwb-primary" data-fwb-action="replay">再练一轮</button>'
      : blocked ? '<button type="button" class="fwb-primary" data-fwb-action="retry">重试当前工序</button>' : '';
  }

  function focusFirst() {
    const order = ['[data-fwb-action]', '[data-fwb-item]', '[data-fwb-scan]', '[data-fwb-adjust]', '[data-fwb-command]'];
    for (const type of order) {
      const element = root.querySelector(type + ':not(:disabled)');
      if (element) { element.focus({ preventScroll: true }); return; }
    }
  }

  function submit(details, keyboard = false, focusBack = '') {
    const completeBefore = run.result;
    if (!performWorkbenchAction(run, { step: run.step, ...details })) return;
    render();
    if (keyboard) {
      const prior = focusBack && root.querySelector(focusBack);
      if (prior && !prior.disabled) prior.focus({ preventScroll: true });
      else focusFirst();
    }
    if (!completeBefore && run.result) onComplete?.(run.result);
  }

  root.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target || target.disabled) return;
    const keyboard = event.detail === 0;
    const { fwbAction, fwbItem, fwbSlot, fwbCommand, fwbScan, fwbAxis, fwbDelta } = target.dataset;
    if (fwbAction === 'replay') {
      run = createWorkbenchRun(id, run.attempts + 1);
      render();
      if (keyboard) focusFirst();
    } else if (fwbAction === 'retry') {
      submit({ type: 'retry' }, keyboard);
    } else if (fwbItem) {
      syncSelection(selected === fwbItem ? null : fwbItem);
      if (selected && keyboard) root.querySelector('[data-fwb-slot]')?.focus({ preventScroll: true });
    } else if (fwbSlot) {
      if (selected) submit({ type: 'move', item: selected, target: fwbSlot }, keyboard);
      else {
        notice.textContent = '先从物料区选择一件物料。';
        if (keyboard) focusFirst();
      }
    } else if (fwbScan) {
      submit({ type: 'scan', item: fwbScan }, keyboard);
    } else if (fwbCommand) {
      submit({ type: 'command', item: fwbCommand }, keyboard);
    } else if (fwbAxis) {
      submit({ type: 'nudge', axis: fwbAxis, delta: Number(fwbDelta) }, keyboard,
        `[data-fwb-axis="${fwbAxis}"][data-fwb-delta="${fwbDelta}"]`);
    }
  }, { signal: controller.signal });

  root.addEventListener('keydown', (event) => {
    if (!event.target.matches('[data-fwb-adjust]') || !Object.hasOwn(keyboardMove, event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const [axis, delta] = keyboardMove[event.key];
    submit({ type: 'nudge', axis, delta }, true, '[data-fwb-adjust]');
  }, { signal: controller.signal });

  const dragType = 'application/x-factory-workbench-part';
  root.addEventListener('dragstart', (event) => {
    const source = event.target.closest('[data-fwb-item][draggable="true"]');
    if (!source) return;
    dragPayload = [run.id, run.attempts, run.step, source.dataset.fwbItem].join('/');
    event.dataTransfer.setData(dragType, dragPayload);
    event.dataTransfer.effectAllowed = 'move';
    syncSelection(source.dataset.fwbItem);
  }, { signal: controller.signal });

  root.addEventListener('dragover', (event) => {
    const slot = event.target.closest('[data-fwb-slot]:enabled');
    if (!slot || !dragPayload || !Array.from(event.dataTransfer.types).includes(dragType)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    slot.dataset.dragOver = 'true';
  }, { signal: controller.signal });

  root.addEventListener('dragleave', (event) => {
    const slot = event.target.closest('[data-fwb-slot]');
    if (slot && !slot.contains(event.relatedTarget)) delete slot.dataset.dragOver;
  }, { signal: controller.signal });

  root.addEventListener('drop', (event) => {
    const slot = event.target.closest('[data-fwb-slot]:enabled');
    if (!slot || !dragPayload) return;
    event.preventDefault();
    delete slot.dataset.dragOver;
    if (event.dataTransfer.getData(dragType) !== dragPayload || !selected) return;
    submit({ type: 'move', item: selected, target: slot.dataset.fwbSlot });
  }, { signal: controller.signal });

  root.addEventListener('dragend', () => {
    if (!dragPayload) return;
    dragPayload = '';
    for (const slot of root.querySelectorAll('[data-drag-over]')) delete slot.dataset.dragOver;
    syncSelection(null);
  }, { signal: controller.signal });

  render();
  container.append(root);
  return () => {
    controller.abort();
    root.remove();
  };
}
