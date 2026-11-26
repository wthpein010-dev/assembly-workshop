import { SHOP_GIFT_NOTES, SHOP_ITEMS, isShopRedeemed } from './shop-catalog.js';

const contacts = {
  lin: { name: '林师傅', role: '维修导师', sign: '林', look: { gender: 'male', face: 2 }, reply: '先把现场现象和测量结果记下来，下一班就知道从哪里查起。' },
  qiao: { name: '小乔', role: '质检伙伴', sign: '乔', look: { gender: 'female', face: 1 }, reply: '我来复核记录。把测量值和异常点一起发给我。' },
  zhu: { name: '老朱', role: '装配搭档', sign: '朱', look: { gender: 'male', face: 3 }, reply: '收到。工件对齐了再锁紧，有偏差就先停一下。' },
};
const channels = { floor: '工坊大厅', tips: '技巧交流', shifts: '交接频道' };
const briefs = {
  floor: ['林师傅', '欢迎来到工坊。先认识一位伙伴，再到班组协作试一轮交接。'],
  tips: ['小乔', '复测时要保留第一次的读数。两次记录都留着，才好追查变化。'],
  shifts: ['老朱', '今天的演练是传动泵交接。装配、质检、维修岗位都可以参加。'],
};
const tasks = {
  pump: { name: '传动泵交接演练', view: 'team' },
  check: { name: '首件质量复核', view: 'missions' },
  repair: { name: '轴承异响排查', view: 'help' },
};
const items = SHOP_ITEMS;
const handoffTools = {
  screw: { name: '定位螺钉', code: 'M4', asset: 'part-screw' },
  gauge: { name: '间隙规片', code: '0.15 mm' },
  record: { name: '交接记录卡', code: 'LOG', asset: 'part-tag' },
  isolation: { name: '停机挂牌', code: 'STOP' },
  cable: { name: '复验连接线', code: 'TEST', asset: 'part-cable' },
};
const roles = {
  assembly: { name: '装配员', steps: [
    { label: '定位备料', slot: 'M4 定位件槽', item: 'screw', prompt: '泵壳定位线偏左。领好定位件后，先检查哪一步？', correct: 'align', choices: { torque: '先拧紧紧固件', align: '核对并对齐定位线' }, note: '先按定位线调整泵壳，再做紧固。' },
    { label: '扭矩签交', slot: '扭矩记录夹', item: 'record', prompt: '定位已复核，仍有两处紧固点待确认。如何交接？', correct: 'torque', choices: { torque: '复核并记录扭矩', release: '口头说明后放行' }, note: '把复核结果写进交接记录。' },
  ] },
  quality: { name: '质检员', steps: [
    { label: '首件复测', slot: '0.15 mm 量具槽', item: 'gauge', prompt: '交接只附了外观照片，关键间隙缺少实测值。你先做什么？', correct: 'measure', choices: { record: '填写放行记录', measure: '测量并复核间隙' }, note: '先获得实测间隙，再填写记录。' },
    { label: '读数签交', slot: '读数记录夹', item: 'record', prompt: '复测数值符合工单要求。如何交给下一岗？', correct: 'record', choices: { mark: '只标记外观合格', record: '记录两次读数并签交' }, note: '两次读数都要写进交接记录。' },
  ] },
  repair: { name: '维修员', steps: [
    { label: '停机排查', slot: '停机状态挂牌位', item: 'isolation', prompt: '交班记录里有轴承异响。核对停机牌后，你先做什么？', correct: 'inspect', choices: { reset: '立即复位试运转', inspect: '确认隔离后检查轴承' }, note: '先确认隔离，再排查异常位置。' },
    { label: '恢复复验', slot: '复验线托盘', item: 'cable', prompt: '工件检查完毕，准备把复验线交给下一岗。如何交接？', correct: 'verify', choices: { verify: '记录维修结果并安排复验', release: '清空异常记录后放行' }, note: '保留异常和处理记录，再交给复验岗。' },
  ] },
};
const visibility = { public: '工坊大厅', team: '仅班组', mentor: '仅导师' };
const stages = { open: '待认领', claimed: '处理中', resolved: '已解决' };
const routes = {
  social: ['工友与频道', '加入频道聊天，和演示工友组队。', 'cover'],
  team: ['班组协作', '传动泵工单 · 完成岗位检查后交给下一班。', 'station'],
  help: ['工坊求助板', '记录异常、认领工单，把处理结果留给下一班。', 'quality-board'],
  shop: ['积分兑换站', '用工坊积分换纪念物，也可以给工友送礼。', 'yard'],
  honor: ['个人荣誉', '把获得的荣誉佩戴在工坊名片上。', 'cover'],
  event: ['赛季工坊计划', '和演示班组一起完成本期交接改进目标。', 'season-scene'],
};
const seasonBase = 3;
const seasonGoal = 8;

