function gift(id, name, cost, asset, description, featured = false) {
  return Object.freeze({ id, name, cost, asset, description, featured });
}

export const SOCIAL_GIFTS = Object.freeze({
  spark: gift('spark', '工位点赞', 15, 'shop-pin', '给刚帮过你的工友点个赞。'),
  thanks: gift('thanks', '搭把手感谢卡', 40, 'shop-thanks', '送给帮你过了一道工序的伙伴。'),
  coffee: gift('coffee', '交班咖啡', 65, 'shop-cup', '给磨合默契的同班伙伴来一杯。'),
  kit: gift('kit', '零件收纳套组', 120, 'shop-organizer', '送给把工具和记录都收拾得妥当的工友。'),
  spotlight: gift('spotlight', '湾区星光礼盒', 200, 'shop-pack', '送出后在工坊广场和地图里点亮一条电视广播。', true),
  golden: gift('golden', '金翼播报号', 420, 'shop-cheer', '把这份祝贺发到「工坊电视」，让全厂看到。', true),
});
