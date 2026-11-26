const missions = [
  {
    id: 'memory', code: 'M-01', kind: '主线', title: '安装内存', area: '带教工位', skill: 'assembly', training: '装配',
    detail: '完成一轮带提示的内存安装，认识部件、缺口和工位自检。',
    xp: 40, coins: 35, gain: 20, image: 'part-memory',
    steps: [
      {
        title: '检查部件', situation: '在工位上点选内存条，核对本轮物料。',
        hint: '认准带金色触点和定位缺口的长条部件。',
        options: ['inspect', 'inspect-cable', 'skip-inspect'],
        answer: 'inspect', feedback: '内存条已核对。工单和托盘中的部件一致。',
      },
      {
        title: '对齐缺口', situation: '工单指定槽位 B。旋转内存条，让缺口朝右，再把它放入槽位。',
        hint: '先转动内存条，再拖到槽位 B。也可以先选内存条，再点槽位。',
        error: '缺口未对齐',
        options: ['reverse', 'align'],
        answer: 'align', feedback: '模块缺口与槽位 B 的标记一致，可以继续。',
      },
      {
        title: '压入内存', situation: '按住或点按内存条，把两侧卡扣一起锁定。',
        hint: '点击内存条中央可同步确认两侧。',
        options: ['force', 'seat', 'verify-first'],
        answer: 'seat', feedback: '两侧均显示锁定，模拟内存条已就位。',
      },
      {
        title: '完成自检', situation: '在工位终端运行自检，确认系统识别内存。',
        hint: '运行模拟自检，看到系统确认识别模块。',
        options: ['done', 'change', 'check'],
        answer: 'check', feedback: '自检通过，系统已识别内存模块。',
      },
    ],
  },
  {
    id: 'assembly', code: 'M-02', kind: '主线', title: '首台电脑', area: '独立装配工位', skill: 'assembly', training: '装配',
    detail: '领取一份装配工单，独立完成备料、模拟入位和测试交接。',
    xp: 80, coins: 45, gain: 25, requires: 'memory', image: 'station',
    steps: [
      {
        title: '核对工单', situation: '把工单指定的 B16 模块拖到核对区。',
        options: ['nearest', 'anonymous', 'order'],
        answer: 'order', feedback: '物料已核对。工单型号与部件一致。',
      },
      {
        title: '确认工位', situation: '检查工位就绪灯，再开始模拟装配。',
        options: ['assemble-anyway', 'verify-bench', 'edit-order'],
        answer: 'verify-bench', feedback: '工位点检已完成，状态变为「可用」。',
      },
      {
        title: '装入固态硬盘', situation: '从托盘取出固态硬盘，装入机箱的硬盘托位。',
        options: ['fit', 'dispatch', 'ignore-right'],
        answer: 'fit', feedback: '硬盘已装入托位，装配件可以进入测试。',
      },
      {
        title: '提交工位测试', situation: '按住或点按工位终端，生成本轮测试记录。',
        options: ['verbal', 'run', 'stamp'],
        answer: 'run', feedback: '已生成测试记录并关联本轮工单。',
      },
    ],
  },
  {
    id: 'quality', code: 'M-03', kind: '主线', title: '首件质量复核', area: '质检工位', skill: 'quality', training: '质检',
    detail: '核对检测记录，追踪证据，并作出首件放行判断。',
    xp: 190, coins: 55, gain: 30, requires: 'assembly', image: 'quality-board',
    steps: [
      {
        title: '确认检测记录', situation: 'A17 外观正常。点击台面记录，查找自检异常。',
        options: ['look', 'review-log', 'assume'],
        answer: 'review-log', feedback: '记录对应 A17，异常项目已定位。',
      },
      {
        title: '保存证据', situation: '将原始检测记录放入对应工件的证据夹。',
        options: ['evidence', 'replace', 'picture'],
        answer: 'evidence', feedback: '工件、日志和复核记录已关联。',
      },
      {
        title: '作出处置', situation: 'A17 复测仍异常。给 A17 贴上对应的处置签。',
        options: ['release', 'hide', 'hold'],
        answer: 'hold', feedback: '已记录暂缓放行并生成异常单。',
      },
    ],
  },
  {
    id: 'fault', code: 'S-01', kind: '支线', title: '故障排查委托', area: '异常工位', skill: 'repair', training: '排障',
    detail: '通过模拟工位的比较试验，定位一条间歇异常的线索。',
    xp: 150, coins: 50, gain: 25, requires: 'quality', image: 'station',
    steps: [
      {
        title: '划定排查范围', situation: '把反复告警的模块移到隔离托盘，保留排查线索。',
        options: ['change-all', 'isolate', 'clear'],
        answer: 'isolate', feedback: '已保留待排查的工件和原始日志。',
      },
      {
        title: '比较两轮记录', situation: '用对照模块替换检测槽内的原模块，观察告警变化。',
        options: ['blame-bench', 'dismiss', 'compare'],
        answer: 'compare', feedback: '对照试验表明原模块需要进一步复核。',
      },
      {
        title: '移交异常单', situation: '把原始记录和对照结果一起交给组长复核。',
        options: ['escalate', 'archive', 'announce'],
        answer: 'escalate', feedback: '异常单和证据已交给班组长复核。',
      },
    ],
  },
  {
    id: 'cert', code: 'R-01', kind: '考核', title: '岗位实操认证', area: '考核工位', skill: 'assembly', training: '装配',
    detail: '完成模拟岗位考核，提交导师复核，领取游戏内岗位徽章。',
    xp: 240, coins: 80, gain: 15, requires: 'quality', image: 'quality-board',
    steps: [
      {
        title: '确认考核工单', situation: '在本轮考核终端完成签入。',
        options: ['skip', 'sign-in', 'borrow-ticket'],
        answer: 'sign-in', feedback: '本轮考核和训练档案已关联。',
      },
      {
        title: '执行模拟装配', situation: '接入已核对的线缆，完成模拟装配。',
        options: ['follow-plan', 'complete-now', 'copy'],
        answer: 'follow-plan', feedback: '模拟工位已确认每项装配状态。',
      },
      {
        title: '提交检测结论', situation: '自检发现一项超限。给对应项目单贴签。',
        options: ['forget', 'treat-pass', 'report'],
        answer: 'report', feedback: '检测结论与工位记录一致。',
      },
      {
        title: '完成岗位交接', situation: '把完整的交接材料放入下一班接收夹。',
        options: ['close', 'hand-off', 'send-name'],
        answer: 'hand-off', feedback: '交接记录已生成，可以提交导师复核。',
      },
    ],
  },
];

