import { SOCIAL_GIFTS } from './social-gifts.js';

const boards = {
  received: { label: '收到礼物积分', unit: '积分' },
  sent: { label: '送礼贡献', unit: '积分' },
  featured: { label: '上电视次数', unit: '次' },
};
const gifts = Object.values(SOCIAL_GIFTS);
const number = new Intl.NumberFormat('zh-CN');
const shortTime = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

function personName(person) {
  return person?.name ?? person?.profile?.name ?? '工友';
}

function avatar(ctx, person, size = '') {
  const profile = person?.profile;
  const visibleName = [...personName(person)][0] ?? '?';
  return `<span class="plaza-avatar ${size}" aria-hidden="true">${profile
    ? ctx.portrait(profile)
    : ctx.escape(visibleName)}</span>`;
}

function timeMarkup(value) {
  const date = new Date(value ?? NaN);
  return Number.isFinite(date.getTime())
    ? `<time datetime="${date.toISOString()}">${shortTime.format(date)}</time>`
    : '';
}

function giftArt(ctx, gift, cssClass = '', loading = 'lazy') {
  return gift?.asset
    ? `<img class="${cssClass}" src="${ctx.escape(ctx.asset(gift.asset))}" alt="" width="64" height="64" decoding="async" loading="${loading}">`
    : '';
}

function featureMarkup(ctx, board) {
  const event = board?.featured;
  if (!event) return '<p>送出标有「上电视」的礼物，赠礼动态会登上这里。</p>';
  const { from, to } = event;
  const gift = SOCIAL_GIFTS[event.giftId];
  return `<div class="plaza-feature-event">
    ${giftArt(ctx, gift, 'plaza-feature-gift', 'eager')}
    <div><p><strong>${ctx.escape(personName(from))}</strong> 送给 <strong>${ctx.escape(personName(to))}</strong></p>
      <p class="plaza-feature-name">${ctx.escape(gift?.name ?? '工坊礼物')}</p></div>
    <div class="plaza-feature-people">${avatar(ctx, from)}${avatar(ctx, to)}</div>
  </div>`;
}

function feedMarkup(ctx, messages) {
  if (!messages) return '<p class="plaza-empty">正在加载世界频道…</p>';
  if (!messages.length) return '<p class="plaza-empty">还没有世界消息。</p>';
  return `<ol class="plaza-feed-list">${messages.map((entry) => {
    const gift = SOCIAL_GIFTS[entry.giftId];
    const isGift = entry.type === 'gift';
    return `<li class="plaza-feed-entry" data-entry-type="${isGift ? 'gift' : 'message'}">
      ${avatar(ctx, entry.from)}
      <div><div class="plaza-feed-meta"><strong>${ctx.escape(personName(entry.from))}</strong>${timeMarkup(entry.at)}</div>
        ${isGift
          ? `<p class="plaza-feed-gift">${giftArt(ctx, gift)}<span>送给 <strong>${ctx.escape(personName(entry.to))}</strong> ${ctx.escape(gift?.name ?? '工坊礼物')}${entry.featured ? ' <span class="plaza-tv-label">上电视</span>' : ''}</span></p>`
          : `<p class="plaza-message-text">${ctx.escape(entry.text ?? '')}</p>`}
      </div>
    </li>`;
  }).join('')}</ol>`;
}

function playersMarkup(ctx, board, authenticated) {
  const me = board?.me;
  const players = (board?.players ?? []).filter(({ id }) => id && id !== me?.id);
  return `<div class="plaza-panel-heading"><h2 id="plaza-people-title">广场工友</h2>
      ${me ? `<span class="plaza-me">${avatar(ctx, me)}<span>${ctx.escape(personName(me))}<small>我的角色</small></span></span>` : ''}</div>
    ${players.length ? `<ul class="plaza-players">${players.map((player) => `<li>
      ${avatar(ctx, player)}
      <strong>${ctx.escape(personName(player))}</strong>
      ${authenticated ? `<button type="button" class="btn btn-secondary" data-sp-gift-target="${ctx.escape(player.id)}" aria-label="${ctx.escape('给' + personName(player) + '送礼')}">送礼</button>` : ''}
    </li>`).join('')}</ul>` : `<p class="plaza-empty">${board ? '目前还没有其他工友。' : '连接云存档后可查看广场工友。'}</p>`}`;
}

function inboxMarkup(ctx, entries) {
  if (!entries.length) return '<p class="plaza-empty">还没有收到礼物。</p>';
  return `<ol class="plaza-inbox-list" tabindex="0" aria-label="最近收到的礼物">${entries.map((entry) => {
    const gift = SOCIAL_GIFTS[entry.giftId];
    return `<li>${avatar(ctx, entry.from)}<div>
      <strong>${ctx.escape(personName(entry.from))}</strong> 送来 ${ctx.escape(gift?.name ?? '工坊礼物')}
      ${timeMarkup(entry.at)}</div></li>`;
  }).join('')}</ol><p class="plaza-inbox-end">以上为最近收到的礼物。</p>`;
}