export function newCommunity() {
  return {
    channel: 'floor', friendChat: null, friends: [], messages: {},
    team: null, teamWins: [], teamBest: {}, ticketNumber: 0, ticketFilter: 'all', editing: null,
    tickets: [
      { id: 'bearing', by: 'lin', title: '传动轴承异响', text: '试转记录里出现了周期性异响。工件已停机挂牌，待排查原因并记录复测。', visibility: 'public', stage: 'open' },
      { id: 'bracket', by: 'qiao', title: '支架复测单缺读数', text: '第二次复测已完成，原工单还少一个间隙读数。请核对后补齐记录。', visibility: 'team', stage: 'open' },
    ],
    owned: [], equipped: null, shopTab: 'exchange', honorTab: 'honors', gifts: [], shopOrders: [],
    inbox: [{ id: 'welcome', item: 'newcomer', by: 'lin', text: '送你第一枚工坊徽章。来求助板看看，也欢迎和我组队。' }],
    contribution: 0, shared: false, seasonClaimed: false,
  };
}

const named = (collection, id) => Object.hasOwn(collection, id) ? collection[id] : null;
const success = (message = '') => ({ ok: true, message });
const failure = (message) => ({ ok: false, message });
const handoffScore = (team) => Math.max(0, 100 - 12 * (team.misses ?? 0));
const clean = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const teammate = (id) => named(contacts, id)?.name ?? '演示工友';
const grant = (c, id) => { if (!c.owned.includes(id)) c.owned.push(id); };

export const shopFriendName = teammate;

export function shopFriends(community) {
  const friends = Array.isArray(community?.friends) ? community.friends : [];
  return [...new Set(friends)].filter((id) => named(contacts, id)).map((id) => ({ id, name: teammate(id) }));
}

function post(c, author, text, task = null) {
  const key = c.friendChat ?? c.channel;
  const log = c.messages[key] ?? [];
  c.messages[key] = [...log, { author, text, task }].slice(-28);
}

export function communityTitle(state) {
  return named(items, state.community?.equipped)?.name ?? '';
}

export function updateCommunity(state, action, value) {
  const c = state.community ?? newCommunity();
  const result = applyAction(state, c, action, value);
  if (result.ok || result.changed) state.community = c;
  return result;
}

