import { SOCIAL_GIFTS } from './social-gifts.js';
import { WORK_GROUPS } from './state.js';

const FEED_LIMIT = 24;
const QUEUE_LIMIT = 8;
const SEEN_LIMIT = 128;
const MESSAGE_LIMIT = 160;
const clock = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

export function factorySocialMarkup() {
  return `<div class="factory-social" data-factory-social>
    <button type="button" class="factory-social-toggle" data-fs-toggle aria-controls="factory-world-channel" aria-expanded="false">
      <i aria-hidden="true"></i>世界频道
    </button>
    <div class="factory-social-feature" data-fs-feature hidden></div>
    <div class="factory-social-lanes" data-fs-lanes>
      <div></div><div></div><div></div>
    </div>
    <section class="factory-social-panel" id="factory-world-channel" aria-labelledby="factory-world-channel-title" data-fs-panel hidden>
      <header class="factory-social-header">
        <h2 id="factory-world-channel-title">世界频道</h2>
        <button class="factory-social-option" type="button" data-fs-motion aria-pressed="true">弹幕</button>
        <button class="factory-social-close" type="button" data-fs-close aria-label="收起世界频道">×</button>
      </header>
      <div class="factory-social-scroll" data-fs-scroll tabindex="0" aria-label="世界消息">
        <ul class="factory-social-list" data-fs-feed></ul>
        <p data-fs-empty>正在读取世界消息…</p>
      </div>
      <p class="factory-social-status" id="factory-world-status" data-fs-status role="status"></p>
      <div class="factory-social-footer">
        <button type="button" class="factory-social-option" data-fs-retry hidden>重试连接</button>
        <a class="factory-social-login" href="#account" data-fs-login hidden>登录后发言</a>
        <form class="factory-social-compose" data-fs-compose novalidate hidden>
          <label class="sr-only" for="factory-world-message">世界消息</label>
          <input id="factory-world-message" name="message" maxlength="${MESSAGE_LIMIT}" autocomplete="off" enterkeyhint="send" placeholder="说点什么" aria-describedby="factory-world-status">
          <button type="submit" class="factory-social-send" data-fs-send>发送</button>
        </form>
      </div>
    </section>
    <section class="factory-social-panel factory-social-profile" aria-labelledby="factory-world-profile-title" data-fs-detail hidden>
      <header class="factory-social-header">
        <h2 id="factory-world-profile-title">工友资料</h2>
        <button class="factory-social-close" type="button" data-fs-back aria-label="关闭工友资料">×</button>
      </header>
      <div class="factory-social-scroll" data-fs-person></div>
    </section>
  </div>`;
}

const timestamp = event => typeof event.at === 'number' ? event.at : Date.parse(event.at);
const personName = person => person?.name || '工友';
const giftData = event => Object.hasOwn(SOCIAL_GIFTS, event.giftId) ? SOCIAL_GIFTS[event.giftId] : null;

