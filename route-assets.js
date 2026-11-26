const version = 'motion1';
const styles = [
  'training.css', 'community.css', 'community-play.css', 'online-play.css',
  'factory-page.css', 'factory-workbenches.css', 'factory-recovery.css', 'shop.css',
  'california-ui.css', 'social-page.css', 'factory-social.css', 'avatar-studio.css',
  'interaction-effects.css', 'route-motion.css',
];
const sectionAssets = {
  training: ['training.js', 'training.css'],
  community: ['community.js', 'community.css', 'community-play.css'],
  online: [null, 'online-play.css'],
  world: ['factory-page.js', 'factory-page.css', 'factory-workbenches.css', 'factory-recovery.css', 'factory-social.css'],
  shop: ['shop-page.js', 'shop.css'],
  social: ['social-page.js', 'social-page.css'],
  avatar: ['avatar-studio.js', 'avatar-studio.css'],
};

const routes = {
  missions: 'training', station: 'training', record: 'training',
  friends: 'community', team: 'community', help: 'community', honor: 'community', event: 'community',
  online: 'online', world: 'world', shop: 'shop', social: 'social', avatar: 'avatar',
};
const modules = new Map();
const pending = new Map();
const sheets = new Map();
const attempts = new Map();
const styleRank = file => styles.indexOf(file);
const stylesheetName = link => new URL(link.href).pathname.split('/').pop();

function loadStylesheet(file) {
  if (sheets.has(file)) return sheets.get(file);
  const promise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './' + file + '?v=' + version;
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', () => {
      link.remove();
      reject(new Error('无法加载 ' + file));
    }, { once: true });
    const before = [...document.head.querySelectorAll('link[rel="stylesheet"]')]
      .find(other => styleRank(stylesheetName(other)) > styleRank(file));
    document.head.insertBefore(link, before ?? null);
  }).catch(error => { sheets.delete(file); throw error; });
  sheets.set(file, promise);
  return promise;
}

export function sectionForView(view, step = 0) {
  if (view === 'create' && step === 1) return 'avatar';
  return Object.hasOwn(routes, view) ? routes[view] : '';
}

export const sectionReady = section => !section || modules.has(section);
export const loadedSection = section => modules.get(section);

export function loadSection(section) {
  if (sectionReady(section)) return Promise.resolve(loadedSection(section));
  if (pending.has(section)) return pending.get(section);
  const [script, ...css] = sectionAssets[section];
  const attempt = attempts.get(section) ?? 0;
  attempts.set(section, attempt + 1);
  const query = '?v=' + (section === 'world' ? 'robot1' : version) + (attempt ? '&retry=' + attempt : '');
  const entry = script ? import('./' + script + query) : null;
  const promise = Promise.all([entry, ...css.map(loadStylesheet)])
    .then(([module]) => { modules.set(section, module); return module; })
    .finally(() => pending.delete(section));
  pending.set(section, promise);
  return promise;
}