function applyAction(state, c, action, value) {
  switch (action) {
    case 'channel':
      if (!named(channels, value)) return failure('请选一个频道。');
      c.channel = value;
      c.friendChat = null;
      return success();
    case 'friend':
      if (!named(contacts, value) || c.friends.includes(value)) return failure('这位工友已在好友名单里。');
      c.friends.push(value);
      return success('已添加' + teammate(value));
    case 'direct':
      if (!c.friends.includes(value)) return failure('先添加这位工友。');
      c.friendChat = value;
      return success();
    case 'chat': {
      const text = clean(value, 180);
      if (!text) return failure('写一句话再发送。');
      const replyBy = c.friendChat ?? ({ floor: 'lin', tips: 'qiao', shifts: 'zhu' })[c.channel];
      post(c, '你', text);
      post(c, teammate(replyBy), contacts[replyBy].reply);
      return success();
    }
    case 'share': {
      const task = named(tasks, value);
      if (!task) return failure('请先选一项工单。');
      post(c, '你', '分享工单 · ' + task.name, value);
      if (!c.shared) {
        c.shared = true;
        c.contribution += 1;
      }
      return success('工单已分享到当前对话。');
    }
    case 'invite':
      if (!named(contacts, value) || c.team?.stage === 'active') return failure('完成正在进行的交接后再邀请。');
      c.team = { mate: value, role: 'assembly', stage: 'invited', step: 0 };
      return success(teammate(value) + '已应邀加入。');
    case 'choose-role':
      if (!named(roles, value) || !['invited', 'ready'].includes(c.team?.stage)) return failure('请先邀请工友。');
      c.team.role = value;
      c.team.stage = 'invited';
      return success();
    case 'ready':
      if (c.team?.stage !== 'invited') return failure('请先邀请工友。');
      c.team.stage = 'ready';
      return success('双方已就绪。');
    case 'start-team':
      if (c.team?.stage !== 'ready') return failure('双方就绪后再开始交接。');
      c.team.stage = 'active';
      return success();
    case 'challenge-team':
      if (c.team?.stage !== 'active') c.team = { mate: 'qiao', role: 'quality', stage: 'ready', step: 0 };
      return success();
    case 'team-replay':
      if (c.team?.stage !== 'complete') return failure('交接结束后可重玩。');
      c.team = { mate: c.team.mate, role: c.team.role, stage: 'ready', step: 0 };
      return success();
    case 'team-place':
    case 'team-step': {
      const team = c.team;
      if (team?.stage !== 'active' || value?.step !== team.step) return failure('这道检查已经切换。');
      const current = roles[team.role].steps[team.step];
      const miss = (message) => {
        team.misses = (team.misses ?? 0) + 1;
        team.feedback = { kind: 'error', message, delta: '−12' };
        return { ok: false, changed: true, message };
      };
      if (action === 'team-place') {
        if (team.placed === current.item) return failure('这道检查的物品已入槽。');
        if (value.item !== current.item) return miss('与接收槽不符。请核对工单和工具托盘。');
        team.placed = current.item;
        team.feedback = { kind: 'success', message: handoffTools[current.item].name + '已入槽，请确认岗位检查。' };
        return success();
      }
      if (team.placed !== current.item) return failure('先将对应物品放进接收槽。');
      if (value.choice !== current.correct) return miss(current.note);
      team.step += 1;
      team.placed = null;
      team.feedback = { kind: 'success', message: teammate(team.mate) + '已核对' + current.label + '。' };
      if (team.step < roles[team.role].steps.length) return success();
      team.stage = 'complete';
      c.teamBest ??= {};
      const role = team.role;
      c.teamBest[role] = Math.max(c.teamBest[role] ?? 0, handoffScore(team));
      if (c.teamWins.includes(role)) return success('交接通过。该岗位的首次奖励已领取。');
      c.teamWins.push(role);
      c.contribution += 2;
      state.coins += 45;
      state.xp += 25;
      grant(c, 'handoff');
      return success('交接通过，获得 45 积分、25 经验。');
    }
    case 'ticket-filter':
      if (value !== 'all' && value !== 'mine' && !named(visibility, value)) return failure('请选择求助范围。');
      c.ticketFilter = value;
      return success();
    case 'edit-ticket': {
      const ticket = c.tickets.find((entry) => entry.id === value && entry.by === 'you' && entry.stage === 'open');
      if (!ticket) return failure('只可修改自己尚未认领的求助。');
      c.editing = ticket.id;
      return success();
    }
    case 'cancel-edit':
      c.editing = null;
      return success();
    case 'save-ticket': {
      const title = clean(value?.title, 36);
      const body = clean(value?.body, 280);
      if (!title || !body || !named(visibility, value?.visibility)) return failure('填写标题、现场情况和可见范围。');
      if (c.editing) {
        const ticket = c.tickets.find((entry) => entry.id === c.editing && entry.by === 'you' && entry.stage === 'open');
        if (!ticket) return failure('这张求助单已无法修改。');
        Object.assign(ticket, { title, text: body, visibility: value.visibility });
      } else {
        c.ticketNumber += 1;
        c.tickets.unshift({ id: 'ticket-' + c.ticketNumber, by: 'you', title, text: body, visibility: value.visibility, stage: 'open' });
      }
      c.editing = null;
      c.ticketFilter = 'mine';
      return success('求助单已保存。');
    }
    case 'claim-ticket': {
      const ticket = c.tickets.find((entry) => entry.id === value && entry.stage === 'open');
      if (!ticket) return failure('这张求助单已被认领。');
      ticket.stage = 'claimed';
      ticket.assignee = ticket.by === 'you' ? 'lin' : 'you';
      if (c.editing === ticket.id) c.editing = null;
      if (ticket.by === 'you') ticket.reply = '先确认工位状态，再记录看到的现象和复测结果。处理完成后，把结果写在这张单上。';
      return success(ticket.by === 'you' ? '林师傅已认领并回复。' : '已认领求助。');
    }
    case 'resolve-ticket': {
      const ticket = c.tickets.find((entry) => entry.id === value?.id && entry.stage === 'claimed');
      const reply = clean(value?.reply, 180);
      if (!ticket || !reply) return failure('认领求助后，填写处理结果。');
      ticket.stage = 'resolved';
      ticket.resolution = reply;
      c.contribution += 1;
      if (ticket.by !== 'you') state.coins += 25;
      return success(ticket.by === 'you' ? '已记录结果并关闭求助。' : '已关闭求助，获得 25 积分。');
    }
    case 'shop-tab':
      if (!['exchange', 'gift', 'inbox'].includes(value)) return failure('请选择兑换站栏目。');
      c.shopTab = value;
      return success();
    case 'honor-tab':
      if (!['honors', 'bag'].includes(value)) return failure('请选择荣誉或背包。');
      c.honorTab = value;
      return success();
    case 'buy': {
      const item = named(items, value);
      if (!item?.price || isShopRedeemed(c, value)) return failure('这件物品无法再兑换。');
      if (!Number.isSafeInteger(state.coins) || state.coins < item.price) return failure('积分不足。');
      const physical = item.kind === 'physical';
      const order = {
        id: 'exchange-' + item.id, item: item.id, kind: item.kind, spent: item.price,
        status: physical ? 'pending' : 'received', createdAt: Date.now(),
      };
      const orders = Array.isArray(c.shopOrders) ? c.shopOrders : [];
      state.coins -= item.price;
      c.shopOrders = [order, ...orders];
      if (!physical) grant(c, value);
      return { ...success(physical ? '已生成「' + item.name + '」的模拟兑换记录。'
        : '已兑换「' + item.name + '」，可在背包查看。'), order };
    }
    case 'equip':
      if (!named(items, value)?.equipable || !c.owned.includes(value)) return failure('先获得可展示的物品。');
      c.equipped = c.equipped === value ? null : value;
      return success(c.equipped ? '已佩戴「' + items[value].name + '」。' : '已卸下当前荣誉。');
    case 'send-gift': {
      const item = named(items, value?.item);
      if (!item?.price || !item.giftable || item.kind !== 'virtual'
          || !named(contacts, value?.to) || !c.friends.includes(value?.to)) return failure('请选择可赠送的虚拟物品和一位演示好友。');
      if (value.note != null && value.note !== '' && (typeof value.note !== 'string' || !named(SHOP_GIFT_NOTES, value.note))) {
        return failure('请选择预设留言。');
      }
      if (c.gifts.some((gift) => gift.to === value.to && gift.item === value.item)) return failure('已送过这件礼物。');
      if (!Number.isSafeInteger(state.coins) || state.coins < item.price) return failure('积分不足。');
      state.coins -= item.price;
      c.gifts.unshift({ item: value.item, to: value.to, ...(value.note ? { note: value.note } : {}) });
      c.inbox.unshift({ id: 'thanks-' + value.to + '-' + value.item, by: value.to, text: '收到「' + item.name + '」了，谢谢。下次交接我也来搭把手。' });
      return success('已送给' + teammate(value.to) + '。');
    }
    case 'accept-gift': {
      const position = c.inbox.findIndex((gift) => gift.id === value);
      if (position < 0) return failure('这封信已处理。');
      const [gift] = c.inbox.splice(position, 1);
      if (gift.item) grant(c, gift.item);
      return success(gift.item ? '礼物已放入背包。' : '已读回信。');
    }
    case 'season-reward':
      if (c.seasonClaimed || c.contribution + seasonBase < seasonGoal) return failure('达到赛季目标后可领取一次奖励。');
      c.seasonClaimed = true;
      state.coins += 80;
      grant(c, 'season');
      return success('已领取 80 积分和「工坊同行者」。');
    default:
      return failure('这项操作暂不可用。');
  }
}

