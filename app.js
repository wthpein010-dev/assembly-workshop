import { escapeHtml as esc, loadSave, persistSave, normalizeSave, initialState, profileFrom, validName, levelAt, FACE_LABELS, HAIR_LABELS, TONES, WORK_GROUPS } from './state.js';
import { makeCloud } from './cloud.js';
import { trainingPage, bindTraining } from './training.js';
import { communityPage, bindCommunity } from './community.js';

const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
const trainingViews = new Set(['missions', 'station', 'record']);
const communityViews = new Set(['social', 'team', 'help', 'shop', 'honor', 'event']);
const viewNames = { hall: '任务大厅', world: '工坊地图', missions: '任务手册', station: '模拟工位', record: '技能记录', social: '班组交流', team: '组队训练', help: '求助板', shop: '工坊商店', honor: '我的工位', event: '工坊建设周', online: '联机大厅', account: '角色与存档', create: '创建角色', start: '装配工坊' };
const cloudStatus = { local: '本地存档', connecting: '连接中', ready: '云档已同步', saving: '正在同步', conflict: '待处理云档', offline: '云档暂未连接' };
const roles = [ '身份绑定', '定制角色', '角色取名' ];
const coopSteps = ['提交装配检查单', '完成首件质检', '确认交接并归档'];
let state = loadSave(localStorage);
let view = '';
let toastTimer;
let step = 0;
let draft = profileFrom({ name: '' });
let worldTimer;
let world = null;
let worldError = '';
let worldRequest = false;


const asset = id => './assets/' + id + '.webp';
const cloud = makeCloud({
  current: () => state,
  restore: value => {
    state = normalizeSave(value);
    persistSave(localStorage, state);
    render();
  },
  signal: status => {
    for (const el of document.querySelectorAll('[data-cloud-status]')) el.textContent = cloudStatus[status];
    if (view === 'account' && (status === 'conflict' || status === 'local')) render();
  },
});

function toast(message) {
  clearTimeout(toastTimer);
  notice.textContent = String(message);
  notice.classList.add('visible');
  toastTimer = setTimeout(() => notice.classList.remove('visible'), 3400);
}

function commit(mutator) {
  const next = structuredClone(state);
  const result = mutator(next);
  state = next;
  if (!persistSave(localStorage, state)) toast('此浏览器暂时无法写入本地存档。');
  cloud.queue();
  render();
  return result;
}

function go(route) {
  if (!(route in viewNames)) route = 'hall';
  if (location.hash.slice(1) === route) { changeRoute(); return; }
  location.hash = route;
}

const ctx = { state: () => state, commit, go, toast, escape: esc, asset };

function changeRoute() {
  const requested = location.hash.slice(1);
  const route = Object.hasOwn(viewNames, requested) ? requested : state.profile ? 'hall' : 'start';
  view = state.profile || ['start', 'create', 'account'].includes(route) ? route : 'start';
  clearInterval(worldTimer);

  render();
  if (view === 'online' && cloud.meta()) {
    refreshWorld();
    worldTimer = setInterval(() => { if (!document.hidden && view === 'online') refreshWorld(); }, 4500);
  }
  document.title = viewNames[view] + ' · 装配工坊';
  window.scrollTo(0, 0);
  app.querySelector('main')?.focus({ preventScroll: true });
}

function button(label, route, type = 'secondary') {
  return `<a class="btn btn-${type}" href="#${route}">${label}</a>`;
}

function faceStyle(profile) {
  const p = profileFrom(profile);
  const column = (p.face + p.hair) % FACE_LABELS.length;
  const row = p.gender === 'male' ? 100 : 0;
  const temperature = ['none', 'sepia(.16) saturate(1.15)', 'brightness(.84) saturate(.92)'][p.tone];
  return '--portrait-x:' + (column * 100 / 3) + '%;--portrait-y:' + row + '%;--portrait-tone:' + temperature;
}

