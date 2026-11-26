const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
let running;

export function stopPageMotion() {
  running?.skipTransition();
  running = undefined;
  delete root.dataset.uiTransition;
}

export function switchPage(update, { style = 'forward', snapshot = true } = {}) {
  stopPageMotion();
  if (reduceMotion.matches) { update(); return; }
  if (snapshot && document.visibilityState === 'visible' && typeof document.startViewTransition === 'function') {
    root.dataset.uiTransition = style;
    const transition = document.startViewTransition(update);
    running = transition;
    transition.ready.catch(() => {});
    transition.updateCallbackDone.catch(error => console.error(error));
    transition.finished.catch(() => {}).finally(() => {
      if (running !== transition) return;
      running = undefined;
      delete root.dataset.uiTransition;
    });
    return;
  }
  if (update()) {
    const main = document.querySelector('#main');
    if (main) main.dataset.uiEnter = style;
  }
}