function button(action, value, text, { primary = false, disabled = false, pressed } = {}) {
  return `<button class="btn btn-${primary ? 'primary' : 'secondary'}" type="button" data-co-action="${action}" data-co-value="${value ?? ''}"${disabled ? ' disabled' : ''}${pressed === undefined ? '' : ` aria-pressed="${pressed}"`}>${text}</button>`;
}

function link(view, text, primary = false) {
  return `<a class="btn btn-${primary ? 'primary' : 'secondary'}" href="#${view}" data-co-go="${view}">${text}</a>`;
}

function fieldOptions(collection, active) {
  return Object.entries(collection).map(([id, label]) => `<option value="${id}"${id === active ? ' selected' : ''}>${label}</option>`).join('');
}

function contactIdentity(person, ctx) {
  const photo = ctx.portrait?.(person.look);
  return `<div class="co-person-id"><span class="co-avatar${photo ? ' co-avatar-photo' : ''}" aria-hidden="true">${photo ?? person.sign}</span><div><h3>${person.name}</h3><p>${person.role} · 演示 NPC</p></div></div>`;
}

function socialPage(c, e, ctx) {
  const key = c.friendChat ?? c.channel;
  const [briefAuthor, briefMessage] = briefs[c.channel];
  const seed = c.friendChat
    ? { author: teammate(c.friendChat), text: contacts[c.friendChat].reply }
    : { author: briefAuthor, text: briefMessage };
  const messages = [seed, ...(c.messages[key] ?? [])];
  return `
    <div class="co-columns co-social">
      <section class="co-panel">
        <div class="co-row"><h2>频道</h2>${link('online', '真人工坊')}</div>
        <div class="co-tabs" aria-label="频道">${Object.entries(channels).map(([id, label]) => button('channel', id, label, { pressed: !c.friendChat && c.channel === id })).join('')}</div>
        <h3>${c.friendChat ? '与' + teammate(c.friendChat) + '私聊' : channels[c.channel]}</h3>
        <div class="co-chat" tabindex="0" role="log" aria-label="聊天记录">
          ${messages.map((m) => `<article class="co-message${m.author === '你' ? ' co-message-self' : ''}"><strong>${e(m.author)}${m.author === '你' ? '' : ' <small>演示 NPC</small>'}</strong><p>${e(m.text)}</p>${named(tasks, m.task) ? link(tasks[m.task].view, '打开工单') : ''}</article>`).join('')}
        </div>
        <form class="co-inline co-chat-form" data-co-form="chat">
          <label class="co-sr" for="co-chat">发消息</label><input type="text" id="co-chat" name="message" placeholder="写一句话…" maxlength="180" required>
          <button class="btn btn-primary" type="submit">发送</button>
        </form>
        <form class="co-inline" data-co-form="share">
          <label class="co-sr" for="co-share">选择工单</label><select id="co-share" name="task">${fieldOptions(Object.fromEntries(Object.entries(tasks).map(([id, task]) => [id, task.name])))}</select>
          <button class="btn btn-secondary" type="submit">分享工单</button>
        </form>
      </section>
      <section class="co-panel">
        <div class="co-row"><h2>工友名录</h2><span class="co-tag">${c.friends.length} 位好友</span></div>
        <div class="co-directory">
          ${Object.entries(contacts).map(([id, person]) => `
            <article class="co-person">
              ${contactIdentity(person, ctx)}
              <div class="co-toolbar">
                ${c.friends.includes(id) ? button('direct', id, '私聊', { pressed: c.friendChat === id }) : button('friend', id, '添加好友')}
                ${button('invite', id, '组队', { primary: true, disabled: c.team?.stage === 'active' })}
              </div>
            </article>`).join('')}
        </div>
      </section>
    </div>`;
}

