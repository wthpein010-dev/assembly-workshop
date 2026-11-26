import { RECOVERY_PARTS, RECOVERY_RECIPES } from './factory-recovery.js';

const parts = Object.values(RECOVERY_PARTS);
const recipes = Object.values(RECOVERY_RECIPES);
const glyphs = { memory: 'RAM', drive: 'SSD', harness: '线束', fan: '风扇', sensor: '感应', controller: '控制' };

const phases = {
  idle: '巡逻中', telegraph: '预警中 · 退出危险区', vulnerable: '核心暴露 · 现在打断',
  recoil: '受击 · 等待再次破绽', disabled: '已击停 · 拾取掉落',
};
const warnings = { sweep: '横摆预警 · 侧移避开', scan: '环扫预警 · 退出范围', dash: '冲程预警 · 离开直线' };

export function recoveryRecipeFor(benchId) {
  return recipes.find(recipe => recipe.bench === benchId);
}

function partArt(part, ctx) {
  const escape = ctx.escape;
  const color = typeof part.color === 'number' ? `#${part.color.toString(16).padStart(6, '0')}` : part.color;
  return `<span class="recovery-part-art" aria-hidden="true" style="--part-tint:${escape(color)}">${part.asset
    ? `<img src="${escape(ctx.asset(part.asset))}" alt="" draggable="false" loading="lazy">`
    : escape(glyphs[part.id])}</span>`;
}

export function recoveryCatalog(progress, ctx) {
  const escape = ctx.escape;
  const completed = recipes.filter(recipe => recipe.parts.every(id => progress.installed.includes(id))).length;
  return `<div class="recovery-directory-heading"><h3>零件回收</h3><strong>${progress.collected.length} / ${parts.length}</strong></div>
    <p class="recovery-instructions">沿通道找零件，或击停故障机器人拾取掉落。</p>
    <ul class="recovery-part-list">${parts.map(part => {
      const stored = progress.collected.includes(part.id);
      const installed = progress.installed.includes(part.id);
      return `<li class="recovery-part-row" data-recovery-entry="${part.id}">
        ${partArt(part, ctx)}<div><strong>${escape(part.name)}</strong><small>${escape(part.source ?? part.description)}</small></div>
        ${stored ? `<span class="recovery-part-mark" data-recovery-owned="${part.id}">${installed ? '已安装' : '已回收'}</span>`
          : `<button type="button" class="btn btn-secondary recovery-compact" data-recovery-guide="${part.id}" aria-label="前往${escape(part.name)}所在区域">前往</button>`}
      </li>`;
    }).join('')}</ul>
    <div class="recovery-directory-heading recovery-project-heading"><h3>组装项目</h3><strong>${completed} / ${recipes.length}</strong></div>
    <div class="recovery-projects">${recipes.map(recipe => {
      const installed = recipe.parts.filter(id => progress.installed.includes(id)).length;
      return `<button type="button" class="btn btn-secondary recovery-project" data-recovery-build="${recipe.id}"><span>${escape(recipe.name)}</span><small>${installed === recipe.parts.length ? '已启动' : `${installed} / ${recipe.parts.length} 已安装`}</small></button>`;
    }).join('')}</div>`;
}

export function recoveryAssembly(recipe, progress, selected, message, ctx) {
  const escape = ctx.escape;
  const available = recipe.parts.filter(id => progress.collected.includes(id) && !progress.installed.includes(id));
  const installed = recipe.parts.filter(id => progress.installed.includes(id)).length;
  const complete = installed === recipe.parts.length;
  return `<div class="recovery-assembly-head"><div><h3>${escape(recipe.name)}</h3><p>${complete ? '模块运行中' : '把回收的零件装进对应插槽。'}</p></div><strong>${installed} / ${recipe.parts.length}</strong></div>
    <p class="recovery-label" id="recovery-inventory-label">已回收零件</p>
    ${available.length ? `<div class="recovery-inventory" role="group" aria-labelledby="recovery-inventory-label">${available.map(id => {
      const part = RECOVERY_PARTS[id];
      return `<button type="button" class="recovery-piece" data-recovery-part="${id}" aria-pressed="${id === selected}" draggable="true">${partArt(part, ctx)}<span>${escape(part.name)}</span></button>`;
    }).join('')}</div>` : `<p class="recovery-empty">${complete ? '所需配件已全部安装。' : '先到厂区回收这里需要的零件。'}</p>`}
    <p class="recovery-label" id="recovery-slots-label">设备插槽</p>
    <div class="recovery-inventory recovery-slots" role="group" aria-labelledby="recovery-slots-label">${recipe.parts.map(id => {
      const part = RECOVERY_PARTS[id];
      const done = progress.installed.includes(id);
      return `<button type="button" class="recovery-piece recovery-slot" data-recovery-slot="${id}" data-installed="${done}"${done ? ' disabled' : ''}>${partArt(part, ctx)}
        <span>${escape(part.name)}</span><small>${done ? '已安装' : progress.collected.includes(id) ? '待安装' : '待回收'}</small></button>`;
    }).join('')}</div>
    <p class="recovery-assembly-note" role="status" data-tone="${message?.tone ?? 'normal'}" data-recovery-assembly-note>${escape(message?.text ?? (complete ? '设备已点亮，可以回到车间查看。' : '可以拖放，也可以先点零件，再点插槽。'))}</p>`;
}

export function recoveryPhaseLabel(phase, pattern) {
  return (phase === 'telegraph' ? warnings[pattern] : null) ?? phases[phase] ?? '静止';
}

export function recoveryEventText(event) {
  if (!event) return '';
  if (event.type === 'collect') return `已回收 ${RECOVERY_PARTS[event.partId]?.name ?? '零件'}`;
  if (event.type === 'stagger') return '受到干扰，先退出预警范围';
  return {
    hit: '击中核心', disabled: '故障机已停机，靠近拾取掉落', guarded: '外壳已挡下脉冲，等核心暴露',
    miss: '对准故障机并靠近一些', jammed: '脉冲受干扰，稍后再试',
  }[event.outcome] ?? '';
}