const inspect = (points, scene) => ({ kind: 'inspect', points, scene });
const press = (points) => ({ kind: 'press', points });
const drop = (items, points, solution, settings = {}) => ({ kind: 'drop', items, points, solution, ...settings });

// Points follow the locations of the props in their 16:9 scene.
const workbenches = {
  memory: [
    inspect([['inspect', '内存条', 30, 66, 'part-memory'], ['inspect-cable', '连接线', 68, 71, 'part-cable']]),
    drop([['dimm', '内存条', 'part-memory']], [['slot-a', '槽位 A · 缺口朝左', 62, 43], ['slot-b', '槽位 B · 缺口朝右', 28, 61]],
      ['dimm', 'slot-b'], { turn: true }),
    press([['force', '只压左卡扣', 62, 44], ['seat', '压入内存条', 28, 61, 'part-memory']]),
    inspect([['check', '运行自检', 68, 35], ['done', '提交工单', 31, 73]]),
  ],
  assembly: [
    drop([['b16', 'B16 模块', 'part-memory'], ['b08', 'B08 模块', 'part-memory']],
      [['manifest', 'B16 工单 · 核对区', 58, 63]], ['b16', 'manifest']),
    inspect([['verify-bench', '工位就绪灯', 64, 38], ['edit-order', '已完工标签', 36, 67]]),
    drop([['ssd', '固态硬盘', 'part-ssd'], ['wire', '连接线', 'part-cable']],
      [['ssd-bay', '机箱 · 硬盘托位', 76, 58], ['io-port', '主板 · 线缆接口', 28, 66]], ['ssd', 'ssd-bay']),
    press([['run', '启动工位测试', 68, 39], ['stamp', '盖章提交', 36, 71]]),
  ],
  quality: [
    inspect([['review-log', 'A17 · 自检失败', 65, 36], ['look', 'A17 · 外观正常', 30, 66]], 'quality-board'),
    drop([['log', 'A17 原始日志'], ['photo', '外观照片']],
      [['evidence-tray', 'A17 证据夹', 65, 56], ['other-tray', 'A18 证据夹', 30, 68]], ['log', 'evidence-tray'], { scene: 'quality-board' }),
    drop([['pass-tag', '放行签', 'part-tag'], ['hold-tag', '异常签', 'part-tag']],
      [['a17', '待处置工件 A17', 67, 59], ['a18', '对照工件 A18', 30, 68]], ['hold-tag', 'a17'], { scene: 'quality-board' }),
  ],
  fault: [
    drop([['suspect', '异常模块', 'part-memory'], ['spare', '备件', 'part-memory']],
      [['isolation', '隔离托盘', 29, 67], ['regular', '普通托盘', 71, 72]], ['suspect', 'isolation']),
    drop([['control', '对照模块', 'part-memory'], ['suspect', '原异常模块', 'part-memory']],
      [['probe', '检测槽 · 比对', 36, 57], ['storage', '备料托盘', 70, 71]], ['control', 'probe']),
    drop([['case', '原始记录 + 对照结果'], ['verbal', '口头备注']],
      [['lead', '组长复核夹', 63, 51], ['archive', '结案归档夹', 30, 74]], ['case', 'lead']),
  ],
  cert: [
    inspect([['sign-in', '本轮考核终端', 67, 35], ['borrow-ticket', '旧考核单', 34, 66]]),
    drop([['wire', '核对过的线缆', 'part-cable'], ['screw', '固定螺丝', 'part-screw']],
      [['port', '主板线缆接口', 28, 65], ['bay', '机箱固定孔位', 76, 59]], ['wire', 'port']),
    drop([['pass-tag', '通过签', 'part-tag'], ['hold-tag', '待复核签', 'part-tag']],
      [['anomaly', '超限项目单', 63, 42], ['past', '上一轮记录', 33, 71]], ['hold-tag', 'anomaly'], { scene: 'quality-board' }),
    drop([['handoff', '工单 + 记录 + 进度'], ['name', '工件名']],
      [['next-shift', '下一班接收夹', 62, 48], ['archive', '归档夹', 32, 75]], ['handoff', 'next-shift']),
  ],
};

