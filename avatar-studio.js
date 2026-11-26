import { AVATAR_CATEGORIES, PHOTO_OUTPUT_SIZE, PRESET_AVATARS } from './avatar-catalog.js?v=avatarhd1';
import { decodePhoto, paintPhotoCrop, PHOTO_STYLES, renderPhotoAvatar } from './avatar-photo.js?v=avatarhd1';

function avatarLabel(avatar) {
  if (avatar?.kind === 'photo') return '照片生成头像';
  if (avatar?.kind === 'preset') return PRESET_AVATARS[avatar.id]?.label ?? '预设头像';
  return '角色外观';
}

export function avatarStudioMarkup(ctx, { profile, editing = false }) {
  const { portrait, escape } = ctx;
  const { avatar } = profile;
  const mode = avatar?.kind === 'photo' ? 'photo' : 'presets';
  const category = AVATAR_CATEGORIES.find(({ avatars }) => avatars.some(({ id }) => id === avatar?.id))?.id ?? AVATAR_CATEGORIES[0].id;
  const presetGroups = AVATAR_CATEGORIES.map(group => `<div class="avatar-preset-grid" data-avatar-group="${escape(group.id)}"${group.id === category ? '' : ' hidden'}>
    ${group.avatars.map(({ id, label }) => `<button type="button" class="avatar-tile" data-avatar-preset="${escape(id)}" aria-pressed="${avatar?.kind === 'preset' && avatar.id === id}">
      <span class="avatar-tile-art">${portrait({ ...profile, avatar: { kind: 'preset', id } })}</span><span>${escape(label)}</span>
    </button>`).join('')}
  </div>`).join('');
  return `<section class="avatar-studio${editing ? ' avatar-studio-edit' : ''}" data-avatar-studio aria-labelledby="avatar-studio-title">
    <div class="avatar-studio-heading">
      <div><h3 id="avatar-studio-title">头像工坊</h3><p>头像会显示在聊天、排行榜和角色资料里。</p></div>
      <div class="avatar-current">
        <span class="avatar-current-art" data-avatar-current>${portrait(profile)}</span>
        <span><small>当前头像</small><strong data-avatar-current-name aria-live="polite">${escape(avatarLabel(avatar))}</strong></span>
      </div>
    </div>
    <div class="avatar-studio-tabs" role="tablist" aria-label="选择头像方式">
      ${[['presets', '预设头像'], ['photo', '照片生成']].map(([id, label]) =>
        `<button type="button" role="tab" id="avatar-tab-${id}" data-avatar-mode="${id}" aria-controls="avatar-panel-${id}" aria-selected="${mode === id}" tabindex="${mode === id ? 0 : -1}">${label}</button>`).join('')}
    </div>
    <div class="avatar-studio-panel" role="tabpanel" tabindex="0" id="avatar-panel-presets" data-avatar-panel="presets" aria-labelledby="avatar-tab-presets"${mode === 'presets' ? '' : ' hidden'}>
      <div class="avatar-category" role="group" aria-label="预设头像类别">
        ${AVATAR_CATEGORIES.map(({ id, label }) => `<button type="button" data-avatar-category="${escape(id)}" aria-pressed="${id === category}">${escape(label)}</button>`).join('')}
      </div>
      ${presetGroups}
    </div>
    <div class="avatar-studio-panel" role="tabpanel" tabindex="0" id="avatar-panel-photo" data-avatar-panel="photo" aria-labelledby="avatar-tab-photo"${mode === 'photo' ? '' : ' hidden'}>
      <div class="avatar-photo-upload">
        <div>
          <strong>选择一张个人照片</strong>
          <p>原图在本机处理。保存后，工友可看到生成的头像。</p>
          <small>支持 JPG、PNG、WebP、AVIF，最大 16 MB。</small>
        </div>
        <button type="button" class="btn btn-secondary" data-avatar-choose>选择照片</button>
        <input type="file" data-avatar-file accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif" hidden>
      </div>
      <p class="avatar-studio-status" data-avatar-status role="status" hidden></p>
      <div class="avatar-photo-workspace" data-avatar-photo-workspace hidden>
        <div class="avatar-photo-display">
          <div class="avatar-photo-preview">
            <img data-avatar-photo-preview alt="生成头像预览" width="${PHOTO_OUTPUT_SIZE}" height="${PHOTO_OUTPUT_SIZE}" hidden>
            <canvas data-avatar-photo-original role="img" aria-label="原图裁切预览" width="${PHOTO_OUTPUT_SIZE}" height="${PHOTO_OUTPUT_SIZE}" hidden></canvas>
            <span data-avatar-photo-empty>正在生成预览</span>
          </div>
          <div class="avatar-photo-preview-actions">
            <small>${PHOTO_OUTPUT_SIZE} × ${PHOTO_OUTPUT_SIZE}</small>
            <button type="button" class="btn btn-text" data-avatar-photo-compare aria-pressed="false">原图对照</button>
          </div>
        </div>
        <div class="avatar-photo-controls">
          <fieldset class="avatar-photo-styles"><legend>生成风格</legend>
            <div>${PHOTO_STYLES.map(({ id, label }, index) => `<label><input type="radio" name="avatar-photo-style" value="${escape(id)}"${index ? '' : ' checked'}><span>${escape(label)}</span></label>`).join('')}</div>
          </fieldset>
          <div class="avatar-photo-ranges">
            <label><span>缩放</span><input type="range" data-avatar-crop="zoom" min="1" max="3" step=".05" value="1"></label>
            <label><span>左右移动</span><input type="range" data-avatar-crop="x" min="-100" max="100" step="1" value="0"></label>
            <label><span>上下移动</span><input type="range" data-avatar-crop="y" min="-100" max="100" step="1" value="0"></label>
          </div>
          <button type="button" class="btn btn-primary" data-avatar-use-photo disabled>使用生成头像</button>
        </div>
      </div>
    </div>
    <footer class="avatar-studio-footer">
      <button type="button" class="btn btn-text" data-avatar-default${avatar ? '' : ' disabled'}>使用角色外观</button>
    </footer>
  </section>`;
}