function handoffTool(id, ctx) {
  const tool = handoffTools[id];
  return `<span class="co-tool-image" data-tool="${id}" aria-hidden="true">${tool.asset ? `<img src="${ctx.escape(ctx.asset(tool.asset))}" alt="" draggable="false">` : `<b>${tool.code}</b>`}</span><strong>${tool.name}</strong>`;
}

function activeHandoff(team, ctx) {
  const role = roles[team.role];
  const current = role.steps[team.step];
  const placed = team.placed === current.item;
  const feedback = team.feedback;
  return `<section class="co-play" data-co-stage="${team.step}" style="--co-play-bg: url('${ctx.escape(ctx.asset('station'))}')" aria-labelledby="co-title-page">
    <header class="co-play-top">
      <div><p>传动泵 · 交接工单</p><h1 id="co-title-page">${role.name}交接台</h1></div>
      <dl class="co-play-metrics"><div><dt>演示搭档</dt><dd>${teammate(team.mate)}</dd></div><div><dt>当前分数</dt><dd data-co-score>${handoffScore(team)}<small> / 100</small></dd></div></dl>
    </header>
    <ol class="co-play-stages" aria-label="岗位检查进度">${role.steps.map((stage, i) => `<li ${i === team.step ? 'aria-current="step"' : ''} data-done="${i < team.step}"><span>${i < team.step ? '✓' : i + 1}</span>${stage.label}</li>`).join('')}</ol>
    <div class="co-play-body">
      <section class="co-play-tray" aria-labelledby="co-tray-title">
        <div><h2 id="co-tray-title">工具托盘</h2><p id="co-play-instructions">拖入接收槽，或先点选物品，再点接收槽。</p></div>
        <div class="co-play-pieces">${Object.keys(handoffTools).map((id) => `<button class="co-play-piece" type="button" draggable="${!placed}" data-co-piece="${id}" aria-pressed="false"${placed ? ' disabled' : ''}>${handoffTool(id, ctx)}</button>`).join('')}</div>
      </section>
      <section class="co-play-station" aria-labelledby="co-drop-title">
        <div><h2 id="co-drop-title">${current.label}</h2><p>${current.prompt}</p></div>
        <button type="button" class="co-play-drop" data-co-drop data-placed="${placed}" aria-describedby="co-play-instructions"${placed ? ' disabled' : ''}>
          ${placed ? `${handoffTool(current.item, ctx)}<small>已入槽 · ${current.slot}</small>` : `<span aria-hidden="true" class="co-drop-target">+</span><strong>${current.slot}</strong><small>等待放入物品</small>`}
        </button>
        <div class="co-play-confirm" aria-label="岗位确认">
          <p>${placed ? '选择确认动作，签交当前检查。' : '物品入槽后可确认岗位检查。'}</p>
          <div class="co-toolbar">${Object.entries(current.choices).map(([id, label]) => button('team-step', id, label, { disabled: !placed })).join('')}</div>
        </div>
      </section>
    </div>
    <p class="co-play-feedback" data-co-feedback data-kind="${feedback?.kind === 'error' ? 'error' : 'success'}" role="status">${feedback ? `${feedback.delta ? `<b>${ctx.escape(feedback.delta)} 分</b>` : '<b>✓</b>'} ${ctx.escape(feedback.message)}` : '误放或误确认每次扣 12 分，可重试当前检查。'}</p>
  </section>`;
}

function teamPage(c, state, e, ctx) {
  const team = c.team;
  if (team?.stage === 'active') return activeHandoff(team, ctx);
  const stage = { invited: '等待你就绪', ready: '双方就绪', active: '交接中', complete: '交接完成' };
  return `
    <div class="co-columns">
      <section class="co-panel">
        <div class="co-row"><h2>传动泵交接工单</h2><span class="co-tag">${team ? stage[team.stage] : '等待组队'}</span></div>
        ${!team ? '<p>邀请一位演示工友，选择岗位并准备。不同岗位各检查两项。</p>' : `
          <div class="co-partners">
            <div><small>你的岗位</small><strong>${roles[team.role].name}</strong></div>
            <div><small>演示搭档 · 已就绪</small><strong>${teammate(team.mate)}</strong></div>
          </div>
          ${['invited', 'ready'].includes(team.stage) ? `
            <h3>选择岗位</h3><div class="co-tabs" aria-label="岗位">${Object.entries(roles).map(([id, role]) => button('choose-role', id, role.name, { pressed: team.role === id })).join('')}</div>
            <div class="co-toolbar">${team.stage === 'invited' ? button('ready', null, '我已就绪', { primary: true }) : button('start-team', null, '开始交接', { primary: true })}</div>` : ''}
          ${team.stage === 'complete' ? `
            ${c.teamBest?.[team.role] === undefined ? '<p>工单已签交。</p>' : `<dl class="co-play-metrics co-play-result" data-co-result tabindex="-1"><div><dt>本次交接</dt><dd>${handoffScore(team)}<small> / 100</small></dd></div><div><dt>重试次数</dt><dd>${team.misses ?? 0}</dd></div><div><dt>本岗最高分</dt><dd>${c.teamBest[team.role]}</dd></div></dl>`}
            <div class="co-toolbar">${button('team-replay', null, '重玩本岗位', { primary: true })}${link('honor', '查看荣誉')}${link('event', '查看赛季')}</div>` : ''}`}
      </section>
      <section class="co-panel">
        <div class="co-row"><h2>邀请工友</h2>${link('online', '真人联机')}</div>
        <div class="co-directory">
          ${Object.entries(contacts).map(([id, person]) => `<article class="co-person">${contactIdentity(person, ctx)}${button('invite', id, team?.mate === id && team.stage !== 'complete' ? '已应邀' : '邀请', { disabled: team?.stage === 'active' || (team?.mate === id && team.stage !== 'complete') })}</article>`).join('')}
        </div>
      </section>
    </div>`;
}

