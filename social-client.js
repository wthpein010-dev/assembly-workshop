const giftKey = 'assembly-workshop.social-gift.v1';
const pollInterval = 5000;

function getGiftRequest(signature) {
  try {
    const pending = JSON.parse(sessionStorage.getItem(giftKey));
    if (pending?.signature === signature && typeof pending.id === 'string') return pending.id;
  } catch { /* Storage is optional for the current transaction. */ }
  const id = crypto.randomUUID();
  try { sessionStorage.setItem(giftKey, JSON.stringify({ signature, id })); } catch { /* Keep this request in memory. */ }
  return id;
}

function clearGiftRequest(id) {
  try {
    if (JSON.parse(sessionStorage.getItem(giftKey))?.id === id) sessionStorage.removeItem(giftKey);
  } catch { /* This browser does not retain the pending request. */ }
}

export function makeSocial(cloud) {
  const listeners = new Set();
  let activeAccount = cloud.meta()?.id ?? '';
  let view = { board: null, error: '', busy: false, authenticated: Boolean(activeAccount) };
  let poll;
  let reading;
  let writing;
  let revision = 0;

  function publish(fields) {
    view = { ...view, ...fields };
    for (const listener of listeners) listener(view);
  }

  function syncIdentity() {
    const account = cloud.meta()?.id ?? '';
    if (activeAccount === account) return false;
    activeAccount = account;
    revision++;
    reading = undefined;
    publish({ board: null, error: '', authenticated: Boolean(account) });
    return true;
  }

  function refresh() {
    syncIdentity();
    if (reading || writing) return reading ?? Promise.resolve(view.board);
    const started = revision;
    reading = cloud.social().then(board => {
      if (started === revision) publish({ board, error: '' });
      return board;
    }).catch(error => {
      if (started === revision) publish({ error: error.message });
      return null;
    }).finally(() => { if (started === revision) reading = undefined; });
    return reading;
  }

  function wake() {
    if (!document.hidden && listeners.size) void refresh();
  }

  function subscribe(listener) {
    syncIdentity();
    listeners.add(listener);
    listener(view);
    if (!poll) {
      poll = setInterval(wake, pollInterval);
      document.addEventListener('visibilitychange', wake);
      wake();
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size) return;
      clearInterval(poll);
      poll = undefined;
      document.removeEventListener('visibilitychange', wake);
    };
  }

  async function send(kind, data) {
    syncIdentity();
    if (!activeAccount) throw new Error('请先在角色页连接游玩码。');
    if (writing) throw new Error('上一条操作正在处理。');
    const account = activeAccount;
    const isGift = kind === 'gift';
    const requestId = isGift ? getGiftRequest(`${account}/${data.target}/${data.giftId}`) : crypto.randomUUID();
    revision++;
    reading = undefined;
    writing = kind;
    publish({ busy: true });
    try {
      const board = await (isGift ? cloud.socialGift({ ...data, requestId }) : cloud.socialMessage({ ...data, requestId }));
      if (isGift) clearGiftRequest(requestId);
      if (account === activeAccount) {
        const publicBoard = { ...board };
        delete publicBoard.save;
        publish({ board: publicBoard, error: '' });
      }
      return board;
    } catch (error) {
      if (isGift && error.status && error.status < 500) clearGiftRequest(requestId);
      throw error;
    } finally {
      writing = undefined;
      publish({ busy: false });
      if (account !== activeAccount) wake();
    }
  }

  return {
    snapshot: () => view,
    subscribe, refresh,
    identityChanged() { if (syncIdentity()) wake(); },
    giftPending: () => writing === 'gift',
    message: text => send('message', { text }),
    gift: (target, giftId) => send('gift', { target, giftId }),
  };
}