function rankingMarkup(ctx, board, ranking) {
  const rows = board?.leaderboards?.[ranking] ?? [];
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const unit = boards[ranking].unit;
  const score = (player) => number.format(player.score ?? 0);
  if (!top.length) return '<p class="plaza-empty">这个榜单还没有名次。</p>';
  return `<ol class="plaza-podium" aria-label="前三名">${top.map((player, index) => `<li class="plaza-place">
    <div class="plaza-place-person">${avatar(ctx, player, 'plaza-avatar-podium')}<strong>${ctx.escape(personName(player))}</strong>
      <span>${score(player)} <small>${unit}</small></span></div>
    <span class="plaza-place-rank">第 ${index + 1} 名</span>
  </li>`).join('')}</ol>
  ${rest.length ? `<ol class="plaza-rank-list" start="4">${rest.map((player, index) => `<li>
    <span class="plaza-rank-num">${index + 4}</span>${avatar(ctx, player)}<strong>${ctx.escape(personName(player))}</strong>
    <span class="plaza-rank-score">${score(player)} <small>${unit}</small></span></li>`).join('')}</ol>` : ''}`;
}

function giftOptions(ctx) {
  return gifts.map((gift, index) => `<label class="plaza-gift-option">
    <input type="radio" name="gift" value="${ctx.escape(gift.id)}"${index === 0 ? ' checked' : ''}>
    ${giftArt(ctx, gift)}
    <span class="plaza-gift-option-copy"><strong>${ctx.escape(gift.name)}</strong>
      ${gift.description ? `<small>${ctx.escape(gift.description)}</small>` : ''}
      ${gift.featured ? '<span class="plaza-tv-label">上电视</span>' : ''}</span>
    <span class="plaza-gift-cost">${number.format(gift.cost)} 积分</span>
  </label>`).join('');
}

export function socialPage(ctx) {
  const { board, authenticated } = ctx.social.snapshot();
  return `<section class="container social-plaza" data-social-plaza>
    <header class="plaza-header"><div><h1>社交广场</h1><p>和工友聊天、送礼，看看大家最近的广场动态。</p></div>
      <nav aria-label="工友活动"><a href="#friends">工友名录</a><a href="#online">联机大厅</a><a href="#team">组队训练</a><a href="#help">工友求助</a></nav></header>
    <section class="plaza-feature" aria-labelledby="plaza-feature-title">
      <img class="plaza-feature-backdrop" src="${ctx.escape(ctx.asset('social'))}" alt="" decoding="async" fetchpriority="high">
      <div class="plaza-feature-content"><h2 id="plaza-feature-title">工坊电视</h2>
        <div data-sp-feature>${featureMarkup(ctx, board)}</div></div>
    </section>
    <p class="plaza-notice" data-sp-service-error role="status" hidden></p>
    <div class="plaza-layout">
      <div class="plaza-main-column">
        <section class="plaza-panel plaza-world" aria-labelledby="plaza-world-title">
          <div class="plaza-panel-heading"><h2 id="plaza-world-title">世界频道</h2><button class="btn btn-text" type="button" data-sp-refresh>刷新</button></div>
          <div class="plaza-feed" data-sp-feed role="log" aria-label="世界消息" tabindex="0">${feedMarkup(ctx, board?.feed)}</div>
          <form class="plaza-composer" data-sp-composer novalidate${authenticated ? '' : ' hidden'}>
            <label class="sr-only" for="plaza-message">世界频道消息</label>
            <input id="plaza-message" name="message" type="text" maxlength="160" placeholder="给世界频道留言" autocomplete="off" required aria-describedby="plaza-message-status">
            <button class="btn btn-primary" type="submit">发送</button>
            <p id="plaza-message-status" class="plaza-form-status" data-sp-message-status role="status"></p>
          </form>
          <div class="plaza-sign-in" data-sp-sign-in${authenticated ? ' hidden' : ''}>
            <p>启用或读取云存档后，即可发消息和送礼。</p><a href="#account" class="btn btn-secondary">去角色与存档</a></div>
        </section>
        <section class="plaza-panel plaza-people" aria-labelledby="plaza-people-title">
          <div data-sp-people>${playersMarkup(ctx, board, authenticated)}</div>
          <details class="plaza-inbox" data-sp-inbox${authenticated ? '' : ' hidden'}>
            <summary>收到的礼物 <span data-sp-inbox-count>${number.format(board?.inbox?.length ?? 0)} 份</span></summary>
            <div data-sp-inbox-content>${inboxMarkup(ctx, board?.inbox ?? [])}</div>
          </details>
        </section>
      </div>
      <section class="plaza-panel plaza-rankings" aria-labelledby="plaza-rank-title">
        <div class="plaza-panel-heading"><h2 id="plaza-rank-title">工友排行榜</h2></div>
        <div class="plaza-rank-tabs" role="tablist" aria-label="排行类型">
          ${Object.entries(boards).map(([key, detail]) => `<button type="button" id="plaza-rank-${key}" role="tab" aria-controls="plaza-rank-panel"
            aria-selected="${key === 'received'}" tabindex="${key === 'received' ? 0 : -1}" data-sp-ranking="${key}">${detail.label}</button>`).join('')}
        </div>
        <div id="plaza-rank-panel" role="tabpanel" aria-labelledby="plaza-rank-received" tabindex="0" data-sp-rank>${rankingMarkup(ctx, board, 'received')}</div>
      </section>
    </div>
    <dialog class="plaza-gift-dialog" aria-labelledby="plaza-gift-title" aria-describedby="plaza-gift-recipient" data-sp-dialog>
      <form class="plaza-gift-form" data-sp-gift-form novalidate>
        <header class="plaza-gift-header"><div><h2 id="plaza-gift-title">送一份礼物</h2><p id="plaza-gift-recipient" data-sp-recipient></p></div>
          <button class="btn btn-secondary" type="button" data-sp-close aria-label="关闭礼物选择">×</button></header>
        <fieldset class="plaza-gift-options" data-sp-gift-options><legend>选择礼物</legend></fieldset>
        <footer class="plaza-gift-footer"><p class="plaza-form-status" role="status" data-sp-gift-status></p><button class="btn btn-primary" type="submit">确认送礼</button></footer>
      </form>
    </dialog>
  </section>`;
}