function manipulationAnswer(play, step, motion, orientation) {
  if (!motion || motion.kind !== play.kind || !play.points.some(([target]) => target === motion.target)) return null;
  if (play.kind !== 'drop') return motion.item === undefined ? motion.target : null;
  if (!play.items.some(([item]) => item === motion.item)) return null;
  const [item, target] = play.solution;
  return motion.item === item && motion.target === target && (!play.turn || orientation === 1)
    ? step.answer : step.options.find((key) => key !== step.answer);
}

function missionById(id) {
  return missions.find((mission) => mission.id === id);
}

function unlocked(track, mission) {
  return !mission.requires || Number.isInteger(track?.runs[mission.requires]?.best);
}

function award(state, mission) {
  state.xp += mission.xp;
  state.coins += mission.coins;
  state.skills[mission.skill] += mission.gain;
}

export function applyTraining(state, action, id, option, stepIndex) {
  const mission = missionById(id);
  if (!mission || !unlocked(state.track, mission)) return false;

  const run = state.track?.runs[id];
  if (action === 'start') {
    state.track ??= { active: null, runs: {}, cert: null };
    state.track.active = id;
    if (run?.status !== 'active') {
      state.track.runs[id] = {
        step: 0, mistakes: 0, misses: [], feedback: null, status: 'active',
        best: run?.best ?? null, attempts: (run?.attempts ?? 0) + 1, score: null, awarded: false,
        hint: false, startedAt: Date.now(),
      };
    }
    return true;
  }

  if (action === 'review') {
    if (id !== 'cert' || state.track?.cert !== 'pending') return false;
    state.track.cert = 'issued';
    award(state, mission);
    return true;
  }

  if (state.track?.active !== id || run?.status !== 'active') return false;
  if (action === 'retry' && run.feedback === 'wrong') {
    run.feedback = null;
    run.placement = null;
    return true;
  }

  const step = mission.steps[run.step];
  const play = workbenches[id][run.step];
  if (!step || !play) return false;
  if (action === 'hint' && step.hint && !run.feedback) {
    run.hint = !run.hint;
    return true;
  }
  if (action === 'rotate' && play.turn && !run.feedback && stepIndex === run.step) {
    run.orientation = run.orientation === 1 ? 0 : 1;
    return true;
  }
  if (action === 'answer' || action === 'manipulate') {
    const motion = action === 'manipulate' ? option : null;
    if (motion) option = manipulationAnswer(play, step, motion, run.orientation);
    if (stepIndex !== run.step || run.feedback || !step.options.includes(option)) return false;
    if (motion) run.placement = { kind: motion.kind, ...(motion.item ? { item: motion.item } : {}), target: motion.target };
    run.feedback = option === step.answer ? 'correct' : 'wrong';
    if (run.feedback === 'wrong') {
      run.mistakes += 1;
      run.misses[run.step] = (run.misses[run.step] ?? 0) + 1;
    }
    return true;
  }

  if (action !== 'next' || run.feedback !== 'correct') return false;
  run.feedback = null;
  run.hint = false;
  run.orientation = 0;
  run.placement = null;
  run.step += 1;
  if (run.step < mission.steps.length) return true;

  run.score = Math.max(40, 100 - 12 * run.mistakes);
  run.elapsed = Math.max(0, Math.floor((Date.now() - (run.startedAt ?? Date.now())) / 1000));
  run.accuracy = Math.round(100 * mission.steps.length / (mission.steps.length + run.mistakes));
  if (id === 'cert' && run.score < 80) {
    run.status = 'failed';
    return true;
  }

  run.status = 'complete';
  const first = run.best === null;
  run.best = Math.max(run.best ?? 0, run.score);
  if (id === 'cert') {
    state.track.cert ??= 'pending';
  } else if (first) {
    award(state, mission);
    run.awarded = true;
  }
  return true;
}

