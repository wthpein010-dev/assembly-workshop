const factoryClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const groupDate = /^\d{4}-\d{2}-\d{2}$/;
const checkReward = { xp: 8, coins: 5 };

export const EVENTS = [
  { id: 'shift', type: 'training', title: '白班训练委托', description: '在开放时段完成任一岗位训练。', span: '09:00–17:00', start: 540, end: 1020,
    xp: 15, coins: 8, href: 'missions', label: '前往任务板', asset: 'station' },
  { id: 'evening', type: 'workbench', title: '晚间工坊', description: '在开放时段完成任一厂区工位练习。', span: '17:00–21:00', start: 1020, end: 1260,
    xp: 15, coins: 8, href: 'world', label: '前往厂区', asset: 'yard' },
];

export function factoryTime(now = Date.now()) {
  const parts = Object.fromEntries(factoryClock.formatToParts(now).map(({ type, value }) => [type, value]));
  return { date: [parts.year, parts.month, parts.day].join('-'), time: parts.hour + ':' + parts.minute,
    minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function normalizeActivities(input) {
  const days = input?.days;
  if (!days || typeof days !== 'object' || Array.isArray(days)) return { days: {} };
  return { days: Object.fromEntries(Object.keys(days).filter(date => groupDate.test(date)).sort().slice(-14)
    .map(date => [date, { check: days[date]?.check === true,
      completed: EVENTS.filter(event => Array.isArray(days[date]?.completed) && days[date].completed.includes(event.id)).map(event => event.id) }])) };
}

export function eventState(event, ledger, when) {
  if (ledger?.days?.[when.date]?.completed?.includes(event.id)) return 'complete';
  if (when.minutes < event.start) return 'upcoming';
  return when.minutes < event.end ? 'open' : 'closed';
}

function award(state, when, reward, event) {
  const activity = normalizeActivities(state.activities);
  const day = activity.days[when.date] ??= { check: false, completed: [] };
  if (event ? day.completed.includes(event.id) : day.check) return null;
  if (event) day.completed.push(event.id);
  else day.check = true;
  state.activities = normalizeActivities(activity);
  state.xp += reward.xp;
  state.coins += reward.coins;
  return reward;
}

export function signInActivity(state, now = Date.now()) {
  return state.profile ? award(state, factoryTime(now), checkReward) : null;
}

export function recordPractice(state, type, now = Date.now()) {
  if (!state.profile) return null;
  const when = factoryTime(now);
  const event = EVENTS.find(item => item.type === type && eventState(item, state.activities, when) === 'open');
  return event ? award(state, when, event, event) : null;
}

const labels = { upcoming: '待开放', open: '开放中', closed: '已结束', complete: '已完成' };

function calendar(date, ledger) {
  const sample = new Date(date + 'T12:00:00Z');
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sample);
    day.setUTCDate(day.getUTCDate() - 6 + index);
    const key = day.toISOString().slice(0, 10);
    const checked = ledger.days[key]?.check === true;
    return `<li data-checked="${checked}"${key === date ? ' aria-current="date"' : ''} aria-label="${key} ${checked ? '已签到' : '未签到'}"><time datetime="${key}">${key.slice(5).replace('-', '/')}</time><span aria-hidden="true">${checked ? '✓' : '·'}</span></li>`;
  }).join('');
}

export function activitiesPage(ctx) {
  const now = factoryTime();
  const ledger = normalizeActivities(ctx.state().activities);
  return `<section class="container activities-page" data-activity-page>
    <header class="activities-hero" style="--activity-art:url('${ctx.asset('season-scene')}')">
      <div><h1>工坊日程</h1><p>每日签到与自选训练委托</p></div>
      <div class="activities-clock"><span>加州厂区时间</span><time data-activity-clock>${now.time}</time></div>
    </header>
    <section class="form-panel activity-check">
      <div><h2>每日签到</h2><p>每日一次 · ${checkReward.xp} XP · ${checkReward.coins} 工坊积分</p></div>
      <button type="button" class="btn btn-primary" data-activity-check${ledger.days[now.date]?.check ? ' disabled' : ''}>${ledger.days[now.date]?.check ? '今日已签到' : '签到'}</button>
      <ol class="activity-days" aria-label="近七天签到">${calendar(now.date, ledger)}</ol>
    </section>
    <section class="activity-events" aria-labelledby="activity-events-title">
      <div class="section-heading"><div><h2 id="activity-events-title">限时委托</h2><p>时段内完成，奖励自动入账。</p></div><a class="btn btn-text" href="#event">工坊建设周</a></div>
      <div class="activity-grid">${EVENTS.map(event => {
        const status = eventState(event, ledger, now);
        return `<article class="form-panel activity-event" data-activity-state="${status}">
          <div class="activity-event-art" style="--activity-art:url('${ctx.asset(event.asset)}')"><span>${labels[status]}</span></div>
          <div class="activity-event-details"><h3>${event.title}</h3><span class="activity-window">${event.span}</span><p>${event.description}</p>
            <div class="activity-event-footer"><span>+${event.xp} XP · +${event.coins} 积分</span>${status === 'open' ? `<a class="btn btn-secondary" href="#${event.href}">${event.label}</a>` : ''}</div>
          </div></article>`;
      }).join('')}</div>
    </section>
  </section>`;
}

export function bindActivities(panel, ctx, refresh) {
  const root = panel.querySelector('[data-activity-page]');
  const clock = root.querySelector('[data-activity-clock]');
  let now = factoryTime();
  const key = time => [time.date, ...EVENTS.map(event => eventState(event, ctx.state().activities, time))].join('/');
  root.querySelector('[data-activity-check]').addEventListener('click', () => {
    const reward = ctx.commit(state => signInActivity(state));
    if (reward) ctx.toast(`签到完成 · +${reward.xp} XP · +${reward.coins} 积分`);
  });
  const timer = setInterval(() => {
    const next = factoryTime();
    if (key(next) !== key(now)) { refresh(); return; }
    if (next.time !== now.time) clock.textContent = next.time;
    now = next;
  }, 20_000);
  return () => clearInterval(timer);
}