function errorText(error, fallback) {
  return typeof error === 'string' ? error : error?.message || fallback;
}

export function bindSocialPage(root, ctx) {
  const page = root.matches('[data-social-plaza]') ? root : root.querySelector('[data-social-plaza]');
  if (!page) return () => {};

  const select = (name) => page.querySelector(`[data-sp-${name}]`);
  const feed = select('feed');
  const people = select('people');
  const inbox = select('inbox');
  const inboxCount = select('inbox-count');
  const inboxContent = select('inbox-content');
  const rank = select('rank');
  const refresh = select('refresh');
  const serviceError = select('service-error');
  const composer = select('composer');
  const input = composer.elements.namedItem('message');
  const send = composer.querySelector('[type="submit"]');
  const messageStatus = select('message-status');
  const dialog = select('dialog');
  const giftForm = select('gift-form');
  const giftChoices = select('gift-options');
  const giftButton = giftForm.querySelector('[type="submit"]');
  const giftStatus = select('gift-status');
  const tabs = [...page.querySelectorAll('[data-sp-ranking]')];
  const listeners = new AbortController();
  const { signal } = listeners;
  const initial = ctx.social.snapshot();
  const rendered = new Map([
    [select('feature'), featureMarkup(ctx, initial.board)],
    [feed, feedMarkup(ctx, initial.board?.feed)],
    [people, playersMarkup(ctx, initial.board, initial.authenticated)],
    [inboxContent, inboxMarkup(ctx, initial.board?.inbox ?? [])],
    [rank, rankingMarkup(ctx, initial.board, 'received')],
  ]);
  let ranking = 'received';
  let giftTarget = null;
  let sending = false;
  let gifting = false;

  function update(element, markup) {
    if (rendered.get(element) === markup) return;
    rendered.set(element, markup);
    element.innerHTML = markup;
  }

  function giftControl(id) {
    return [...people.querySelectorAll('[data-sp-gift-target]')].find((button) => button.dataset.spGiftTarget === id);
  }

  function sync() {
    if (signal.aborted) return;
    const { board, error, busy, authenticated } = ctx.social.snapshot();
    refresh.disabled = Boolean(busy);
    const notice = error ? errorText(error, '暂时无法读取广场，请刷新重试。') : '';
    serviceError.hidden = !notice;
    if (serviceError.textContent !== notice) serviceError.textContent = notice;
    composer.hidden = !authenticated;
    select('sign-in').hidden = Boolean(authenticated);
    send.disabled = !authenticated || busy || sending;
    giftButton.disabled = !authenticated || busy || gifting || !giftTarget;
    dialog.setAttribute('aria-busy', String(gifting));
    if (dialog.open && !authenticated && !gifting) dialog.close();

    const follow = feed.scrollHeight - feed.clientHeight - feed.scrollTop < 36;
    const oldScroll = feed.scrollTop;
    update(select('feature'), featureMarkup(ctx, board));
    update(feed, feedMarkup(ctx, board?.feed ?? (error ? [] : undefined)));
    feed.scrollTop = follow ? feed.scrollHeight : oldScroll;
    const active = page.ownerDocument.activeElement;
    const playerFocus = people.contains(active) && active.dataset.spGiftTarget;
    update(people, playersMarkup(ctx, board, authenticated));
    if (playerFocus && !people.contains(page.ownerDocument.activeElement)) giftControl(playerFocus)?.focus();
    inbox.hidden = !authenticated;
    if (!authenticated) inbox.open = false;
    const entries = authenticated ? (board?.inbox ?? []) : [];
    const count = number.format(entries.length) + ' 份';
    if (inboxCount.textContent !== count) inboxCount.textContent = count;
    update(inboxContent, inboxMarkup(ctx, entries));
    update(rank, rankingMarkup(ctx, board, ranking));
  }

  function changeRank(tab) {
    ranking = tab.dataset.spRanking;
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    }
    rank.setAttribute('aria-labelledby', tab.id);
    sync();
  }

  async function reload() {
    try { await ctx.social.refresh(); } catch (error) {
      if (signal.aborted) return;
      serviceError.textContent = errorText(error, '暂时无法读取广场，请刷新重试。');
      serviceError.hidden = false;
    }
  }

  page.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-sp-ranking]');
    if (tab) return changeRank(tab);
    if (event.target.closest('[data-sp-refresh]')) return void reload();
    if (event.target.closest('[data-sp-close]')) return dialog.close();
    const control = event.target.closest('[data-sp-gift-target]');
    if (!control) return;
    const { board, authenticated } = ctx.social.snapshot();
    const player = board?.players?.find(({ id }) => id === control.dataset.spGiftTarget);
    if (!authenticated || !player || player.id === board.me?.id) return;
    giftTarget = player.id;
    select('recipient').textContent = '送给 ' + personName(player);
    giftStatus.textContent = '';
    if (!giftChoices.querySelector('input')) giftChoices.insertAdjacentHTML('beforeend', giftOptions(ctx));
    giftForm.reset();
    sync();
    dialog.showModal();
  }, { signal });

  page.addEventListener('keydown', (event) => {
    const active = tabs.indexOf(event.target);
    if (active < 0) return;
    let next;
    switch (event.key) {
      case 'ArrowRight': next = (active + 1) % tabs.length; break;
      case 'ArrowLeft': next = (active + tabs.length - 1) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    changeRank(tabs[next]);
    tabs[next].focus();
  }, { signal });

  composer.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending || !ctx.social.snapshot().authenticated) return;
    const draft = input.value;
    const message = draft.trim();
    delete messageStatus.dataset.kind;
    if (!message) {
      input.setAttribute('aria-invalid', 'true');
      messageStatus.textContent = '请输入要发送的消息。';
      input.focus();
      return;
    }
    sending = true;
    send.textContent = '发送中';
    messageStatus.textContent = '';
    sync();
    try {
      const result = await ctx.social.message(message);
      if (result?.ok === false) throw Error(errorText(result.error, '发送失败，请重试。'));
      if (signal.aborted) return;
      if (input.value === draft) input.value = '';
      messageStatus.dataset.kind = 'success';
      messageStatus.textContent = '已发送';
    } catch (error) {
      if (!signal.aborted) messageStatus.textContent = errorText(error, '发送失败，请重试。');
    } finally {
      sending = false;
      if (!signal.aborted) send.textContent = '发送';
      sync();
    }
  }, { signal });
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    if (!sending) messageStatus.textContent = '';
  }, { signal });

  dialog.addEventListener('cancel', (event) => {
    if (gifting) event.preventDefault();
  }, { signal });
  dialog.addEventListener('close', () => {
    giftControl(giftTarget)?.focus();
    giftTarget = null;
    sync();
  }, { signal });
  giftForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const gift = SOCIAL_GIFTS[new FormData(giftForm).get('gift')];
    if (gifting || !giftTarget || !gift?.id || !ctx.social.snapshot().authenticated) return;
    gifting = true;
    giftButton.textContent = '送礼中';
    select('close').disabled = true;
    giftStatus.textContent = '';
    sync();
    try {
      const result = await ctx.social.gift(giftTarget, gift.id);
      if (result?.ok === false) throw Error(errorText(result.error, '送礼失败，请重试。'));
      if (signal.aborted) return;
      dialog.close();
      ctx.toast?.(gift.featured ? '礼物已送出，并登上工坊电视。' : '礼物已送出。');
    } catch (error) {
      if (!signal.aborted) giftStatus.textContent = errorText(error, '送礼失败，请重试。');
    } finally {
      gifting = false;
      if (!signal.aborted) {
        giftButton.textContent = '确认送礼';
        select('close').disabled = false;
      }
      sync();
    }
  }, { signal });

  const unsubscribe = ctx.social.subscribe(sync);
  sync();
  void reload();
  return () => {
    listeners.abort();
    unsubscribe();
    if (dialog.open) dialog.close();
  };
}
