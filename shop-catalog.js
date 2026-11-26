export const SHOP_CATEGORIES = Object.freeze({
  physical: '实物奖励',
  wearables: '角色装扮',
  desk: '工位物品',
  gifts: '工友礼物',
});

export const SHOP_ORDER_STATUS = Object.freeze({
  pending: '模拟待核销',
  received: '已入背包',
  legacy: '旧存档',
});

export const SHOP_GIFT_NOTES = Object.freeze({
  'thank-you': '谢谢你帮我核对工单。',
  'good-shift': '辛苦了，下个班次见。',
  team: '下次有交接任务，一起练习吧。',
});

const featured = new Set(['pin', 'cap', 'reward-thermos', 'canvas-tote', 'thank-you']);

function product(id, name, category, price, art, summary, details, { equipable = category !== 'physical' } = {}) {
  const [asset, type, icon] = art;
  const kind = category === 'physical' ? 'physical' : 'virtual';
  return Object.freeze({
    id, name, category, kind, price, asset, type, icon, summary, details, note: summary,
    giftable: kind === 'virtual' && price != null, equipable, featured: featured.has(id),
  });
}

const products = [
  product('pin', '扭矩校准章', 'gifts', 60, ['shop-pin', '纪念徽章', '⟐'],
    '纪念每一次有记录的复核。',
    '工坊名片上的纪念徽章，采用扭矩刻度和小齿轮造型。可以自己收藏，也可以赠给演示工友。'),
  product('cap', '夜班安全帽', 'wearables', 100, ['shop-hardhat', '工坊收藏', '◒'],
    '墨绿色帽身，配琥珀反光条。',
    '夜班主题的虚拟收藏。兑换后可在个人荣誉页将名称展示在工坊名片上。'),
  product('thermos', '班组保温杯', 'desk', 80, ['shop-tumbler', '工坊收藏', '▤'],
    '杯身留着工坊的齿轮印记。',
    '适合摆在交接记录旁的虚拟杯子。可以放入背包收藏，或送给一起练习的演示同伴。'),
  product('banner', '稳产先锋', 'gifts', 160, ['shop-cheer', '个人称号', '⚑'],
    '送给按节拍完成交接的工友。',
    '可展示在工坊名片上的个人称号，也可以当作一份班组鼓励送给演示工友。'),
  product('reward-thermos', '工坊保温壶', 'physical', 220, ['shop-thermos', '杯壶用品', '▤'],
    '墨绿杯身配钢质旋盖。',
    '窄身保温壶，方便放进随身包侧袋。旋盖和壶底均为拉丝钢色。'),
  product('lunchbox', '交班便当盒', 'physical', 260, ['shop-lunchbox', '餐盒用品', '▰'],
    '带内部分格的便携餐盒。',
    '扁平盒体带分格，展示主食和配菜分开收纳的结构。外盖搭配简洁的工坊印记。'),
  product('canvas-tote', '工坊帆布袋', 'physical', 150, ['shop-totebag', '随身用品', '▧'],
    '可随手装下记录本和水杯。',
    '简洁帆布袋配宽肩带和工坊图案，展示用于上下班随身收纳的纪念款式。'),
  product('desk-mat', '装配台桌垫', 'physical', 180, ['shop-mousemat', '桌面用品', '▱'],
    '深色垫面配琥珀色包边。',
    '给键盘、鼠标和记录卡留出一块连续的桌面，外沿以窄线收边。'),
  product('screwdriver', '多用螺丝刀组合', 'physical', 320, ['shop-screwdriver', '桌面工具', '⟡'],
    '短柄工具搭配替换批头。',
    '短柄握把搭配多种批头，适合需要频繁切换规格的桌面操作。'),
  product('organizer', '分格零件收纳盒', 'physical', 240, ['shop-organizer', '桌面收纳', '▥'],
    '把常用小件分格放好。',
    '分格收纳盘便于把线夹、短螺丝和标签分开放，展示工位常见的理料方式。'),
  product('bench-lamp', '可调关节工作灯', 'physical', 420, ['shop-lamp', '桌面照明', '◩'],
    '关节灯臂可以改变照射位置。',
    '关节灯臂搭配独立底座，适合记录区和桌边摆放，是实物奖励演示中的高积分款式。'),
  product('field-notebook', '现场记录本', 'physical', 120, ['shop-notebook', '文具用品', '▤'],
    '封面留有班组和日期填写区。',
    '便携记录本可记录读数、复核结论和下一班待办。封面使用装配工单的线框样式。'),
  product('vest', '琥珀反光背心', 'wearables', 180, ['shop-vest', '角色装扮', '▨'],
    '深色工装配琥珀反光线。',
    '双层口袋和反光走线取自工坊角色的设计。可在工坊名片标记为当前装扮。'),
  product('crew-cap', '琥珀帽沿工坊帽', 'wearables', 85, ['shop-cap', '角色装扮', '◒'],
    '墨绿帽身和琥珀色帽沿。',
    '青绿与琥珀配色的虚拟棒球帽，可收藏或在工坊名片上展示。'),
  product('patch', '首件合格臂章', 'wearables', 90, ['shop-pin', '角色装扮', '◇'],
    '把首件复核印章做成臂章。',
    '以检验章和薄荷绿标识为灵感的虚拟臂章，可展示在工坊名片。'),
  product('wristband', '交接值班腕带', 'wearables', 70, ['shop-wristband', '角色装扮', '◌'],
    '标记当前班次的虚拟配饰。',
    '采用班组交接卡的配色和编号，适合与夜班工装组合收藏。'),
  product('figure', '小小装配员', 'desk', 160, ['shop-figure', '工位摆件', '▣'],
    '戴着工具包的桌面摆件。',
    '戴工坊帽、带小工具包的装配员摆件，可作为一件个人工位收藏。'),
  product('clock', '交班节拍钟', 'desk', 110, ['shop-clock', '工位摆件', '◷'],
    '表盘以班次刻线分区。',
    '用刻线表示交班节点的虚拟台钟，适合与记录本和工单主题物品一起收藏。'),
  product('cup', '首件拿铁杯', 'desk', 75, ['shop-cup', '工位摆件', '◡'],
    '印着首件检查章的虚拟杯。',
    '杯身保留首件检查章，是工坊茶歇主题收藏。可展示在工坊名片，也可送给同伴。'),
  product('job-board', '当班工单夹', 'desk', 85, ['shop-clipboard', '工位摆件', '▥'],
    '把当班任务收进一块夹板。',
    '装配区使用的虚拟工单夹，沿用工坊纸卡和琥珀色页签。兑换后可以在背包收藏或展示。'),
  product('thank-you', '搭把手感谢卡', 'gifts', 40, ['shop-thanks', '对话礼物', '✉'],
    '谢一谢帮你解决卡点的工友。',
    '送给指点过你、协助检查过工件的演示同伴。送出时可以选一句预设留言。', { equipable: false }),
  product('blueprint', '装配图纸折页', 'gifts', 55, ['shop-blueprint', '纪念礼物', '◇'],
    '用纸质小图册纪念第一次装配。',
    '由装配轮廓、工位编号和工步图组成的折页，适合送给一起完成第一张工单的演示工友。', { equipable: false }),
  product('gift-box', '交班默契礼包', 'gifts', 130, ['shop-pack', '纪念礼物', '✦'],
    '给多次共同交班的搭档。',
    '有工坊配色的虚拟礼盒，适合送给熟悉的演示搭档。送礼记录留在游戏内，可以回看。', { equipable: false }),
  product('newcomer', '初入工坊', 'gifts', null, ['gift', '纪念徽章', '✦'],
    '导师发来的入门礼。',
    '收到工坊导师的第一封来信时随信附上，可从收件箱领取。'),
  product('handoff', '交接能手', 'gifts', null, ['shop-cheer', '个人称号', '◇'],
    '完成一次传动泵班组交接。',
    '完成班组交接练习后获得的称号，可以展示在工坊名片。'),
  product('season', '工坊同行者', 'gifts', null, ['honor', '个人称号', '❖'],
    '带着班组一起达成本期目标。',
    '完成赛季建设目标时领取的一份个人荣誉。'),
];