export function bindFactorySocial(stage, ctx) {
  const shell = stage?.querySelector('[data-factory-social]');
  if (!shell || !ctx.social) {
    if (shell) shell.hidden = true;
    return () => {};
  }
  const { social, escape } = ctx;
  const doc = stage.ownerDocument;
  const win = doc.defaultView;
  const abort = new AbortController();
  const listeners = { signal: abort.signal };
  const reducedMotion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = win.matchMedia('(pointer: coarse)');
  const find = action => shell.querySelector(`[data-fs-${action}]`);
  const toggle = find('toggle');
  const motion = find('motion');
  const panel = find('panel');
  const detail = find('detail');
  const close = find('close');
  const back = find('back');
  const profile = find('person');
  const feedList = find('feed');
  const scroll = find('scroll');
  const empty = find('empty');
  const status = find('status');
  const retry = find('retry');
  const login = find('login');
  const form = find('compose');
  const input = form.elements.message;
  const send = find('send');
  const feature = find('feature');
  const lanes = [...find('lanes').children];
  const seen = new Set();
  const seenFeatured = new Set();
  const queue = [];
  let items = new Map();
  let feedKey = '';
  let hasBoard = false;
  let newestAt = 0;
  let isOpen = false;
  let detailId = null;
  let detailTrigger;
  let enabled = true;
  let disposed = false;
  let sending = false;
  let composing = false;
  let notice = '';
  let featureTimer;
  let stillTimer;
  let authenticated = false;

  function isReady() {
    return stage.dataset.state === 'ready' && !stage.hasAttribute('data-bench-phase');
  }

  function canShowBarrage() {
    return isReady() && enabled && !isOpen && !detailId && !doc.hidden;
  }

  function avatar(person) {
    return ctx.portrait?.(person?.profile ?? {}, 'factory-social-portrait') ?? '<span class="factory-social-portrait" aria-hidden="true"></span>';
  }

  function personButton(event, transient = false) {
    const name = personName(event.from);
    return `<button type="button" class="factory-social-avatar" data-fs-event="${escape(event.id)}"${transient ? ' tabindex="-1"' : ''} aria-label="查看${escape(name)}的资料">${avatar(event.from)}</button>`;
  }

  function eventText(event) {
    if (event.type !== 'gift') return event.text ?? '';
    const gift = giftData(event)?.name ?? '工坊礼物';
    return `送出${gift}${event.to ? `给${personName(event.to)}` : ''}`;
  }

  function eventTime(event) {
    const time = timestamp(event);
    return Number.isFinite(time) ? clock.format(new Date(time)) : '';
  }

  function giftImage(event) {
    const asset = giftData(event)?.asset;
    if (!asset) return '';
    const name = asset.replace(/\.webp$/, '');
    const src = ctx.asset?.(name) ?? `./assets/${encodeURIComponent(name)}.webp`;
    return `<img class="factory-social-gift" src="${escape(src)}" alt="" width="24" height="24">`;
  }

  function renderFeed(feed) {
    const key = feed.map(event => event.id).join('|');
    if (feedKey === key) return;
    feedKey = key;
    const focusedId = doc.activeElement?.dataset.fsEvent;
    const hadFocus = feedList.contains(doc.activeElement);
    const pinned = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= 30;
    feedList.innerHTML = feed.map(event => `<li class="factory-social-record">
      ${personButton(event)}<div><header><strong>${escape(personName(event.from))}</strong>${event.featured ? '<span>上电视</span>' : ''}<time>${escape(eventTime(event))}</time></header>
      <p>${giftImage(event)}${escape(eventText(event))}</p></div>
    </li>`).join('');
    if (pinned) scroll.scrollTop = scroll.scrollHeight;
    if (hadFocus) {
      const focus = [...feedList.querySelectorAll('[data-fs-event]')].find(button => button.dataset.fsEvent === focusedId);
      (focus ?? scroll).focus({ preventScroll: true });
    }
  }

  function remember(set, id) {
    set.add(id);
    if (set.size > SEEN_LIMIT) set.delete(set.values().next().value);
  }

  function clearMotion() {
    win.clearTimeout(stillTimer);
    queue.length = 0;
    for (const lane of lanes) lane.replaceChildren();
  }

  function flush() {
    if (!canShowBarrage() || !queue.length) return;
    const count = reducedMotion.matches || stage.clientWidth < 550 ? 1 : stage.clientWidth < 820 ? 2 : 3;
    for (const lane of lanes.slice(0, count)) {
      if (lane.firstChild || !queue.length || lane.clientWidth === 0) continue;
      const event = queue.shift();
      const node = doc.createElement('div');
      node.className = 'factory-social-bullet';
      node.innerHTML = `${personButton(event, true)}<strong>${escape(personName(event.from))}</strong>${giftImage(event)}<span>${escape(eventText(event))}</span>`;
      lane.append(node);
      const remove = () => {
        node.remove();
        flush();
      };
      if (reducedMotion.matches) {
        node.dataset.still = '';
        stillTimer = win.setTimeout(remove, 4800);
      } else {
        node.style.setProperty('--fs-travel', `${lane.clientWidth}px`);
        node.style.setProperty('--fs-duration', `${Math.min(15, Math.max(6, (lane.clientWidth + node.offsetWidth) / 87))}s`);
        node.addEventListener('animationend', remove, { once: true });
      }
    }
  }

  function showFeature(event) {
    win.clearTimeout(featureTimer);
    feature.innerHTML = `<span class="factory-social-onair">上电视</span>${personButton(event, true)}${giftImage(event)}
      <div class="factory-social-feature-copy"><strong>${escape(giftData(event)?.name ?? '工坊礼物')}</strong>
      <span><b>${escape(personName(event.from))} </b>${event.to ? `送给${escape(personName(event.to))}` : '已送出'}</span></div>`;
    feature.hidden = false;
    featureTimer = win.setTimeout(() => {
      feature.hidden = true;
      feature.replaceChildren();
    }, 7600);
  }

  function errorText(error) {
    return typeof error === 'string' ? error : error?.message || '';
  }

  function sync() {
    if (disposed) return;
    const { board, busy, error, authenticated: signedIn } = social.snapshot();
    authenticated = Boolean(signedIn);
    shell.dataset.connected = String(Boolean(board && !error));
    const feed = Array.isArray(board?.feed) ? board.feed : [];
    const featured = Array.isArray(board?.featured) ? board.featured : board?.featured ? [board.featured] : [];
    items = new Map([...feed, ...featured].map(event => [String(event.id), event]));
    if (board) {
      const arrivals = feed.filter(event => !seen.has(event.id) && (!Number.isFinite(timestamp(event)) || timestamp(event) >= newestAt));
      if (hasBoard && canShowBarrage()) {
        queue.push(...arrivals.filter(event => !event.featured).slice(-QUEUE_LIMIT));
        if (queue.length > QUEUE_LIMIT) queue.splice(0, queue.length - QUEUE_LIMIT);
        flush();
      }
      for (const event of feed) {
        remember(seen, event.id);
        if (Number.isFinite(timestamp(event))) newestAt = Math.max(newestAt, timestamp(event));
      }
      const candidates = [...featured, ...arrivals.filter(event => event.featured)].filter(event => !seenFeatured.has(event.id));
      if (candidates.length) {
        const last = candidates.reduce((best, event) => timestamp(event) >= timestamp(best) ? event : best);
        if (canShowBarrage() && (hasBoard || Date.now() - timestamp(last) < 18000)) showFeature(last);
        for (const event of candidates) remember(seenFeatured, event.id);
      }
      hasBoard = true;
    }
    renderFeed(feed.slice(-FEED_LIMIT));
    empty.hidden = feed.length > 0;
    empty.textContent = board ? '还没有世界消息。' : error ? '世界消息暂未加载。' : '正在读取世界消息…';
    login.hidden = authenticated;
    form.hidden = !authenticated;
    retry.hidden = !error || busy;
    send.disabled = busy || sending || !input.value.trim();
    send.textContent = sending ? '发送中' : '发送';
    const message = errorText(error) || notice;
    if (status.textContent !== message) status.textContent = message;
  }

  function unlock() {
    if (stage.contains(doc.pointerLockElement)) doc.exitPointerLock?.();
  }

  function syncPanels() {
    panel.hidden = !isOpen || Boolean(detailId);
    detail.hidden = !detailId;
    toggle.hidden = isOpen || Boolean(detailId);
    toggle.setAttribute('aria-expanded', String(isOpen));
    shell.dataset.open = String(isOpen || Boolean(detailId));
  }

  function closePanel() {
    isOpen = false;
    detailId = null;
    syncPanels();
    toggle.focus({ preventScroll: true });
  }

  function showPerson(button) {
    const event = items.get(button.dataset.fsEvent);
    if (!event) return;
    const person = event.from;
    const group = WORK_GROUPS[person?.profile?.group];
    detailId = String(event.id);
    detailTrigger = button;
    profile.innerHTML = `<div class="factory-social-person">${avatar(person)}<div><strong>${escape(personName(person))}</strong>
      ${group ? `<small>${escape(group)}</small>` : ''}</div></div>
      <p class="factory-social-person-message">${giftImage(event)}${escape(eventText(event))}</p>
      ${eventTime(event) ? `<time>${escape(eventTime(event))}</time>` : ''}`;
    unlock();
    syncPanels();
    back.focus({ preventScroll: true });
    clearMotion();
  }

  function closePerson() {
    detailId = null;
    syncPanels();
    const focus = detailTrigger?.isConnected && !detailTrigger.closest('[hidden]') ? detailTrigger : isOpen ? scroll : toggle;
    focus.focus({ preventScroll: true });
    detailTrigger = null;
  }

  function syncStage() {
    if (isReady()) return;
    clearMotion();
    isOpen = false;
    detailId = null;
    detailTrigger = null;
    syncPanels();
  }

  const observer = new win.MutationObserver(syncStage);
  observer.observe(stage, { attributes: true, attributeFilter: ['data-state', 'data-bench-phase'] });
  reducedMotion.addEventListener('change', clearMotion, listeners);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) clearMotion(); }, listeners);
  shell.addEventListener('click', event => {
    const element = event.target.closest('button, a');
    if (!element) return;
    if (element === toggle) {
      isOpen = true;
      unlock();
      clearMotion();
      syncPanels();
      scroll.scrollTop = scroll.scrollHeight;
      const focus = authenticated ? (coarsePointer.matches ? scroll : input) : login;
      focus.focus();
      if (!hasBoard) void refresh();
    } else if (element === close) closePanel();
    else if (element === back) closePerson();
    else if (element === motion) {
      enabled = !enabled;
      motion.setAttribute('aria-pressed', String(enabled));
      if (!enabled) clearMotion();
    } else if (element === retry) void refresh();
    else if (element === login) {
      event.preventDefault();
      unlock();
      ctx.go('account');
    } else if (element.hasAttribute('data-fs-event')) showPerson(element);
  }, listeners);
  shell.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.isComposing || (!isOpen && !detailId)) return;
    event.preventDefault();
    event.stopPropagation();
    if (detailId) closePerson();
    else closePanel();
  }, listeners);
  input.addEventListener('input', () => { notice = ''; sync(); }, listeners);
  input.addEventListener('compositionstart', () => { composing = true; }, listeners);
  input.addEventListener('compositionend', () => { composing = false; }, listeners);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || composing || sending || !authenticated || social.snapshot().busy) return;
    sending = true;
    notice = '';
    sync();
    try {
      const result = await social.message(text);
      if (disposed) return;
      if (result === false || result?.ok === false) notice = result?.message || errorText(social.snapshot().error) || '消息未发送，请重试。';
      else {
        if (input.value.trim() === text) input.value = '';
        notice = '已发送';
      }
    } catch (error) {
      notice = errorText(error) || '消息未发送，请重试。';
    } finally {
      sending = false;
      sync();
      if (!disposed && isOpen && !detailId && authenticated &&
          (form.contains(doc.activeElement) || doc.activeElement === doc.body)) input.focus({ preventScroll: true });
    }
  }, listeners);

  async function refresh() {
    try { await social.refresh(); }
    catch (error) { notice = errorText(error) || '无法读取世界消息。'; }
    sync();
  }

  const unsubscribe = social.subscribe(sync);
  sync();
  syncStage();
  if (!hasBoard) void refresh();
  return () => {
    disposed = true;
    abort.abort();
    observer.disconnect();
    unsubscribe();
    win.clearTimeout(featureTimer);
    clearMotion();
  };
}
