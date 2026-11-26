import { newCommunity, shopFriendName, shopFriends, updateCommunity } from './community.js?v=motion1';
import {
  SHOP_CATEGORIES, SHOP_GIFT_NOTES, SHOP_ITEMS, SHOP_ORDER_STATUS, isShopRedeemed, getShopOrders, listShopProducts,
} from './shop-catalog.js';

const sections = { exchange: '逛商城', gift: '送礼', orders: '兑换记录', inbox: '收件箱' };
const sortLabels = { featured: '推荐顺序', 'price-asc': '积分从低到高', 'price-desc': '积分从高到低' };
const filters = { section: null, category: 'all', query: '', sort: 'featured', affordable: false };
const numbers = new Intl.NumberFormat('zh-CN');
const dates = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
let restoreFocus;

function model(ctx) {
  const state = ctx.state();
  const community = state.community ?? newCommunity();
  const requested = filters.section ?? community.shopTab;
  return { state, community, guest: !state.profile, section: Object.hasOwn(sections, requested) ? requested : 'exchange' };
}

function image(ctx, id, { alt = '', loading = 'lazy', fallback = 'shop', className = '', priority = 'auto' } = {}) {
  const e = ctx.escape;
  return `<img${className ? ` class="${className}"` : ''} src="${e(ctx.asset(id || fallback))}" data-shop-fallback="${e(ctx.asset(fallback))}" alt="${e(alt)}" loading="${loading}" decoding="async" fetchpriority="${priority}">`;
}

function price(item) {
  return `<span class="shop-price"><strong>${numbers.format(item.price)}</strong><span>积分</span></span>`;
}

function productButton(item, gifting, label, classes = '') {
  const mainAction = classes.includes('shop-open');
  return `<button type="button" class="${classes}" data-shop-product="${item.id}"${gifting ? ' data-shop-intent="gift"' : ''}
    ${mainAction ? `aria-label="${gifting ? '选作礼物' : '查看详情'} · ${item.name}"` : 'tabindex="-1"'}>${label}</button>`;
}

function productCard(item, ctx, { state, community, guest }, gifting = false) {
  const e = ctx.escape;
  const redeemed = !gifting && isShopRedeemed(community, item.id);
  const badge = redeemed ? '已兑换' : item.kind === 'physical' ? '实物演示' : '';
  const images = image(ctx, item.asset, { alt: item.name, fallback: gifting ? 'gift' : 'shop', priority: 'low' });
  return `<article class="shop-card">
    ${productButton(item, gifting, `${images}${badge ? `<span class="shop-card-state">${badge}</span>` : ''}`, 'shop-card-media')}
    <div class="shop-card-body">
      <p class="shop-card-category">${e(SHOP_CATEGORIES[item.category])}</p>
      <h3>${productButton(item, gifting, e(item.name), 'shop-card-title')}</h3>
      <p class="shop-card-summary">${e(item.summary)}</p>
      <div class="shop-card-footer">${price(item)}${productButton(item, gifting, gifting ? '选作礼物' : '查看详情', 'btn btn-secondary shop-open')}</div>
    </div>
  </article>`;
}

function catalogResults(ctx, data) {
  const result = listShopProducts(filters).filter(item => !filters.affordable || data.guest ||
    (item.price <= data.state.coins && !isShopRedeemed(data.community, item.id)));
  return `<div class="shop-list-heading"><h2>${SHOP_CATEGORIES[filters.category] ?? '全部商品'}</h2><small role="status">${result.length} 件商品</small></div>
    ${result.length ? `<div class="shop-grid">${result.map(item => productCard(item, ctx, data)).join('')}</div>` : `
      <div class="shop-empty"><h3>没有找到符合条件的商品</h3><button type="button" class="btn btn-secondary" data-shop-reset="all">清除筛选</button></div>`}`;
}