function ticketCard(ticket, e) {
  return `<article class="co-ticket">
    <div class="co-row"><h3>${e(ticket.title)}</h3><span class="co-tag" data-stage="${ticket.stage}">${stages[ticket.stage]}</span></div>
    <p class="co-meta">${ticket.by === 'you' ? '我发布的' : teammate(ticket.by) + ' · 演示 NPC'} · ${visibility[ticket.visibility]}</p>
    <p>${e(ticket.text)}</p>
    ${ticket.reply ? `<p class="co-reply"><strong>林师傅 · 导师回复</strong>${e(ticket.reply)}</p>` : ''}
    ${ticket.stage === 'open' ? `<div class="co-toolbar">
      ${ticket.by === 'you' ? button('edit-ticket', ticket.id, '修改求助') : ''}
      ${button('claim-ticket', ticket.id, ticket.by === 'you' ? '请导师认领' : '认领工单', { primary: true })}
    </div>` : ''}
    ${ticket.stage === 'claimed' ? `<form class="co-inline" data-co-form="resolve-ticket" data-co-ticket="${ticket.id}">
      <label class="co-sr" for="co-res-${ticket.id}">处理结果</label><input type="text" maxlength="180" id="co-res-${ticket.id}" name="reply" required placeholder="填写处理结果">
      <button class="btn btn-primary" type="submit">确认解决</button>
    </form>` : ''}
    ${ticket.resolution ? `<p class="co-reply"><strong>处理结果</strong>${e(ticket.resolution)}</p>` : ''}
  </article>`;
}

function helpPage(c, e) {
  const current = c.tickets.find((ticket) => ticket.id === c.editing);
  const shown = c.tickets.filter((ticket) => c.ticketFilter === 'all' || (c.ticketFilter === 'mine' ? ticket.by === 'you' : ticket.visibility === c.ticketFilter));
  return `
    <div class="co-columns">
      <section class="co-panel">
        <div class="co-row"><h2>求助工单</h2><span class="co-tag">${shown.length} 张</span></div>
        <div class="co-tabs" aria-label="求助范围">${Object.entries({ all: '全部', mine: '我发布的', ...visibility }).map(([id, label]) => button('ticket-filter', id, label, { pressed: c.ticketFilter === id })).join('')}</div>
        <div class="co-ticket-list">${shown.length ? shown.map((ticket) => ticketCard(ticket, e)).join('') : '<p class="co-empty">这个范围还没有求助单。</p>'}</div>
      </section>
      <section class="co-panel">
        <h2>${current ? '修改求助' : '发布求助'}</h2>
        <form class="co-form" data-co-form="save-ticket">
          <label for="co-title">标题</label><input id="co-title" name="title" required maxlength="36" value="${e(current?.title ?? '')}" placeholder="例：传动泵接头有间隙">
          <label for="co-body">现场情况</label><textarea id="co-body" name="body" required maxlength="280" rows="5" placeholder="记录观察到的现象和已经做过的检查。">${e(current?.text ?? '')}</textarea>
          <label for="co-scope">可见范围</label><select id="co-scope" name="visibility" aria-describedby="co-scope-note">${fieldOptions(visibility, current?.visibility ?? 'public')}</select>
          <p class="co-meta" id="co-scope-note">可见范围用于模拟工单分发。</p>
          <div class="co-toolbar"><button class="btn btn-primary" type="submit">${current ? '保存修改' : '发布求助'}</button>${current ? button('cancel-edit', null, '取消') : ''}</div>
        </form>
      </section>
    </div>`;
}

function collectibleArt(item, ctx) {
  return item?.price ? `<span class="co-item-icon co-item-photo"><img src="${ctx.escape(ctx.asset(item.asset))}" loading="lazy" alt=""></span>`
    : `<span class="co-item-icon" aria-hidden="true">${item?.icon ?? '◇'}</span>`;
}

