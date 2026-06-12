/* ---------------- persistence (V2 §5) ----------------
   One versioned localStorage key, managed only by this module.
   Storage may be unavailable (private browsing) or the blob corrupt:
   SAVE never throws past this file and the game stays fully playable
   with session-only state. Blob contents: per-song top-5 score lists
   + settings, nothing else. */
const SAVE_KEY = 'pulse.save.v1';
const SAVE_MAX_SCORES = 5;

const SAVE = (() => {
  const blank = () => ({ version:1, songs:{}, settings:{} });
  const validRun = (r) => r && typeof r.score === 'number';

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
        for (const id of Object.keys(data.songs)){
          const e = data.songs[id];   // pre-top-5 blobs stored a single run
          data.songs[id] = (Array.isArray(e) ? e : [e])
            .filter(validRun).slice(0, SAVE_MAX_SCORES);
        }
      }
    } catch (e){ /* corrupt blob: start fresh */ }
  }

  function write(){
    if (!store) return;
    try { store.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e){}
  }

  return {
    persistent: !!store,
    /* run: {score, grade, acc}; keeps the top SAVE_MAX_SCORES runs per
       song, ties broken in favor of the older run. Returns the stored
       list plus this run's rank in it (-1 if it didn't place). */
    recordResult(songId, run){
      const list = data.songs[songId] || (data.songs[songId] = []);
      let rank = list.findIndex(s => run.score > s.score);
      if (rank === -1) rank = list.length;
      if (rank >= SAVE_MAX_SCORES){
        rank = -1;
      } else {
        list.splice(rank, 0, { score:run.score, grade:run.grade, acc:run.acc });
        if (list.length > SAVE_MAX_SCORES) list.length = SAVE_MAX_SCORES;
        write();
      }
      return { scores:list.slice(), rank };
    },
    getBest(songId){
      const list = data.songs[songId];
      return (list && list.length) ? list[0] : null;
    },
    getScores(songId){ return (data.songs[songId] || []).slice(); },
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