const skillLabels = { assembly: '装配', quality: '质检', repair: '排障' };

function trainingButton(label, action, mission = '', {
  primary = false, option = '', step = '', disabled = false, extraClass = '', describedBy = '', expanded,
} = {}) {
  return `<button type="button" class="btn ${primary ? 'btn-primary' : 'btn-secondary'} ${extraClass}"
    data-training-action="${action}" data-training-id="${mission}" data-training-option="${option}"
    data-training-step="${step}"${disabled ? ' disabled' : ''}
    ${describedBy ? `aria-describedby="${describedBy}"` : ''}
    ${expanded === undefined ? '' : `aria-expanded="${expanded}"`}>${label}</button>`;
}

function done(track, id) {
  return Number.isInteger(track?.runs[id]?.best);
}

function progressBar(value, maximum, label) {
  return `<progress class="training-progress" value="${value}" max="${maximum}" aria-label="${label}"></progress>`;
}

function missionCard(track, mission, ctx) {
  const available = unlocked(track, mission);
  const completed = mission.id === 'cert' ? track?.cert === 'issued' : done(track, mission.id);
  const pending = mission.id === 'cert' && track?.cert === 'pending';
  const active = track?.runs[mission.id]?.status === 'active';
  const status = completed ? '已完成' : pending ? '待复核' : active ? '进行中' : available ? '可领取' : '待解锁';
  const action = pending ? 'record' : 'start';
  const actionLabel = pending ? '查看复核' : active ? '继续训练' : completed ? '再次演练' : available ? '领取任务' : '待解锁';
  const note = !available ? `完成「${missionById(mission.requires).title}」后解锁`
    : `首通奖励　${mission.xp} XP · ${mission.coins} 工票`;
  return `<article class="training-mission${available ? '' : ' training-mission--locked'}">
    <div class="training-mission-art" style="--training-scene:url('${ctx.asset(mission.image)}')">
      <span class="training-mission-type">${mission.kind} · ${mission.code}</span>
      <span class="training-mission-status${completed ? ' training-mission-status--done' : ''}">${status}</span>
    </div>
    <div class="training-mission-body">
      <h3>${mission.title}</h3>
      <p>${mission.detail}</p>
      <div class="training-mission-footer">
        <span>${note}</span>
        ${trainingButton(actionLabel, action, mission.id, { primary: available && !completed, disabled: !available })}
      </div>
    </div>
  </article>`;
}

function boardPage(state, ctx) {
  const track = state.track;
  const main = missions.filter(({ kind }) => kind === '主线');
  const complete = main.filter(({ id }) => done(track, id)).length;
  return `<div class="container training-page" data-training-root>
    <header class="training-page-hero" style="--training-scene:url('${ctx.asset('station')}')">
      <div class="training-page-hero-content">
        <div class="training-kicker"><span></span>训练中心</div>
        <h1>车间任务板</h1>
        <p>从带教工位到独立上岗。完成装配和质检主线，解锁故障委托与岗位实操考核。</p>
        <div class="training-hero-progress">
          <span>主线进度 <strong>${complete} / ${main.length}</strong></span>
          ${progressBar(complete, main.length, '主线进度')}
        </div>
      </div>
    </header>
    <section aria-labelledby="training-main-title">
      <div class="training-section-head"><h2 id="training-main-title">主线训练</h2><span>装配 · 质检</span></div>
      <div class="training-mission-grid">${main.map((mission) => missionCard(track, mission, ctx)).join('')}</div>
    </section>
    <section aria-labelledby="training-extra-title">
      <div class="training-section-head"><h2 id="training-extra-title">委托与考核</h2><span>异常工位 · 岗位认证</span></div>
      <div class="training-mission-grid training-mission-grid--pair">
        ${missions.filter(({ kind }) => kind !== '主线').map((mission) => missionCard(track, mission, ctx)).join('')}
      </div>
    </section>
  </div>`;
}

