// zimbohCam — çekilen kareleri (rulo) cihazda saklama (IndexedDB)
const DB = 'zimbohcam', STORE = 'roll';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    let req;
    try { req = indexedDB.open(DB, 1); } catch (e) { rej(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}

function tx(mode, fn) {
  return open().then(db => new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

// Bellek içi yedek (IndexedDB yoksa)
const mem = new Map();
let useMem = false;

export async function addShot(shot) {
  if (!useMem) {
    try { await tx('readwrite', s => { s.put(shot); }); return; } catch { useMem = true; }
  }
  mem.set(shot.id, shot);
}

export async function listShots() {
  if (!useMem) {
    try {
      const all = await tx('readonly', s => new Promise((res, rej) => {
        const r = s.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      }));
      return (all || []).sort((a, b) => b.time - a.time);
    } catch { useMem = true; }
  }
  return [...mem.values()].sort((a, b) => b.time - a.time);
}

export async function updateShot(id, patch) {
  if (!useMem) {
    try {
      await tx('readwrite', s => new Promise((res) => {
        const r = s.get(id);
        r.onsuccess = () => { if (r.result) s.put({ ...r.result, ...patch }); res(); };
      }));
      return;
    } catch { useMem = true; }
  }
  const v = mem.get(id); if (v) mem.set(id, { ...v, ...patch });
}

export async function deleteShots(ids) {
  if (!useMem) {
    try { await tx('readwrite', s => { ids.forEach(id => s.delete(id)); }); return; } catch { useMem = true; }
  }
  ids.forEach(id => mem.delete(id));
}