function exchange(ctx, data) {
  const e = ctx.escape;
  return `<section class="shop-banner" aria-labelledby="shop-featured-title">
    <div class="shop-banner-copy"><h2 id="shop-featured-title">车间好物</h2><p>从随身保温壶到工友感谢卡，挑一件用积分兑换。</p>
      <button type="button" class="btn btn-primary" data-shop-feature="physical">查看实物奖励</button></div>
    ${image(ctx, 'shop-banner', { loading: 'eager', className: 'shop-banner-art', priority: 'high' })}
  </section>
  <section class="shop-shelf" id="shop-shelf" aria-label="积分商品">
    <div class="shop-toolbar">
      <form class="shop-search" data-shop-search role="search"><label class="sr-only" for="shop-query">搜索商品</label>
        <input type="search" id="shop-query" name="query" value="${e(filters.query)}" placeholder="搜索商品，例如保温杯、徽章" maxlength="60">
        <button type="submit" class="btn btn-secondary">搜索</button>
      </form>
      <label class="shop-sort" for="shop-sort"><span>排序</span><select id="shop-sort" data-shop-sort>${Object.entries(sortLabels).map(([id, label]) => `<option value="${id}"${filters.sort === id ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
      ${data.guest ? '' : `<label class="shop-affordable"><input type="checkbox" data-shop-affordable${filters.affordable ? ' checked' : ''}>只看可兑换</label>`}
    </div>
    <div class="shop-categories" role="group" aria-label="商品分类">${Object.entries({ all: '全部', ...SHOP_CATEGORIES }).map(([id, text]) => `<button type="button" data-shop-category="${id}" aria-pressed="${id === filters.category}">${text}</button>`).join('')}</div>
    <div data-shop-results>${catalogResults(ctx, data)}</div>
  </section>`;
}

function empty(title, detail = '', link = '') {
  return `<div class="shop-empty"><h3>${title}</h3>${detail ? `<p>${detail}</p>` : ''}${link}</div>`;
}

function record(ctx, art, title, detail, meta, action = '') {
  return `<li class="shop-record">
    <div class="shop-record-art">${image(ctx, art, { fallback: 'gift' })}</div>
    <div class="shop-record-main"><h3>${ctx.escape(title)}</h3><p>${ctx.escape(detail)}</p></div>
    <div class="shop-record-meta">${meta}${action}</div>
  </li>`;
}

function gifting(ctx, data) {
  const products = listShopProducts().filter(item => item.giftable);
  const sent = (data.community.gifts ?? []).filter(gift => SHOP_ITEMS[gift.item]);
  return `<section class="shop-pane">
    <div class="shop-pane-intro"><div><h2>送给工友</h2><p>兑换一份虚拟礼物，选一句留言送给示范工友。</p></div><div class="btn-row"><a class="btn btn-primary" href="#social">给玩家送礼</a><a class="btn btn-secondary" href="#${data.guest ? 'create' : 'friends'}">${data.guest ? '创建角色' : '工友名录'}</a></div></div>
    <div class="shop-grid shop-gifts-grid">${products.map(item => productCard(item, ctx, data, true)).join('')}</div>
    <h2>送礼记录</h2>
    ${sent.length ? `<ul class="shop-records">${sent.map(gift => {
      const item = SHOP_ITEMS[gift.item];
      return record(ctx, item.asset, item.name, `送给${shopFriendName(gift.to)}${gift.note ? ' · ' + (SHOP_GIFT_NOTES[gift.note] ?? '') : ''}`, '<span>已送出</span>');
    }).join('')}</ul>` : empty('还没有送礼记录')}
  </section>`;
}

function orders(ctx, data) {
  const history = data.guest ? [] : getShopOrders(data.community);
  return `<section class="shop-pane"><div class="shop-pane-intro"><div><h2>兑换记录</h2><p>虚拟物品兑换后放入背包，实物奖励生成模拟核销记录。</p></div></div>
    ${history.length ? `<ul class="shop-records">${history.map(order => {
      const item = SHOP_ITEMS[order.item];
      if (!item) return '';
      const date = Number.isFinite(order.createdAt) && order.createdAt > 0 ? dates.format(order.createdAt) : '';
      const detail = order.kind === 'physical' ? '实物奖励 · 模拟核销' : SHOP_CATEGORIES[item.category];
      return record(ctx, item.asset, item.name, date ? `${detail} · ${date}` : detail,
        `<span>${ctx.escape(SHOP_ORDER_STATUS[order.status] ?? '已兑换')}</span>${Number.isFinite(order.spent) ? `<strong>${numbers.format(order.spent)} 积分</strong>` : ''}`);
    }).join('')}</ul>` : empty('还没有兑换记录', '', '<button type="button" class="btn btn-secondary" data-shop-section="exchange">去逛商城</button>')}
  </section>`;
}

function inbox(ctx, data) {
  const messages = data.guest ? [] : (data.community.inbox ?? []);
  return `<section class="shop-pane"><div class="shop-pane-intro"><div><h2>工友来信</h2><p>这里收取工友礼物和回信。</p></div></div>
    ${messages.length ? `<ul class="shop-records">${messages.map(entry => {
      const item = entry.item && SHOP_ITEMS[entry.item];
      return record(ctx, item?.asset, item?.name ?? '工友回信', `${shopFriendName(entry.by)} · ${entry.text}`, '',
        `<button type="button" class="btn btn-secondary" data-shop-inbox="${ctx.escape(entry.id)}">${item ? '领取礼物' : '标为已读'}</button>`);
    }).join('')}</ul>` : empty('暂无未读来信')}
  </section>`;
}

function sectionBody(ctx, data) {
  const body = { exchange, gift: gifting, orders, inbox }[data.section];
  return body(ctx, data);
}

export function shopPage(ctx) {
  const data = model(ctx);
  return `<section class="container shop-page" data-shop-page aria-labelledby="shop-title">
    <header class="shop-top"><div class="shop-heading"><h1 id="shop-title">积分兑换店</h1></div>
      ${data.guest ? '<a class="btn btn-secondary" href="#create">创建角色</a>' : `<div class="shop-balance"><span>可用工坊积分</span><strong>${numbers.format(data.state.coins)}</strong></div>`}</header>
    <div class="shop-nav" data-shop-nav role="group" aria-label="积分店栏目">${Object.entries(sections).map(([id, label]) => {
      const unread = id === 'inbox' && !data.guest ? data.community.inbox?.length : 0;
      return `<button type="button" data-shop-section="${id}" aria-pressed="${id === data.section}">${label}${unread ? ` <small>${unread}</small>` : ''}</button>`;
    }).join('')}${data.guest ? '' : '<button type="button" class="btn btn-secondary shop-bag-link" data-shop-bag="bag">我的背包</button>'}</div>
    <div data-shop-content>${sectionBody(ctx, data)}</div>
    <dialog class="shop-dialog" data-shop-dialog aria-labelledby="shop-dialog-title"></dialog>
  </section>`;
}

function entryStatus(item, data) {
  if (data.guest) return '';
  if (isShopRedeemed(data.community, item.id)) return '已兑换';
  const remaining = item.price - data.state.coins;
  return remaining > 0 ? `还差 ${numbers.format(remaining)} 积分` : '';
}

function dialogActions(item, ctx, data, step) {
  if (data.guest) return '<a class="btn btn-primary" href="#create">创建角色后兑换</a>';
  const status = entryStatus(item, data);
  if (step === 'confirm') return `<div class="shop-confirm"><strong>使用 ${numbers.format(item.price)} 积分兑换</strong>
      <p>兑换后剩余 ${numbers.format(data.state.coins - item.price)} 积分。</p></div>
      <button type="button" class="btn btn-primary" data-shop-buy>确认兑换</button><button type="button" class="btn btn-secondary" data-shop-dialog-step="detail">返回详情</button>`;
  if (step === 'gift') {
    const friends = shopFriends(data.community);
    if (!friends.length) return `<p>添加一位示范工友后即可送礼。</p><a class="btn btn-primary" href="#friends">添加工友</a>`;
    const remaining = data.state.coins - item.price;
    return `<form data-shop-gift-form class="shop-message-options"><label for="shop-gift-friend">送给</label>
      <select name="to" id="shop-gift-friend" required>${friends.map(({ id, name }) => `<option value="${ctx.escape(id)}">${ctx.escape(name)}</option>`).join('')}</select>
      <label for="shop-gift-note">留言</label><select name="note" id="shop-gift-note"><option value="">不附留言</option>${Object.entries(SHOP_GIFT_NOTES).map(([id, label]) => `<option value="${id}">${ctx.escape(label)}</option>`).join('')}</select>
      <button class="btn btn-primary" type="submit"${remaining < 0 ? ' disabled' : ''}>${remaining < 0 ? '积分不足' : `送出礼物 · ${numbers.format(item.price)} 积分`}</button></form>`;
  }
  return `<button type="button" class="btn btn-primary" data-shop-dialog-step="confirm"${status ? ' disabled' : ''}>${status || '兑换这件'}</button>
    ${item.giftable ? '<button type="button" class="btn btn-secondary" data-shop-dialog-step="gift">送给工友</button>' : ''}`;
}

function dialogContent(item, ctx, data, step) {
  const e = ctx.escape;
  const physical = item.kind === 'physical';
  const where = physical ? '生成模拟核销记录' : '兑换后放入我的背包';
  return `<div class="shop-dialog-shell">
    <button type="button" class="shop-dialog-close" data-shop-close aria-label="关闭商品详情">×</button>
    <div class="shop-dialog-media">${image(ctx, item.asset, { alt: item.name, loading: 'eager' })}</div>
    <div class="shop-dialog-body"><p class="shop-card-category">${e(SHOP_CATEGORIES[item.category])}</p>
      <h2 id="shop-dialog-title" tabindex="-1">${e(item.name)}</h2><p>${e(item.details)}</p>
      <dl class="shop-detail-facts"><div><dt>兑换所需</dt><dd>${price(item)}</dd></div><div><dt>领取方式</dt><dd>${where}</dd></div></dl>
      <div class="shop-dialog-actions">${dialogActions(item, ctx, data, step)}</div>
      <p class="shop-dialog-feedback" data-shop-error role="alert"></p>
    </div>
  </div>`;
}

export function bindShop(root, ctx) {
  const shop = root.querySelector('[data-shop-page]');
  if (!shop) return;
  const nav = shop.querySelector('[data-shop-nav]');
  const content = shop.querySelector('[data-shop-content]');
  const dialog = shop.querySelector('[data-shop-dialog]');
  let currentItem;
  let opener;

  function refreshResults() {
    const data = model(ctx);
    const results = shop.querySelector('[data-shop-results]');
    results.innerHTML = catalogResults(ctx, data);
    for (const button of shop.querySelectorAll('[data-shop-category]')) {
      button.setAttribute('aria-pressed', String(button.dataset.shopCategory === filters.category));
    }
  }

  function showSection(section) {
    filters.section = section;
    const data = model(ctx);
    content.innerHTML = sectionBody(ctx, data);
    for (const button of nav.querySelectorAll('[data-shop-section]')) {
      button.setAttribute('aria-pressed', String(button.dataset.shopSection === section));
    }
    nav.querySelector(`[data-shop-section="${section}"]`)?.focus({ preventScroll: true });
  }

  function showDialog(item, step, source) {
    const data = model(ctx);
    currentItem = item;
    if (source) opener = source;
    dialog.innerHTML = dialogContent(item, ctx, data, step);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('#shop-dialog-title').focus({ preventScroll: true });
  }

  function transact(action, value, focus) {
    const state = ctx.state();
    if (!state.profile) return;
    if ((action === 'buy' || action === 'send-gift') && ctx.social?.giftPending()) {
      const message = '社交送礼正在结算，请稍后再试。';
      if (dialog.open) dialog.querySelector('[data-shop-error]').textContent = message;
      else ctx.toast(message);
      return;
    }
    const next = { community: structuredClone(state.community), coins: state.coins, xp: state.xp };
    const result = updateCommunity(next, action, value);
    if (!result.ok) {
      if (dialog.open) dialog.querySelector('[data-shop-error]').textContent = result.message;
      else ctx.toast(result.message);
      return;
    }
    if (dialog.open) dialog.close();
    restoreFocus = focus;
    ctx.commit(target => Object.assign(target, next));
    if (result.message) ctx.toast(result.message);
    if (action === 'honor-tab') ctx.go('honor');
  }

  function scrollToShelf() {
    shop.querySelector('#shop-shelf').scrollIntoView({ block: 'start' });
  }

  shop.addEventListener('error', event => {
    const img = event.target;
    const fallback = img.dataset?.shopFallback;
    if (!fallback) return;
    delete img.dataset.shopFallback;
    if (img.getAttribute('src') !== fallback) img.src = fallback;
  }, true);
  shop.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.shopSection) showSection(button.dataset.shopSection);
    else if (button.dataset.shopCategory) {
      filters.category = button.dataset.shopCategory;
      refreshResults();
    } else if (button.dataset.shopFeature) {
      filters.category = button.dataset.shopFeature;
      filters.query = '';
      filters.affordable = false;
      showSection('exchange');
      scrollToShelf();
      shop.querySelector('[data-shop-category="physical"]').focus({ preventScroll: true });
    } else if (button.dataset.shopReset) {
      filters.query = '';
      filters.category = 'all';
      filters.affordable = false;
      shop.querySelector('#shop-query').value = '';
      const affordable = shop.querySelector('[data-shop-affordable]');
      if (affordable) affordable.checked = false;
      refreshResults();
      shop.querySelector('#shop-query').focus({ preventScroll: true });
    } else if (button.dataset.shopProduct) {
      showDialog(SHOP_ITEMS[button.dataset.shopProduct], button.dataset.shopIntent ?? 'detail', button);
    } else if (button.dataset.shopDialogStep) showDialog(currentItem, button.dataset.shopDialogStep);
    else if ('shopClose' in button.dataset) dialog.close();
    else if ('shopBuy' in button.dataset) transact('buy', currentItem.id, `.shop-open[data-shop-product="${currentItem.id}"]`);
    else if (button.dataset.shopInbox) transact('accept-gift', button.dataset.shopInbox, '[data-shop-section="inbox"]');
    else if (button.dataset.shopBag) transact('honor-tab', button.dataset.shopBag);
  });
  shop.addEventListener('input', event => {
    if (event.target.id !== 'shop-query' || event.isComposing) return;
    filters.query = event.target.value.trim();
    refreshResults();
  });
  shop.addEventListener('change', event => {
    if ('shopSort' in event.target.dataset) filters.sort = event.target.value;
    else if ('shopAffordable' in event.target.dataset) filters.affordable = event.target.checked;
    else return;
    refreshResults();
  });
  shop.addEventListener('submit', event => {
    if (event.target.matches('[data-shop-search]')) {
      event.preventDefault();
      filters.query = event.target.elements.query.value.trim();
      refreshResults();
    } else if (event.target.matches('[data-shop-gift-form]')) {
      event.preventDefault();
      const form = Object.fromEntries(new FormData(event.target));
      transact('send-gift', { ...form, item: currentItem.id }, `.shop-open[data-shop-product="${currentItem.id}"]`);
    }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { opener?.focus({ preventScroll: true }); });

  if (restoreFocus) {
    const target = shop.querySelector(restoreFocus) ?? nav.querySelector('[aria-pressed="true"]');
    target?.focus({ preventScroll: true });
    restoreFocus = undefined;
  }
}