function stepList(mission, run) {
  return `<ol class="training-steps" aria-label="训练步骤">${mission.steps.map(({ title }, index) => {
    const complete = run?.step > index;
    const current = index === (run?.step ?? 0);
    return `<li class="${complete ? 'training-step-done' : current ? 'training-step-current' : ''}"${current ? ' aria-current="step"' : ''}>
      <span class="training-step-index" aria-hidden="true">${complete ? '✓' : String(index + 1).padStart(2, '0')}</span>
      <span>${title}<small>${complete ? '已完成' : current ? '当前步骤' : '待处理'}</small></span>
    </li>`;
  }).join('')}</ol>`;
}

const playInstructions = {
  inspect: '点击工位上的检测点',
  press: '按住或点按工位部件',
  drop: '拖放物料，或先选物料再点放置区',
};

function workbenchStreak(run) {
  if (!run || run.misses[run.step]) return 0;
  let streak = 0;
  for (let index = run.step - (run.feedback === 'correct' ? 0 : 1); index >= 0 && !run.misses[index]; index--) {
    streak++;
  }
  return streak;
}

function workbenchPart(asset, ctx) {
  return asset ? `<img src="${ctx.asset(asset)}" alt="" draggable="false">`
    : '<span class="training-prop-paper" aria-hidden="true"></span>';
}

function stageConsole(mission, step, run, ctx) {
  const index = run?.step ?? 0;
  const play = workbenches[mission.id][index];
  const active = !!run && !run.feedback;
  const placed = play.items?.find(([item]) => item === run?.placement?.item);
  const orientation = run?.orientation === 1 ? '右' : '左';
  const mode = play.kind === 'drop' ? '拖放' : play.kind === 'press' ? '压合' : '检查';
  const status = !run ? '待开始' : run.feedback === 'correct' ? '工序已确认'
    : run.feedback === 'wrong' ? '需复核' : playInstructions[play.kind];
  return `<div class="training-console" data-training-bench="${mission.id}" data-training-stage="${index}" data-training-play="${play.kind}">
    <div class="training-scene" style="--training-scene:url('${ctx.asset(play.scene ?? 'station')}')">
      <div class="training-console-top">
        <span>${mission.id === 'memory' ? '带教模式' : mission.area} · ${mode}</span>
        ${run ? `<span class="training-streak">连击 ×<b>${workbenchStreak(run)}</b></span>` : '<span><i></i>模拟工位</span>'}
      </div>
      ${run ? play.points.map(([point, label, x, y, asset]) => {
        const result = run.placement?.target === point ? run.feedback : '';
        const part = result === 'correct' && placed ? placed[2] : asset;
        const socket = point.startsWith('slot-') || ['ssd-bay', 'io-port', 'probe', 'port'].includes(point);
        return `<button type="button" class="training-point training-point--${play.kind}" data-training-point="${point}"
          style="--point-x:${x}%;--point-y:${y}%"${result ? ` data-training-placement="${result}"` : ''}
          ${active ? '' : 'disabled'}>
          ${part || (result === 'correct' && placed) ? workbenchPart(part, ctx)
            : socket ? '<span class="training-socket" aria-hidden="true"></span>' : ''}
          <span><i aria-hidden="true">${result === 'correct' ? '✓' : result === 'wrong' ? '!' : play.kind === 'drop' ? '+' : '◎'}</i>${label}</span>
        </button>`;
      }).join('') : ''}
    </div>
    <div class="training-console-bottom">
      <span>${mission.code}　${step.title}</span>
      <span data-training-guidance role="status">${status}</span>
    </div>
    ${play.items && run ? `<div class="training-tray">
      <span class="training-tray-label">物料托盘</span>
      <div class="training-tray-items">
        ${play.items.map(([item, label, asset]) => `<button type="button" class="training-tray-item" data-training-item="${item}"
          ${play.turn ? `data-training-orientation="${orientation === '右' ? 'right' : 'left'}"` : ''}
          data-training-item-label="${label}" aria-pressed="false" draggable="${active}"${active ? '' : ' disabled'}>
          ${workbenchPart(asset, ctx)}
          <span>${label}${play.turn ? ` <small>缺口朝${orientation}</small>` : ''}</span>
        </button>`).join('')}
      </div>
      ${active && play.turn ? trainingButton('↻ 转动内存条', 'rotate', mission.id, { step: index, extraClass: 'training-rotate' }) : ''}
    </div>` : ''}
  </div>`;
}

