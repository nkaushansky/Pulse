/* ---------------- persistence (V2 §5) ----------------
   One versioned localStorage key, managed only by this module.
   Storage may be unavailable (private browsing) or the blob corrupt:
   SAVE never throws past this file and the game stays fully playable
   with session-only state. Blob contents: per-song bests + settings,
   nothing else. */
const SAVE_KEY = 'pulse.save.v1';

const SAVE = (() => {
  const blank = () => ({ version:1, songs:{}, settings:{} });

  let store = null;
  try {
    const probe = SAVE_KEY + '.probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    store = window.localStorage;
  } catch (e){ store = null; }

  let data = blank();
  if (store){
    try {
      const parsed = JSON.parse(store.getItem(SAVE_KEY));
      if (parsed && parsed.version === 1 &&
          parsed.songs && typeof parsed.songs === 'object' &&
          parsed.settings && typeof parsed.settings === 'object'){
        data = parsed;
      }
    } catch (e){ /* corrupt blob: start fresh */ }
  }

  function write(){
    if (!store) return;
    try { store.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e){}
  }

  return {
    persistent: !!store,
    /* run: {score, grade, acc}; keeps the highest-scoring run per song.
       Returns the stored best plus isNew for "fresh record" feedback. */
    recordResult(songId, run){
      const prev = data.songs[songId];
      const isNew = !prev || run.score > prev.score;
      if (isNew){
        data.songs[songId] = { score:run.score, grade:run.grade, acc:run.acc };
        write();
      }
      const best = data.songs[songId];
      return { score:best.score, grade:best.grade, acc:best.acc, isNew };
    },
    getBest(songId){ return data.songs[songId] || null; },
    getSetting(name, fallback){
      return Object.prototype.hasOwnProperty.call(data.settings, name)
        ? data.settings[name] : fallback;
    },
    setSetting(name, value){
      data.settings[name] = value;
      write();
    }
  };
})();