function itemCard(id, action, ctx) {
  const item = items[id];
  return `<article class="co-item">
    ${collectibleArt(item, ctx)}
    <div class="co-item-body"><p class="co-kicker">${item.type}</p><h3>${item.name}</h3><p>${item.note}</p></div>
    ${action ? button('equip', id, action) : ''}
  </article>`;
}

function honorPage(c, _state, _escape, ctx) {
  const worn = named(items, c.equipped);
  const owned = c.owned.filter((id) => named(items, id));
  const shown = c.honorTab === 'bag' ? owned : owned.filter((id) => items[id].equipable && items[id].type !== '工坊收藏');
  return `<div class="co-columns">
    <section class="co-panel">
      <div class="co-row"><h2>我的藏品</h2><span class="co-tag">${owned.length} 件</span></div>
      <div class="co-tabs" aria-label="荣誉与背包">${button('honor-tab', 'honors', '徽章与称号', { pressed: c.honorTab === 'honors' })}${button('honor-tab', 'bag', '全部背包', { pressed: c.honorTab === 'bag' })}</div>
      ${shown.length ? `<div class="co-items">${shown.map((id) => {
        const collectible = items[id].type === '工坊收藏';
        const action = c.equipped === id ? (collectible ? '收起' : '卸下') : (collectible ? '展示' : '佩戴');
        return itemCard(id, items[id].equipable ? action : '', ctx);
      }).join('')}</div>` : `<div class="co-empty"><p>完成班组交接，或到兑换站领取工坊入门礼。</p><div class="co-toolbar">${link('team', '去班组')}${link('shop', '去兑换站')}</div></div>`}
    </section>
    <section class="co-panel">
      <h2>工坊名片</h2>
      <div class="co-honor-stamp">${collectibleArt(worn, ctx)}<h3>${worn?.name ?? '尚未佩戴荣誉'}</h3>${worn ? `<p>${worn.note}</p>` : ''}</div>
    </section>
  </div>`;
}

function eventPage(c) {
  const progress = Math.min(seasonBase + c.contribution, seasonGoal);
  const buildStages = [[3, '备料入场'], [6, '工位试运行'], [8, '联合验收']];
  const challengePlaying = c.team?.stage === 'active';
  return `<div class="co-columns">
    <section class="co-panel">
      <div class="co-row"><h2>传动泵联合改进</h2><span class="co-tag">${c.seasonClaimed ? '奖励已领取' : progress === seasonGoal ? '达成目标' : '本期进行中'}</span></div>
      <div class="co-season"><p><strong>${progress}</strong> / ${seasonGoal} 份贡献</p><progress value="${progress}" max="${seasonGoal}" aria-label="赛季联合目标">${progress} / ${seasonGoal}</progress></div>
      <ol class="co-build" aria-label="建设里程碑">${buildStages.map(([goal, label]) => `<li data-ready="${progress >= goal}"><span aria-hidden="true">${progress >= goal ? '✓' : '◇'}</span><strong>${label}</strong><small>${progress >= goal ? '已完成' : '累计 ' + goal + ' 份贡献开启'}</small></li>`).join('')}</ol>
      <div class="co-partners"><div><small>演示班组贡献</small><strong>${seasonBase}</strong></div><div><small>你的贡献</small><strong>${c.contribution}</strong></div></div>
      <p>达成奖励 · 80 积分和「工坊同行者」称号</p>
      ${button('season-reward', null, c.seasonClaimed ? '奖励已领取' : '领取赛季奖励', { primary: true, disabled: progress < seasonGoal || c.seasonClaimed })}
    </section>
    <section class="co-panel">
      <h2>本期挑战 · 首件复测交接</h2>
      <p>跟小乔核对间隙和交接记录。首次完成质检岗交接贡献 2 份，可重玩冲击最高分。</p>
      ${button('challenge-team', null, challengePlaying ? '继续当前交接' : '接受交接挑战', { primary: true })}
      <h3>其他贡献途径</h3>
      <div class="co-goals">
        <div><span>完成某岗位的首次交接 · +2</span>${link('team', '班组协作')}</div>
        <div><span>记录处理结果并解决工单 · +1</span>${link('help', '工坊求助')}</div>
        <div><span>首次分享工单 · +1</span>${link('social', '前往频道')}</div>
      </div>
    </section>
  </div>`;
}

const pageBodies = {
  social: (c, _state, e, ctx) => socialPage(c, e, ctx),
  team: teamPage,
  help: (c, s, e) => helpPage(c, e),
  honor: honorPage,
  event: eventPage,
};