function stationControls(mission, step, run) {
  if (!run) {
    return `<div class="training-controls-body">
      <div class="training-kicker"><span></span>${mission.kind}训练</div>
      <h2 id="training-start-title">${mission.title}</h2>
      <p>${mission.detail}</p>
      <p>${mission.steps.length} 个步骤 · 首通奖励 ${mission.xp} XP、${mission.coins} 工票</p>
      ${trainingButton('开始训练', 'start', mission.id, { primary: true })}
    </div>`;
  }

  if (run.feedback) {
    const right = run.feedback === 'correct';
    return `<div class="training-controls-body training-feedback ${right ? 'training-feedback--correct' : 'training-feedback--wrong'}">
      <div class="training-feedback-mark" aria-hidden="true">${right ? '✓' : '!'}</div>
      <div role="status">
        <h2>${right ? '操作正确' : step.error ?? '工位复核未通过'}</h2>
        <p id="training-feedback-text">${right ? step.feedback : (step.hint ?? `复核提示 · ${step.feedback}`)}</p>
      </div>
      ${trainingButton(right ? (run.step + 1 === mission.steps.length ? '提交训练结果' : '下一步') : '退回重试',
        right ? 'next' : 'retry', mission.id, { primary: true, describedBy: 'training-feedback-text' })}
    </div>`;
  }

  return `<div class="training-controls-body">
    <div class="training-kicker"><span></span>工位任务</div>
    <h2>${step.title}</h2>
    <p>${step.situation}</p>
    ${run.hint ? `<p class="training-hint" id="training-hint-text">${step.hint}</p>` : ''}
    ${step.hint ? trainingButton(run.hint ? '收起提示' : '查看提示', 'hint', mission.id, {
      expanded: !!run.hint, describedBy: run.hint ? 'training-hint-text' : '', extraClass: 'training-hint-toggle',
    }) : ''}
  </div>`;
}

