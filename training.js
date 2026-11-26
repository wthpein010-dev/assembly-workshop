const missions = [
  {
    id: 'memory', code: 'M-01', kind: '主线', title: '安装内存', area: '带教工位', skill: 'assembly', training: '装配',
    detail: '完成一轮带提示的内存安装，认识部件、缺口和工位自检。',
    xp: 40, coins: 35, gain: 20, image: 'part-memory',
    steps: [
      {
        title: '检查部件', situation: '本轮工单需要一根内存条。请在模拟托盘中找到它。',
        hint: '认准带金色触点和定位缺口的长条部件。',
        options: [['inspect', '检查内存条'], ['inspect-cable', '检查连接线'], ['skip-inspect', '跳过部件检查']],
        answer: 'inspect', feedback: '内存条已核对。工单和托盘中的部件一致。',
      },
      {
        title: '对齐缺口', situation: '把内存条放入与缺口相符的模拟槽位。',
        hint: '让模块缺口与槽位标记处于同一侧。',
        drop: true, error: '缺口未对齐',
        options: [['reverse', '槽位 A · 标记偏左'], ['align', '槽位 B · 标记偏右']],
        answer: 'align', feedback: '模块缺口与槽位 B 的标记一致，可以继续。',
      },
      {
        title: '压入内存', situation: '缺口已对齐。选择正确的模拟入位动作。',
        hint: '观察两个状态指示，等待两侧都显示锁定。',
        options: [['force', '只确认一侧锁定'], ['seat', '确认两侧锁定'], ['verify-first', '直接跳到自检']],
        answer: 'seat', feedback: '两侧均显示锁定，模拟内存条已就位。',
      },
      {
        title: '完成自检', situation: '装配已完成。工位仍显示「待检测」，接下来应该怎么做？',
        hint: '运行模拟自检，看到系统确认识别模块。',
        options: [['done', '直接提交工单'], ['change', '更换已入位的模块'], ['check', '运行模拟自检']],
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
        title: '核对工单', situation: '工单指定 B16 模块。托盘里同时放着 B16、B08 和未贴标的部件。',
        options: [['nearest', '取离自己最近的一件'], ['anonymous', '先用未贴标的部件'], ['order', '选用工单指定的 B16']],
        answer: 'order', feedback: '物料已核对。工单型号与部件一致。',
      },
      {
        title: '确认工位', situation: '模拟台显示「未就绪」。工单要求备料后确认台面状态。',
        options: [['assemble-anyway', '开始模拟安装'], ['verify-bench', '完成工位就绪核对'], ['edit-order', '把工单状态改为完成']],
        answer: 'verify-bench', feedback: '工位点检已完成，状态变为「可用」。',
      },
      {
        title: '完成模拟入位', situation: '部件已进入模拟槽位。左侧显示锁定，右侧仍显示待确认。',
        options: [['fit', '检查并确认右侧状态'], ['dispatch', '把部件交给下一站'], ['ignore-right', '记录两侧已经锁定']],
        answer: 'fit', feedback: '模拟状态已确认，装配件可以进入测试。',
      },
      {
        title: '提交工位测试', situation: '工件准备就绪，测试记录暂时为空。',
        options: [['verbal', '口头确认后离开'], ['run', '运行测试并写入记录'], ['stamp', '补填一条通过记录']],
        answer: 'run', feedback: '已生成测试记录并关联本轮工单。',
      },
    ],
  },
  {
    id: 'quality', code: 'M-03', kind: '主线', title: '首件质量复核', area: '质检工位', skill: 'quality', training: '质检',
    detail: '核对检测记录，追踪证据，并作出首件放行判断。',
    xp: 190, coins: 55, gain: 30, requires: 'assembly', image: 'results',
    steps: [
      {
        title: '确认检测记录', situation: 'A17 工件外观正常。记录中出现 A17 的单项自检未通过。',
        options: [['look', '只检查工件外观'], ['review-log', '调取 A17 的自检记录'], ['assume', '按外观正常予以放行']],
        answer: 'review-log', feedback: '记录对应 A17，异常项目已定位。',
      },
      {
        title: '保存证据', situation: '复核员需要能追溯到本件工单的原始记录。',
        options: [['evidence', '关联工单、异常日志和复核结论'], ['replace', '只保留改写后的通过记录'], ['picture', '只留一张外观照片']],
        answer: 'evidence', feedback: '工件、日志和复核记录已关联。',
      },
      {
        title: '作出处置', situation: '复测仍出现同一异常。本件工单需要进入下一个处置状态。',
        options: [['release', '允许工件进入下一站'], ['hide', '把日志从工单中移除'], ['hold', '暂缓放行并转交异常单']],
        answer: 'hold', feedback: '已记录暂缓放行并生成异常单。',
      },
    ],
  },
  {
    id: 'fault', code: 'S-01', kind: '支线', title: '故障排查委托', area: '异常工位', skill: 'repair', training: '排障',
    detail: '通过模拟工位的比较试验，定位一条间歇异常的线索。',
    xp: 150, coins: 50, gain: 25, requires: 'quality', image: 'retry',
    steps: [
      {
        title: '划定排查范围', situation: '试验批次中有一台工位反复报告同一模块异常。',
        options: [['change-all', '同时更换模块和工位'], ['isolate', '将异常工件与其记录单独保留'], ['clear', '先删除告警记录']],
        answer: 'isolate', feedback: '已保留待排查的工件和原始日志。',
      },
      {
        title: '比较两轮记录', situation: '工位状态一致。替换为对照模块后异常消失，换回原模块后异常再次出现。',
        options: [['blame-bench', '直接认定整条产线失效'], ['dismiss', '把重复异常归为巧合'], ['compare', '记录异常随原模块出现']],
        answer: 'compare', feedback: '对照试验表明原模块需要进一步复核。',
      },
      {
        title: '移交异常单', situation: '班组长需要现场复核。你手中有原始记录、试验条件和对照结果。',
        options: [['escalate', '将证据连同异常单提交复核'], ['archive', '自行关闭异常单'], ['announce', '只报告「好像坏了」']],
        answer: 'escalate', feedback: '异常单和证据已交给班组长复核。',
      },
    ],
  },
  {
    id: 'cert', code: 'R-01', kind: '考核', title: '岗位实操认证', area: '考核工位', skill: 'assembly', training: '装配',
    detail: '完成模拟岗位考核，提交导师复核，领取游戏内岗位徽章。',
    xp: 240, coins: 80, gain: 15, requires: 'quality', image: 'results',
    steps: [
      {
        title: '确认考核工单', situation: '岗位实操开始前，模拟工位需要记录本轮考核信息。',
        options: [['skip', '跳过签入，直接开始'], ['sign-in', '核对工单并完成签入'], ['borrow-ticket', '使用上一轮的考核单']],
        answer: 'sign-in', feedback: '本轮考核和训练档案已关联。',
      },
      {
        title: '执行模拟装配', situation: '工位显示「物料待核对」。组员急着提交完成。',
        options: [['follow-plan', '按工单顺序完成核对和模拟入位'], ['complete-now', '先点完成，稍后补核对'], ['copy', '引用上一轮的完成状态']],
        answer: 'follow-plan', feedback: '模拟工位已确认每项装配状态。',
      },
      {
        title: '提交检测结论', situation: '模拟自检提示有一项超出预设范围。',
        options: [['forget', '等待系统清除提示'], ['treat-pass', '仍然填报通过'], ['report', '记录异常并标记待复核']],
        answer: 'report', feedback: '检测结论与工位记录一致。',
      },
      {
        title: '完成岗位交接', situation: '班次即将结束。下一名组员需要接续处理待复核工单。',
        options: [['close', '结束工单并离开模拟工位'], ['hand-off', '交接工单、异常记录和处理进度'], ['send-name', '只口头说明工件名称']],
        answer: 'hand-off', feedback: '交接记录已生成，可以提交导师复核。',
      },
    ],
  },
];

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
    return true;
  }

  const step = mission.steps[run.step];
  if (action === 'hint' && step.hint && !run.feedback) {
    run.hint = !run.hint;
    return true;
  }
  if (action === 'answer') {
    if (stepIndex !== run.step || run.feedback || !step.options.some(([key]) => key === option)) return false;
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
  return `<div class="training-page" data-training-root>
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

function stageConsole(mission, step, run, ctx) {
  const memory = mission.id === 'memory';
  const canDrop = step.drop && run && !run.feedback;
  const retryScene = step.drop && run?.feedback === 'wrong';
  return `<div class="training-console" style="--training-scene:url('${ctx.asset(retryScene ? 'retry' : 'station')}')">
    <div class="training-console-top">
      <span>${memory ? '带教模式' : mission.area}</span>
      <span><i></i>${run ? '模拟工位在线' : '待开始'}</span>
    </div>
    ${memory && !retryScene ? `<div class="training-part${canDrop ? ' training-part--drag' : ''}">
      <img src="${ctx.asset('part-memory')}" alt="模拟内存条" draggable="${canDrop ? 'true' : 'false'}"${canDrop ? ' data-training-drag' : ''}>
      <span>${canDrop ? '模拟内存条 · 缺口偏右' : '本轮练习部件 · 内存条'}</span>
    </div>` : ''}
    <div class="training-console-bottom">
      <span>${mission.code}　${step.title}</span>
      ${canDrop ? '<span>拖到右侧槽位，或直接选择槽位</span>' : '<span>模拟操作</span>'}
    </div>
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
    <div class="training-options" aria-label="${step.drop ? '可用模拟槽位' : '可用操作'}">
      ${step.options.map(([option, label]) => trainingButton(label, 'answer', mission.id, {
        option, step: run.step, extraClass: step.drop ? 'training-drop-target' : '',
      })).join('')}
    </div>
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
      style="--training-scene:url('${ctx.asset(failed ? 'retry' : 'results')}')">
      <div>
        <div class="training-kicker"><span></span>训练结算</div>
        <h2>${failed ? '考核需重练' : pending ? '待导师复核' : '训练完成'}</h2>
        <p>${reward}</p>
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
  return `<div class="training-page" data-training-root>
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
  return `<div class="training-page" data-training-root>
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
      <section class="training-cert" style="--training-scene:url('${ctx.asset('results')}')">
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

export function bindTraining(root, view, ctx) {
  const page = root.matches('[data-training-root]') ? root : root.querySelector('[data-training-root]');
  if (!page) return;
  const focusAction = (selector) => {
    const target = page.ownerDocument.querySelector(`[data-training-root] ${selector}`);
    target?.focus({ preventScroll: true });
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
    } else if (focus && action === 'hint') {
      focusAction('.training-hint-toggle');
    } else if (focus) {
      focusAction('.training-controls button, .training-result-cover button');
    }
  };

  page.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-training-action]');
    if (button && !button.disabled) select(button, event.detail === 0);
  });

  const dragPart = page.querySelector('[data-training-drag]');
  if (!dragPart) return;
  const dragType = 'application/x-workshop-part';
  dragPart.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData(dragType, 'memory');
    event.dataTransfer.effectAllowed = 'move';
  });
  for (const target of page.querySelectorAll('.training-drop-target')) {
    target.addEventListener('dragover', (event) => {
      if (!Array.from(event.dataTransfer.types).includes(dragType)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      target.classList.add('training-drop-active');
    });
    target.addEventListener('dragleave', () => target.classList.remove('training-drop-active'));
    target.addEventListener('drop', (event) => {
      event.preventDefault();
      target.classList.remove('training-drop-active');
      if (event.dataTransfer.getData(dragType) === 'memory') select(target, false);
    });
  }
}