export function communityPage(view, ctx) {
  const route = named(routes, view);
  const body = named(pageBodies, view);
  if (!route || !body) return '';
  const [title, description, art] = route;
  const state = ctx.state();
  const c = state.community ?? newCommunity();
  const activeTeam = view === 'team' && c.team?.stage === 'active';
  return `<section class="community" aria-labelledby="co-title-page">
    ${activeTeam ? '' : `<header class="co-hero">
      <div class="co-hero-art" aria-hidden="true" style="--co-art: url('${ctx.escape(ctx.asset(art))}')"></div>
      <div class="co-heading"><h1 id="co-title-page">${title}</h1><p>${description}</p></div>
    </header>`}
    <nav class="co-nav" aria-label="工坊社区">${Object.entries(routes).map(([id, [label]]) => `<a href="#${id}" data-co-go="${id}"${view === id ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    ${body(c, state, ctx.escape, ctx)}
  </section>`;
}

const formActions = {
  chat: (data) => data.message,
  share: (data) => data.task,
  'save-ticket': (data) => data,
  'resolve-ticket': (data, form) => ({ ...data, id: form.dataset.coTicket }),
};

export function bindCommunity(root, view, ctx) {
  const main = root.matches('.community') ? root : root.querySelector('.community');
  if (!main || !named(routes, view)) return;
  const play = main.querySelector('[data-co-stage]');
  const drop = play?.querySelector('[data-co-drop]');
  const pieces = play?.querySelectorAll('[data-co-piece]');
  const stage = Number(play?.dataset.coStage);
  let selected = null;
  let dragging = false;

  function run(action, value, source) {
    const state = ctx.state();
    const next = { community: structuredClone(state.community), coins: state.coins, xp: state.xp };
    const result = updateCommunity(next, action, value);
    if (result.ok || result.changed) {
      ctx.commit((state) => Object.assign(state, next));
      if ((action === 'invite' && view === 'social') || action === 'challenge-team') ctx.go('team');
      else {
        const current = root.ownerDocument.querySelector('.community');
        const target = source.id ? root.ownerDocument.getElementById(source.id)
          : [...(current?.querySelectorAll('[data-co-action]') ?? [])].find((node) => node.dataset.coAction === action && node.dataset.coValue === value && !node.disabled);
        if (action === 'edit-ticket') current?.querySelector('#co-title')?.focus();
        else if (action === 'ready' || action === 'team-replay') current?.querySelector('[data-co-action="start-team"]')?.focus();
        else if (action === 'team-place' && result.ok) current?.querySelector('[data-co-action="team-step"]')?.focus();
        else if (action === 'team-step' && !result.ok) [...(current?.querySelectorAll('[data-co-action="team-step"]') ?? [])].find((node) => node.dataset.coValue === value.choice)?.focus();
        else if (action === 'start-team' || action === 'team-step' || action === 'team-place') current?.querySelector('[data-co-piece], [data-co-result]')?.focus();
        else target?.focus();
      }
    }
    if (result.message) ctx.toast(result.message);
  }

  function selectPiece(id) {
    selected = id;
    for (const piece of pieces) piece.setAttribute('aria-pressed', String(piece.dataset.coPiece === id));
    drop.dataset.selected = String(Boolean(id));
    if (id) drop.setAttribute('aria-label', '放入' + handoffTools[id].name + '，' + drop.querySelector('strong').textContent);
    else drop.removeAttribute('aria-label');
  }

  if (drop && !drop.disabled) {
    play.ondragstart = (event) => {
      const piece = event.target.closest('[data-co-piece]');
      if (!piece || !event.dataTransfer) return;
      dragging = true;
      selectPiece(piece.dataset.coPiece);
      event.dataTransfer.setData('text/plain', selected);
      event.dataTransfer.effectAllowed = 'move';
    };
    play.ondragend = () => {
      dragging = false;
      selectPiece(null);
      delete drop.dataset.over;
    };
    drop.ondragenter = drop.ondragover = (event) => {
      if (!dragging) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      drop.dataset.over = 'true';
    };
    drop.ondragleave = (event) => { if (!drop.contains(event.relatedTarget)) delete drop.dataset.over; };
    drop.ondrop = (event) => {
      if (!dragging || !selected) return;
      event.preventDefault();
      run('team-place', { step: stage, item: selected }, drop);
    };
  }

  main.onclick = (event) => {
    const nav = event.target.closest('[data-co-go]');
    if (nav && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      if (nav.dataset.coGo !== view) ctx.go(nav.dataset.coGo);
      return;
    }
    const piece = event.target.closest('[data-co-piece]');
    if (piece && !piece.disabled) {
      selectPiece(piece.dataset.coPiece);
      drop.focus({ preventScroll: true });
      return;
    }
    if (event.target.closest('[data-co-drop]') && !drop.disabled) {
      if (selected) run('team-place', { step: stage, item: selected }, drop);
      else ctx.toast('先从工具托盘选一件物品。');
      return;
    }
    const control = event.target.closest('[data-co-action]');
    if (control && !control.disabled) {
      const { coAction, coValue } = control.dataset;
      run(coAction, coAction === 'team-step' ? { step: stage, choice: coValue } : coValue, control);
    }
  };

  main.onsubmit = (event) => {
    const form = event.target.closest('[data-co-form]');
    if (!form) return;
    event.preventDefault();
    const action = form.dataset.coForm;
    const data = Object.fromEntries(new FormData(form));
    const source = form.querySelector('input, select, textarea');
    run(action, formActions[action](data, form), source);
  };

  const chatBox = main.querySelector('.co-chat');
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}