function formatElapsed(seconds) {
  if (seconds == null) return '—';
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function stationResult(track, mission, run, ctx) {
  const failed = run.status === 'failed';
  const pending = mission.id === 'cert' && track.cert === 'pending';
  const issued = mission.id === 'cert' && track.cert === 'issued';
  const next = missions.find((candidate) => candidate.requires === mission.id && candidate.kind === '主线');
  const reward = run.awarded
    ? `已发放 ${mission.xp} XP、${mission.coins} 工票，${mission.training}熟练度 +${mission.gain}。`
    : issued ? '模拟岗位徽章已记入档案。'
    : pending ? '成绩达到 80 分。考核单已进入导师复核。'
    : failed ? '本轮低于 80 分。查看复盘后可重新参加考核。'
    : '本轮成绩已记录。首通奖励已在此前领取。';
  return `<div class="training-result">
    <section class="training-result-cover${failed ? ' training-result-cover--failed' : ''}"
      style="--training-scene:url('${ctx.asset(failed ? 'station' : 'quality-board')}')">
      <div>
        <div class="training-kicker"><span></span>训练结算</div>
        <h2>${failed ? '考核需重练' : pending ? '待导师复核' : '训练完成'}</h2>
        <p>${reward}</p>
        ${failed || !run.mistakes ? '' : '<p class="training-replay-goal">再练时，试试全程无返工。</p>'}
        <dl class="training-metrics">
          <div><dt>正确率</dt><dd>${run.accuracy == null ? '—' : `${run.accuracy}%`}</dd></div>
          <div><dt>返工</dt><dd>${run.mistakes} 次</dd></div>
          <div><dt>用时</dt><dd>${formatElapsed(run.elapsed)}</dd></div>
        </dl>
        <div class="training-actions">
          ${pending ? trainingButton('查看复核', 'record', '', { primary: true })
            : next ? trainingButton(`领取${next.title}`, 'start', next.id, { primary: true })
            : trainingButton(issued ? '查看岗位徽章' : '查看训练档案', 'record', '', { primary: !failed })}
          ${trainingButton(failed ? '重新考核' : '再次演练', 'start', mission.id, { primary: failed })}
          ${trainingButton('返回任务板', 'missions')}
        </div>
      </div>
      <div class="training-score" aria-label="${run.score} 分"><strong>${run.score}</strong><span>分</span></div>
    </section>
    <section class="training-result-detail" aria-labelledby="training-review-title">
      <div class="training-section-head"><h2 id="training-review-title">步骤复盘</h2><span>本轮纠错 ${run.mistakes} 次</span></div>
      <ol>${mission.steps.map((step, index) => `<li>
        <strong>${step.title}</strong><span>${step.feedback}</span>
        <small>${run.misses[index] ? `重试 ${run.misses[index]} 次后通过` : '一次通过'}</small>
      </li>`).join('')}</ol>
    </section>
  </div>`;
}

function stationPage(state, ctx) {
  const track = state.track;
  const mission = missionById(track?.active) ?? missions[0];
  const run = track?.runs[mission.id];
  const finished = run && run.status !== 'active';
  const step = mission.steps[run?.step ?? 0];
  return `<div class="container training-page" data-training-root>
    <header class="training-header">
      <div>
        <div class="training-kicker"><span></span>${mission.area} · ${mission.code}</div>
        <h1>${mission.title}</h1>
      </div>
      ${trainingButton('返回任务板', 'missions')}
    </header>
    ${finished ? stationResult(track, mission, run, ctx) : `<div class="training-station-layout">
      <aside class="training-step-panel">
        <h2>操作流程</h2>
        ${stepList(mission, run)}
        ${progressBar(run?.step ?? 0, mission.steps.length, '步骤完成进度')}
      </aside>
      ${stageConsole(mission, step, run, ctx)}
      <section class="training-controls">${stationControls(mission, step, run)}</section>
    </div>`}
  </div>`;
}

function recordPage(state, ctx) {
  const track = state.track;
  const completed = missions.filter(({ id }) => id === 'cert' ? track?.cert === 'issued' : done(track, id)).length;
  const certificate = track?.cert;
  const certText = certificate === 'issued' ? '岗位徽章已授予，模拟实操复核通过。'
    : certificate === 'pending' ? '模拟实操达到通过分数，考核单等待导师复核。'
    : '完成独立装配和首件质检，参加模拟岗位实操考核。';
  return `<div class="container training-page" data-training-root>
    <header class="training-header">
      <div>
        <div class="training-kicker"><span></span>个人成长</div>
        <h1>训练档案</h1>
      </div>
      ${trainingButton('前往任务板', 'missions', '', { primary: true })}
    </header>
    <div class="training-record-grid">
      <section class="training-record-panel">
        <div class="training-section-head"><h2>岗位熟练度</h2><span>完成任务 ${completed} / ${missions.length}</span></div>
        ${Object.entries(skillLabels).map(([skill, label]) => `<div class="training-skill">
          <span>${label}</span>${progressBar(Math.min(state.skills[skill], 100), 100, `${label}熟练度`)}<strong>${state.skills[skill]}</strong>
        </div>`).join('')}
      </section>
      <section class="training-cert" style="--training-scene:url('${ctx.asset('quality-board')}')">
        <div class="training-kicker"><span></span>游戏内模拟认证</div>
        <h2>${certificate === 'issued' ? '岗位徽章已获得' : certificate === 'pending' ? '待导师复核' : '岗位实操认证'}</h2>
        <p>${certText}</p>
        ${certificate === 'pending' ? trainingButton('模拟导师复核', 'review', 'cert', { primary: true })
          : certificate !== 'issued' && unlocked(track, missionById('cert'))
            ? trainingButton('进入模拟考核', 'start', 'cert', { primary: true })
            : ''}
      </section>
    </div>
    <section class="training-record-panel" aria-labelledby="training-history-title">
      <div class="training-section-head"><h2 id="training-history-title">任务成绩</h2><span>历史最佳成绩</span></div>
      <div class="training-history">
        ${missions.map((mission) => {
          const run = track?.runs[mission.id];
          const badge = mission.id === 'cert' && certificate === 'pending' ? '待复核'
            : done(track, mission.id) ? '已通过' : run?.status === 'failed' ? '待重练'
            : run ? '进行中' : unlocked(track, mission) ? '待领取' : '待解锁';
          return `<div class="training-history-row">
            <div><small>${mission.code} · ${mission.kind}</small><strong>${mission.title}</strong></div>
            <span>${run?.attempts ? `演练 ${run.attempts} 次` : '尚未演练'}</span>
            <span>${run?.best != null ? `${run.best} 分` : '—'}</span>
            <span>${badge}</span>
          </div>`;
        }).join('')}
      </div>
    </section>
  </div>`;
}

export function trainingPage(view, ctx) {
  const state = ctx.state();
  if (view === 'missions') return boardPage(state, ctx);
  if (view === 'record') return recordPage(state, ctx);
  return stationPage(state, ctx);
}

function bindWorkbench(page, ctx, focusAction) {
  const bench = page.querySelector('[data-training-bench]');
  if (!bench) return;
  const { trainingBench: mission, trainingStage: stage, trainingPlay: kind } = bench.dataset;
  const dragType = 'application/x-workshop-part';
  const targets = bench.querySelectorAll('[data-training-point]:enabled');
  const tray = [...bench.querySelectorAll('[data-training-item]:enabled')];
  const guidance = bench.querySelector('[data-training-guidance]');
  let selected = null;

  function selectItem(item) {
    selected = item;
    for (const button of tray) button.setAttribute('aria-pressed', String(button === item));
    bench.classList.toggle('training-has-item', !!item);
    guidance.textContent = item ? `已选 ${item.dataset.trainingItemLabel} · 选择放置区` : playInstructions[kind];
  }

  function move(point, item, keyboard = false) {
    if (!bench.isConnected) return;
    const motion = { kind, target: point.dataset.trainingPoint };
    if (item) motion.item = item.dataset.trainingItem;
    let changed = false;
    ctx.commit((state) => { changed = applyTraining(state, 'manipulate', mission, motion, Number(stage)); });
    if (changed && keyboard) focusAction('.training-controls button');
  }

  for (const item of tray) {
    item.addEventListener('click', (event) => {
      selectItem(item === selected ? null : item);
      if (selected && event.detail === 0) targets[0]?.focus({ preventScroll: true });
    });
    item.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData(dragType, [mission, stage, item.dataset.trainingItem].join('/'));
      event.dataTransfer.effectAllowed = 'move';
      selectItem(item);
    });
    item.addEventListener('dragend', () => {
      selectItem(null);
      for (const target of targets) target.classList.remove('training-drop-active');
    });
  }

  for (const point of targets) {
    point.addEventListener('click', (event) => {
      if (kind === 'drop' && !selected) {
        guidance.textContent = '先从物料托盘选一件物料';
        if (event.detail === 0) tray[0]?.focus({ preventScroll: true });
        return;
      }
      move(point, selected, event.detail === 0);
    });
    if (kind === 'drop') {
      point.addEventListener('dragover', (event) => {
        if (!Array.from(event.dataTransfer.types).includes(dragType)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        point.classList.add('training-drop-active');
      });
      point.addEventListener('dragleave', () => point.classList.remove('training-drop-active'));
      point.addEventListener('drop', (event) => {
        event.preventDefault();
        point.classList.remove('training-drop-active');
        const item = tray.find((button) => event.dataTransfer.getData(dragType) === [mission, stage, button.dataset.trainingItem].join('/'));
        if (item) move(point, item);
      });
    }
    if (kind === 'press') {
      let timer;
      const cancel = () => {
        clearTimeout(timer);
        point.classList.remove('training-point--holding');
      };
      point.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        point.classList.add('training-point--holding');
        timer = setTimeout(() => move(point), 420);
      });
      for (const event of ['pointerup', 'pointercancel', 'pointerleave']) point.addEventListener(event, cancel);
    }
  }
}