export const SHOP_ITEMS = Object.freeze(Object.fromEntries(products.map((item) => [item.id, item])));
export const SHOP_CATALOG = Object.freeze(products.filter((item) => item.price !== null));

const categories = Object.keys(SHOP_CATEGORIES);
const searchable = (product) =>
  [product.name, product.id, product.summary, product.details, product.type, SHOP_CATEGORIES[product.category]].join(' ').normalize('NFKC').toLowerCase();

export function listShopProducts({ category = 'all', query = '', sort = 'featured' } = {}) {
  const terms = String(query ?? '').normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const result = SHOP_CATALOG.filter((item) =>
    (category === 'all' || !categories.includes(category) || item.category === category)
    && (!terms.length || terms.every((term) => searchable(item).includes(term))));
  if (sort === 'price-asc') result.sort((left, right) => left.price - right.price);
  else if (sort === 'price-desc') result.sort((left, right) => right.price - left.price);
  else result.sort((left, right) => Number(right.featured) - Number(left.featured));
  return result;
}

const legacyRewards = new Set(['pin', 'cap', 'thermos', 'banner']);
const knownProduct = (id) => Object.hasOwn(SHOP_ITEMS, id) ? SHOP_ITEMS[id] : null;

export function getShopOrders(community) {
  const records = Array.isArray(community?.shopOrders) ? community.shopOrders : [];
  const owned = Array.isArray(community?.owned) ? community.owned : [];
  const seen = new Set();
  const orders = [];
  for (const record of records) {
    const item = knownProduct(record?.item);
    if (item?.price == null || seen.has(item.id)) continue;
    seen.add(item.id);
    orders.push({
      id: 'exchange-' + item.id, item: item.id, kind: item.kind,
      spent: Number.isSafeInteger(record.spent) && record.spent > 0 ? record.spent : null,
      status: item.kind === 'physical' ? 'pending' : 'received',
      createdAt: Number.isSafeInteger(record.createdAt) && record.createdAt > 0 ? record.createdAt : null,
    });
  }
  for (const id of [...owned].reverse()) {
    if (!legacyRewards.has(id) || seen.has(id)) continue;
    seen.add(id);
    orders.push({ id: 'legacy-' + id, item: id, kind: 'virtual', spent: null, status: 'legacy', createdAt: null });
  }
  return orders;
}

export function isShopRedeemed(community, id) {
  return (Array.isArray(community?.owned) && community.owned.includes(id))
    || getShopOrders(community).some((order) => order.item === id);
}