function portrait(profile, size = '') {
  return `<span aria-hidden="true" class="portrait ${size}" style="${faceStyle(profile)}"></span>`;
}

function navItem(route, label, related = []) {
  const current = route === view || related.includes(view);
  return `<a href="#${route}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
}

function shell(contents, guest = false) {
  const points = levelAt(state.xp);
  return `
    <a class="skip" href="#main">进入主要内容</a>
    <header class="masthead">
      <a href="#${state.profile ? 'hall' : 'start'}" class="brand" aria-label="装配工坊首页">
        <span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span>
        <span><strong>装配工坊</strong><small>ASSEMBLY WORKSHOP</small></span>
      </a>
      ${!guest ? `<nav class="primary-nav" aria-label="主要页面">
        ${navItem('hall', '大厅', ['world'])}
        ${navItem('missions', '训练', ['station', 'record'])}
        ${navItem('social', '工友', ['online', 'team', 'help'])}
        ${navItem('shop', '商店', ['honor', 'event'])}
      </nav>
      <div class="top-profile">
        <a href="#shop" class="wallet"><span aria-hidden="true">◆</span> ${state.coins.toLocaleString('zh-CN')} <small>工坊积分</small></a>
        <a href="#account" class="identity">${portrait(state.profile)}<span><b>${esc(state.profile.name)}</b><small>Lv. ${points.level}</small></span></a>
      </div>` : `<a class="guest-login" href="#account">已有游玩码</a>`}
    </header>
    <main id="main" class="page-main ${guest ? 'page-guest' : ''}" tabindex="-1">${contents}</main>
    ${!guest ? `<footer class="game-footer"><span><i></i><span data-cloud-status>${cloudStatus[cloud.status()]}</span></span><a href="#account">角色与存档</a><span>装配工坊 · 体验版</span></footer>` : ''}
  `;
}

function startPage() {
  return `<section class="start-scene">
    <div class="start-hero container">
      <span class="bay-label"><i></i> 电 子 装 配 车 间</span>
      <h1>装配工坊</h1>
      <p>进车间，接工单，练成真正用得上的装配、质检与排障技能。</p>
      <div class="btn-row">
        ${button(state.profile ? '继续游戏' : '创建角色', state.profile ? 'hall' : 'create', 'primary')}
        ${!state.profile ? '<button type="button" class="btn btn-secondary" data-action="quick">快速试玩</button>' : button('我的工位', 'honor')}
      </div>
    </div>
    <div class="start-chapters container">
      <div><strong>01</strong><span>在工位练习</span></div>
      <div><strong>02</strong><span>和工友协作</span></div>
      <div><strong>03</strong><span>解锁岗位技能</span></div>
    </div>
  </section>`;
}

function options(key, values) {
  return values.map(([value, label]) => `<button type="button" class="choice${draft[key] === value ? ' selected' : ''}" data-choice="${key}" data-value="${value}" aria-pressed="${draft[key] === value}">${label}</button>`).join('');
}

function creatorPage() {
  const fields = [
    `<h2>选择你的体验班组</h2><p>用一个演示身份进入车间，选定班组后开始创建工坊角色。</p>
     <div class="choices stacked">${options('group', WORK_GROUPS.map((name, i) => [i, name]))}</div>`,
    `<h2>定制工坊角色</h2><p>选好外观再上岗。角色外观可随时回到这里修改。</p>
     <div class="choice-block"><h3>角色性别</h3><div class="choices">${options('gender', [['female', '女性'], ['male', '男性']])}</div></div>
     <div class="choice-block"><h3>脸型预设</h3><div class="choices">${options('face', FACE_LABELS.map((n, i) => [i, n]))}</div></div>
     <div class="choice-block"><h3>发型</h3><div class="choices">${options('hair', HAIR_LABELS.map((n, i) => [i, n]))}</div></div>
     <div class="choice-block"><h3>肤色</h3><div class="choices">${options('tone', TONES.map((n, i) => [i, n]))}</div></div>`,
    `<h2>给角色取个名字</h2><p>工友会在大厅与聊天中看到这个名字。</p>
     <label for="nick">角色昵称</label><input id="nick" name="nickname" type="text" autocomplete="off" spellcheck="false" maxlength="28" value="${draft.name === '新人工友' ? '' : esc(draft.name)}" placeholder="例如 林小满" aria-describedby="name-hint">
     <p id="name-hint" class="field-hint" aria-live="polite">可用汉字、字母、数字，长度 2–14 字。</p>`,
  ];
  return `<section class="container creator">
     <ol class="creator-steps" aria-label="建角进度">${roles.map((title, n) => `<li ${step === n ? 'aria-current="step"' : ''}><b>${n + 1}</b>${title}</li>`).join('')}</ol>
     <div class="creator-grid">
       <div class="preview-portrait" aria-label="角色预览">${portrait(draft, 'large')}<div><span>${WORK_GROUPS[draft.group]}</span><b>${step === 2 && validName(draft.name) ? esc(draft.name) : '见习装配员'}</b></div></div>
       <form id="create-form" class="form-panel" novalidate>
         ${fields[step]}
         <div class="btn-row">${step ? '<button class="btn btn-secondary" type="button" data-action="back-create">上一步</button>' : button('返回', state.profile ? 'hall' : 'start')}
           <button class="btn btn-primary" type="submit">${step === 2 ? '确认进入工坊' : '下一步'}</button>
           ${step === 1 ? '<button class="btn btn-text" type="button" data-action="reset-avatar">重置外观</button>' : ''}
         </div>
       </form>
     </div>
   </section>`;
}

function taskSummaries() {
  const done = new Set(Object.keys(state.track?.runs ?? {}).filter(id => Number.isInteger(state.track.runs[id]?.best))); if (state.track?.cert === 'issued') done.add('cert'); else done.delete('cert');
  const milestones = [
    ['安装内存', '带教工位', 'memory'],
    ['首台电脑', '装配工位', 'assembly'],
    ['首件质量复核', '质检工位', 'quality'],
    ['岗位实操认证', '现场认证演示', 'cert'],
  ];
  return milestones.map(([title, label, id], i) => `<a href="#missions" class="mile">
      <span class="mile-index${done.has(id) ? ' checked' : ''}">${done.has(id) ? '✓' : '0' + (i + 1)}</span>
      <span><strong>${title}</strong><small>${label}</small></span>
    </a>`).join('');
}

function hallPage() {
  const inProgress = state.track?.runs?.[state.track?.active]?.status === 'active';
  const p = levelAt(state.xp);
  return `<div class="container hall">
    <section class="hall-hero">
      <div class="hero-copy"><span class="bay-label"><i></i> ${WORK_GROUPS[state.profile.group]} · 当班工单</span>
        <h1>${inProgress ? '继续完成你的工单' : '从一张工单开始'}</h1>
        <p>进入装配训练，掌握工序后接手独立装配、首件质检和故障排查。</p>
        <div class="btn-row">${button(inProgress ? '返回工位' : '查看任务', inProgress ? 'station' : 'missions', 'primary')} ${button('去工坊地图', 'world')}</div>
      </div>
      <aside class="hall-player">
        ${portrait(state.profile, 'portrait-medium')}<span class="eyeline">${WORK_GROUPS[state.profile.group]}</span>
        <strong>${esc(state.profile.name)}</strong>
        <div class="level-line"><span>Lv. ${p.level} 装配员</span><span>${p.current} / ${p.max} XP</span></div>
        <progress value="${p.current}" max="${p.max}" aria-label="角色经验"></progress>
        <a href="#record">技能与认证记录</a>
      </aside>
    </section>
    <section class="hall-steps"><div class="section-heading"><h2>训练进度</h2><a href="#missions">打开任务手册</a></div>
      <div class="milestones">${taskSummaries()}</div>
    </section>
    <section class="bay-links" aria-label="车间活动">
      ${[['online','联机大厅','聊天、邀请其他玩家一起质检','yard'],['help','工友求助','发布卡点或协助他人','help-board'],['event','建设周','解锁班组荣誉与纪念工装','season']].map(([route,label,body,img]) =>
        `<a href="#${route}" class="bay-link" style="--bay-image:url('${asset(img)}')"><strong>${label}</strong><span>${body}</span></a>`).join('')}
    </section>
  </div>`;
}

function worldPage() {
  return `<div class="container world-page">
    <div class="section-heading"><div><span class="eyeline">电子装配车间</span><h1>工坊地图</h1></div>${button('返回大厅', 'hall')}</div>
    <div class="world-scene" aria-label="车间共享工坊">
      <a class="hotspot h-training" href="#missions"><span aria-hidden="true">◈</span><b>装配训练</b></a>
      <a class="hotspot h-team" href="#team"><span aria-hidden="true">◈</span><b>组队工位</b></a>
      <a class="hotspot h-honor" href="#honor"><span aria-hidden="true">◈</span><b>荣誉展厅</b></a>
    </div>
    <div class="world-destinations">${button('班组交流', 'social')}${button('联机大厅', 'online')}${button('互助任务', 'help')}${button('工坊建设周', 'event')}</div>
  </div>`;
}

function command(label, action, style = 'secondary', expanded = null) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'btn btn-' + style;
  element.dataset.action = action;
  element.textContent = label;
  if (expanded !== null) element.setAttribute('aria-expanded', String(expanded));
  return element.outerHTML;
}

function accountPage() {
  const connected = cloud.meta();
  const profile = state.profile;
  return `<section class="container account-page">
    <div class="section-heading"><div><span class="eyeline">工坊门禁</span><h1>角色与存档</h1></div>${button('返回', profile ? 'hall' : 'start')}</div>
    <div class="account-grid">
      <div class="form-panel account-profile">
        ${profile ? `${portrait(profile, 'portrait-medium')}<h2>${esc(profile.name)}</h2><p>${WORK_GROUPS[profile.group]} · 等级 ${levelAt(state.xp).level}</p>${command('修改角色', 'edit-avatar')}` : `<h2>创建体验角色</h2><p>用虚拟角色体验工坊的公开演示，现场考核和薪资连接均为示例。</p>${button('开始建角', 'create', 'primary')}`}
      </div>
      <div class="form-panel account-storage">
        <div class="section-heading"><h2>云存档与联机</h2><span class="status-chip" data-cloud-status>${cloudStatus[cloud.status()]}</span></div>
        ${connected ? `<p>换设备时，在另一台设备输入这份游玩码即可找回进度。请把游玩码保存在自己可访问的地方。</p>
         <div class="btn-row">${command('复制游玩码', 'copy-code')}${command('查看游玩码', 'reveal-code', 'secondary', false)}${command('立即同步', 'sync-now', 'text')}</div>
         <output id="cloud-code" class="cloud-code" hidden></output>
         ${cloud.status() === 'conflict' ? '<p class="field-hint">另一设备更新了云档。可读取云端进度，或保留当前本地进度。</p><div class="btn-row"><button type="button" class="btn btn-primary" data-action="use-cloud">读取云端进度</button><button type="button" class="btn btn-secondary" data-action="local-mode">保留本地进度</button></div>' : '<button type="button" class="btn btn-text" data-action="local-mode">断开云存档，保留本地进度</button>'}`
        : `<p>开启云档后可跨设备继续游戏，也能进入公开联机大厅。当前进度已保存在本机。</p>
         ${profile ? '<button type="button" class="btn btn-primary" data-action="cloud-create">创建游玩码</button>' : ''}
         <form id="signin-form" novalidate><label for="signin-code">已有游玩码</label>
          <input id="signin-code" name="code" type="password" autocomplete="off" maxlength="100" placeholder="粘贴游玩码" required>
          <p id="account-error" class="field-hint" aria-live="polite"></p>
          <button class="btn btn-secondary" type="submit">读取我的云档</button>
         </form>`}
      </div>
    </div>
  </section>`;
}

function onlinePage() {
  return `<section class="container online-page">
    <div class="online-header"><span class="eyeline">工友聚集区</span><h1>联机大厅</h1><p>和其他在线玩家聊天、发出邀请，并完成双人质检。</p><div class="btn-row">${button('和示范工友练习', 'team')}</div></div>
    ${cloud.meta() ? `<div class="online-grid">
      <section class="form-panel live-room" id="live-room" aria-live="polite"></section>
      <section class="form-panel live-chat"><h2>大厅频道</h2><p class="field-hint">公开频道，请勿发布工号或个人资料。</p><div class="chat-feed" id="live-feed" aria-live="polite"></div>
        <form id="world-chat" class="live-chat-form" novalidate>
          <label class="sr-only" for="message">聊天消息</label><input id="message" name="message" type="text" maxlength="160" placeholder="给在线工友发消息" autocomplete="off" required>
          <button class="btn btn-primary" type="submit">发送</button>
        </form></section>
      </div>` : '<div class="form-panel"><h2>先开一个云存档</h2><p>创建游玩码后，大厅会显示在线工友。</p><div class="btn-row"><button class="btn btn-primary" data-action="cloud-create" type="button">开启联机</button><a class="btn btn-secondary" href="#account">输入已有游玩码</a></div><p id="account-error" class="field-hint" aria-live="polite"></p></div>'}
  </section>`;
}

function actionButton(label, action, target = '', primary = false) {
  return `<button type="button" class="btn ${primary ? 'btn-primary' : 'btn-secondary'}" data-world="${action}" data-target="${esc(target)}">${label}</button>`;
}

function drawWorld() {
  const panel = document.querySelector('#live-room');
  const feed = document.querySelector('#live-feed');
  if (!panel || !feed) return;
  const me = cloud.meta()?.id;
  if (worldError) {
    panel.innerHTML = `<h2>暂时无法连接</h2><p class="field-hint">${esc(worldError)}</p>${actionButton('重试', 'retry')}`;
    return;
  }
  if (!world) {
    panel.innerHTML = '<h2>在线工友</h2><p>正在连接联机大厅…</p>';
    return;
  }
  const invites = (world.invites || []).map(invite => `<div class="person-row"><b>${esc(invite.author)} 邀请你双人质检</b><div class="btn-row">${actionButton('接受', 'accept', invite.id, true)}${actionButton('谢绝', 'decline', invite.id)}</div></div>`).join('');
  const room = world.room;
  const people = (world.players || []).filter(player => player.id !== me);
  const team = room ? `<h2>双人质检</h2><p>${room.players.map(p => esc(p.name)).join(' / ')}</p>
    <ol class="live-steps">${coopSteps.map((label, n) => `<li class="${n < room.step ? 'done' : n === room.step ? 'active' : ''}">${label}</li>`).join('')}</ol>
    <div class="btn-row">${room.step >= 3 ? actionButton('领取协作奖励', 'reward', room.id, true) : room.actor === me ? actionButton(coopSteps[room.step], 'step', '', true) : '<span class="status-chip">等待队友操作</span>'}
    ${actionButton('离开工位', 'leave')}</div>`
    : `<h2>在线工友</h2>${people.length ? people.map(p => `<div class="person-row"><b>${esc(p.name)}</b>${actionButton('邀请质检', 'invite', p.id)}</div>`).join('') : '<p>其他玩家上线后会出现在这里。</p>'}`;
  if (!panel.contains(document.activeElement) || !worldRequest) {
    const focus = document.activeElement?.dataset.world;
    const target = document.activeElement?.dataset.target;
    const html = invites + team;
    if (panel.innerHTML !== html) {
      panel.innerHTML = html;
      if (focus) [...panel.querySelectorAll('[data-world]')].find(b => b.dataset.world === focus && b.dataset.target === target)?.focus();
    }
  }
  const messages = world.messages || [];
  const chat = messages.length ? messages.map(m => `<div class="live-message"><strong>${esc(m.author)}</strong><span>${esc(m.text)}</span></div>`).join('') : '<p>频道还没有消息。打个招呼吧。</p>';
  if (feed.innerHTML !== chat) { feed.innerHTML = chat; feed.scrollTop = feed.scrollHeight; }
}

async function refreshWorld(action, details) {
  if (!cloud.meta()) return false;
  if (worldRequest) { if (action) toast('正在更新联机状态，请等一下。'); return false; }
  worldRequest = true;
  try {
    const data = await cloud.world(action, details);
    world = data.ok && !data.players ? await cloud.world() : data;
    worldError = '';
    return true;
  } catch (error) {
    if (!action) worldError = error.message;
    else toast(error.message);
    return false;
  } finally {
    worldRequest = false;
    if (view === 'online') drawWorld();
  }
}

function render() {
  if (!view) return;
  const guest = !state.profile || view === 'start' || view === 'create';
  const page = trainingViews.has(view) ? trainingPage(view, ctx)
    : communityViews.has(view) ? communityPage(view, ctx)
    : ({ start: startPage, create: creatorPage, hall: hallPage, world: worldPage, account: accountPage, online: onlinePage }[view])();
  app.innerHTML = shell(typeof page === 'string' ? page : '', guest);
  const panel = document.querySelector('#main');
  if (typeof page !== 'string' && page) panel.append(page);
  if (trainingViews.has(view)) bindTraining(panel, view, ctx);
  if (communityViews.has(view)) bindCommunity(panel, view, ctx);
  if (view === 'online' && cloud.meta()) drawWorld();
}

function setProfile(profile) {
  commit(s => { s.profile = profileFrom(profile); });
  draft = profileFrom(profile);
  toast('已进入 ' + WORK_GROUPS[state.profile.group] + '。');
  go('hall');
}

function usefulClipboard(text) {
  if (!navigator.clipboard) throw new Error('请点查看游玩码，再手动复制。');
  return navigator.clipboard.writeText(text);
}

async function cloudButton(button) {
  const wasOnline = view === 'online';
  button.disabled = true;
  button.textContent = '正在连接…';
  try {
    await cloud.create();
    toast('云档已创建，可在角色页查看游玩码。');
    if (wasOnline) { render(); changeRoute(); }
    else render();
  } catch (error) {
    button.disabled = false;
    button.textContent = wasOnline ? '开启联机' : '创建游玩码';
    const label = document.querySelector('#account-error');
    if (label) label.textContent = error.message;
    toast(error.message);
  }
}

app.addEventListener('click', async event => {
  if (event.target.closest('.skip')) { event.preventDefault(); app.querySelector('main')?.focus(); return; }
  const choice = event.target.closest('[data-choice]');
  if (choice) {
    const key = choice.dataset.choice;
    draft[key] = key === 'gender' ? choice.dataset.value : Number(choice.dataset.value);
    render();
    app.querySelector('[data-choice="' + key + '"][data-value="' + choice.dataset.value + '"]')?.focus();
    return;
  }
  const worldButton = event.target.closest('[data-world]');
  if (worldButton) {
    const action = worldButton.dataset.world;
    if (action === 'reward') {
      const id = worldButton.dataset.target;
      if (state.onlineCompleted.includes(id)) { toast('已领取本次协作奖励。'); return; }
      if (world?.room?.id !== id || world.room.step < 3) return;
      commit(s => { s.onlineCompleted.push(id); s.coins += 35; s.xp += 25; });
      toast('双人质检完成：+25 经验，+35 工坊积分。');
      return;
    }
    if (action === 'retry') { await refreshWorld(); return; }
    worldButton.disabled = true;
    if (await refreshWorld(action, { target: worldButton.dataset.target })) {
      if (action === 'invite') toast('邀请已发出。');
    }
    worldButton.disabled = false;
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'quick') setProfile({ ...initialState(), name: '见习装配员', face: 1 });
  if (action === 'back-create') { step = Math.max(0, step - 1); render(); }
  if (action === 'reset-avatar') { draft = profileFrom({ name: draft.name, group: draft.group }); render(); }
  if (action === 'edit-avatar') { draft = { ...state.profile }; step = 1; go('create'); }
  if (action === 'cloud-create') await cloudButton(button);
  if (action === 'copy-code') {
    try { await usefulClipboard(cloud.meta().code); toast('游玩码已复制。'); }
    catch { toast('请点查看游玩码，再手动复制。'); }
  }
  if (action === 'reveal-code') {
    const field = document.querySelector('#cloud-code');
    field.hidden = !field.hidden;
    field.textContent = field.hidden ? '' : cloud.meta().code;
    button.setAttribute('aria-expanded', String(!field.hidden));
    button.textContent = field.hidden ? '查看游玩码' : '隐藏游玩码';
  }
  if (action === 'sync-now') await (cloud.status() === 'offline' ? cloud.resume() : cloud.flush());
  if (action === 'use-cloud') { cloud.useRemote(); render(); toast('已读取云端存档。'); }
  if (action === 'local-mode') { cloud.goLocal(); render(); toast('本地进度已保留。'); }
});

app.addEventListener('input', event => {
  if (event.target.id !== 'nick') return;
  draft.name = event.target.value;
  const hint = document.querySelector('#name-hint');
  hint.textContent = validName(draft.name) ? '名称格式可用' : '可用汉字、字母、数字，长度 2–14 字。';
  event.target.setAttribute('aria-invalid', String(!!draft.name && !validName(draft.name)));
});

app.addEventListener('submit', async event => {
  const form = event.target;
  if (form.id === 'create-form') {
    event.preventDefault();
    if (step < 2) { step += 1; render(); app.querySelector('#nick, [data-choice]')?.focus(); return; }
    draft.name = String(new FormData(form).get('nickname') ?? '');
    if (!validName(draft.name)) {
      const field = document.querySelector('#nick');
      field.setAttribute('aria-invalid', 'true');
      document.querySelector('#name-hint').textContent = '请输入 2–14 字的有效昵称。';
      field.focus();
      return;
    }
    setProfile(draft);
  }
  if (form.id === 'signin-form') {
    event.preventDefault();
    const code = new FormData(form).get('code').trim();
    const field = form.querySelector('input');
    if (!code) { document.querySelector('#account-error').textContent = '请先输入游玩码。'; field.focus(); return; }
    const submit = form.querySelector('button');
    submit.disabled = true;
    submit.textContent = '正在读取…';
    try { await cloud.signIn(code); toast('云档已恢复。'); go('hall'); }
    catch (error) {
      document.querySelector('#account-error').textContent = error.status === 401 ? '未识别这份游玩码，请确认后重试。' : error.message;
      field.focus();
      submit.disabled = false;
      submit.textContent = '读取我的云档';
    }
  }
  if (form.id === 'world-chat') {
    event.preventDefault();
    const field = form.querySelector('input');
    const message = field.value.trim();
    if (!message) { field.focus(); return; }
    form.querySelector('button').disabled = true;
    if (await refreshWorld('chat', { text: message })) field.value = '';
    form.querySelector('button').disabled = false;
    field.focus();
  }
});

window.addEventListener('hashchange', changeRoute);
window.addEventListener('online', cloud.resume);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && view === 'online') refreshWorld();
  if (document.hidden) cloud.flush();
});
changeRoute();
cloud.resume();