export function bindTraining(root, view, ctx) {
  const page = root.matches('[data-training-root]') ? root : root.querySelector('[data-training-root]');
  if (!page) return;
  const focusAction = (...selectors) => {
    const current = page.ownerDocument.querySelector('[data-training-root]');
    for (const selector of selectors) {
      const target = current?.querySelector(selector);
      if (!target) continue;
      target.focus({ preventScroll: true });
      break;
    }
  };
  const select = (button, focus = true) => {
    const { trainingAction: action, trainingId: id, trainingOption: option, trainingStep: step } = button.dataset;
    if (action === 'missions' || action === 'record') {
      ctx.go(action);
      return;
    }

    let changed = false;
    ctx.commit((state) => { changed = applyTraining(state, action, id, option, Number(step)); });
    if (!changed) return;
    if (action === 'start' && view !== 'station') {
      ctx.go('station');
      return;
    }
    if (action === 'review') {
      ctx.toast('模拟复核已通过，岗位徽章已发放');
      if (focus) focusAction('[data-training-action="missions"]');
    } else if (focus && (action === 'hint' || action === 'rotate')) {
      focusAction(action === 'hint' ? '.training-hint-toggle' : '.training-rotate');
    } else if (focus) {
      focusAction('[data-training-item]:enabled', '[data-training-point]:enabled', '.training-controls button', '.training-result-cover button');
    }
  };

  page.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-training-action]');
    if (button && !button.disabled) select(button, event.detail === 0);
  });

  bindWorkbench(page, ctx, focusAction);
}