export function bindAvatarStudio(root, { profile, onSelect, portrait }) {
  const studio = root.matches('[data-avatar-studio]') ? root : root.querySelector('[data-avatar-studio]');
  if (!studio) return () => {};
  const win = studio.ownerDocument.defaultView;
  const listeners = new AbortController();
  const { signal } = listeners;
  const find = name => studio.querySelector(`[data-avatar-${name}]`);
  const tabs = [...studio.querySelectorAll('[data-avatar-mode]')];
  const panels = [...studio.querySelectorAll('[data-avatar-panel]')];
  const categories = [...studio.querySelectorAll('[data-avatar-category]')];
  const groups = [...studio.querySelectorAll('[data-avatar-group]')];
  const tiles = [...studio.querySelectorAll('[data-avatar-preset]')];
  const ranges = [...studio.querySelectorAll('[data-avatar-crop]')];
  const file = find('file');
  const choose = find('choose');
  const status = find('status');
  const workspace = find('photo-workspace');
  const photoPreview = find('photo-preview');
  const photoOriginal = find('photo-original');
  const comparePhoto = find('photo-compare');
  const photoEmpty = find('photo-empty');
  const usePhoto = find('use-photo');
  const useDefault = find('default');
  let image;
  let generated;
  let current = profile.avatar ?? null;
  let pending = false;
  let upload = 0;
  let previewId = 0;
  let timer;
  let showingOriginal = false;

  function notify(message = '', error = false) {
    status.textContent = message;
    status.hidden = !message;
    status.dataset.error = String(error);
  }

  function switchMode(tab) {
    for (const button of tabs) {
      const active = button === tab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.avatarPanel !== tab.dataset.avatarMode;
  }

  function filterCategory(control) {
    for (const button of categories) button.setAttribute('aria-pressed', String(button === control));
    for (const group of groups) group.hidden = group.dataset.avatarGroup !== control.dataset.avatarCategory;
  }

  function paintSelection() {
    for (const tile of tiles) tile.setAttribute('aria-pressed', String(current?.kind === 'preset' && current.id === tile.dataset.avatarPreset));
    find('current').innerHTML = portrait({ ...profile, avatar: current });
    const name = find('current-name');
    if (name.textContent !== avatarLabel(current)) name.textContent = avatarLabel(current);
    useDefault.disabled = !current;
  }

  function selectAvatar(avatar) {
    current = avatar;
    paintSelection();
    if (avatar?.kind !== 'photo') notify();
    onSelect(avatar);
  }

  function cropSettings() {
    return Object.fromEntries(ranges.map(input => [input.dataset.avatarCrop, input.valueAsNumber]));
  }

  function syncComparison(crop = cropSettings()) {
    photoPreview.hidden = !generated || showingOriginal;
    photoOriginal.hidden = !showingOriginal;
    photoEmpty.hidden = Boolean(generated) || showingOriginal;
    comparePhoto.setAttribute('aria-pressed', String(showingOriginal));
    if (showingOriginal) paintPhotoCrop(photoOriginal.getContext('2d', { alpha: false }), image, crop);
  }

  async function renderPreview(request) {
    const style = studio.querySelector('input[name="avatar-photo-style"]:checked').value;
    const crop = cropSettings();
    try {
      const next = await renderPhotoAvatar(image, { style, ...crop });
      if (request !== previewId || signal.aborted) return;
      generated = next;
      photoPreview.src = generated;
      usePhoto.disabled = false;
      syncComparison(crop);
    } catch (error) {
      if (request !== previewId || signal.aborted) return;
      generated = undefined;
      photoPreview.removeAttribute('src');
      photoEmpty.textContent = '预览生成失败';
      syncComparison(crop);
      notify(error.message || '暂时无法生成头像，请换一张照片。', true);
    }
  }

  function queuePreview() {
    if (!image || pending || signal.aborted) return;
    const request = ++previewId;
    notify();
    usePhoto.disabled = true;
    win.clearTimeout(timer);
    timer = win.setTimeout(() => void renderPreview(request), 60);
  }

  studio.addEventListener('click', event => {
    const control = event.target.closest('button');
    if (!control) return;
    if (control.matches('[data-avatar-mode]')) return switchMode(control);
    if (control.matches('[data-avatar-category]')) return filterCategory(control);
    if (control === choose) return file.click();
    if (control === useDefault) return selectAvatar(null);
    if (control.matches('[data-avatar-preset]')) return selectAvatar({ kind: 'preset', id: control.dataset.avatarPreset });
    if (control === comparePhoto && image) {
      showingOriginal = !showingOriginal;
      syncComparison();
      return;
    }
    if (control !== usePhoto || pending || usePhoto.disabled) return;
    if (!generated) return;
    if (current?.kind !== 'photo' || current.data !== generated) selectAvatar({ kind: 'photo', data: generated });
    notify('已选用这张头像。');
  }, { signal });

  studio.addEventListener('keydown', event => {
    const index = tabs.indexOf(event.target);
    if (index === -1) return;
    const target = { ArrowLeft: (index + tabs.length - 1) % tabs.length, ArrowRight: (index + 1) % tabs.length,
      Home: 0, End: tabs.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    switchMode(tabs[target]);
    tabs[target].focus();
  }, { signal });

  file.addEventListener('change', async () => {
    const selected = file.files[0];
    file.value = '';
    if (!selected) return;
    const request = ++upload;
    previewId++;
    win.clearTimeout(timer);
    pending = true;
    usePhoto.disabled = true;
    notify('正在读取照片…');
    try {
      const next = await decodePhoto(selected);
      if (signal.aborted || request !== upload) {
        next.close();
        return;
      }
      image?.close();
      image = next;
      generated = undefined;
      photoPreview.removeAttribute('src');
      photoEmpty.textContent = '正在生成预览';
      showingOriginal = false;
      for (const range of ranges) range.value = range.defaultValue;
      workspace.hidden = false;
      choose.textContent = '更换照片';
      syncComparison();
      pending = false;
      queuePreview();
    } catch (error) {
      if (!signal.aborted && request === upload) {
        pending = false;
        usePhoto.disabled = !generated;
        notify(error.message || '读取失败，请换一张照片。', true);
      }
    }
  }, { signal });

  studio.addEventListener('input', event => {
    if (event.target.matches('[data-avatar-crop], input[name="avatar-photo-style"]')) queuePreview();
  }, { signal });

  studio.addEventListener('avatar-profile-change', ({ detail }) => {
    if (!detail) return;
    profile = detail;
    current = detail.avatar ?? null;
    paintSelection();
  }, { signal });

  return () => {
    listeners.abort();
    win.clearTimeout(timer);
    image?.close();
    photoPreview.removeAttribute('src');
  };
}
