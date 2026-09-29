// Website version of game-data.js.
// All game data (characters, moves, levels) lives in Firebase at /admin.
// Edit it in the Firebase Console: admin/characters/<id>/... and admin/game/solo|multiplayer/...
//
// This file never throws: if Firebase is blocked or offline the quiz still works,
// only the storefront battle is unavailable.

const firebaseConfig = {
  apiKey: "AIzaSyBq5lzgJAY4H_7py32FCSHTnxuwvU-1Ixk",
  authDomain: "storefront-game.firebaseapp.com",
  databaseURL: "https://storefront-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "storefront-game",
  storageBucket: "storefront-game.firebasestorage.app",
  messagingSenderId: "805711728537",
  appId: "1:805711728537:web:9aace7f18cd32020e78d08"
};

const CACHE_KEY = "storefront-game-data";
const LOAD_TIMEOUT_MS = 6000;

export let MOVES = {};
export let CHARACTERS = [];
export let LEVELS = { solo: [], multiplayer: [] };

function sortedList(obj) {
  return Object.entries(obj || {})
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function applyGameData(remote) {
  const moves = {};
  const addMoves = (movesObj) => {
    sortedList(movesObj).forEach(({ order, ...move }) => {
      moves[move.id] = move;
    });
  };

  const characters = sortedList(remote?.characters).map(({ order, moves: characterMoves, ...character }) => {
    addMoves(characterMoves);
    return { ...character, moves: sortedList(characterMoves).map((move) => move.id) };
  });

  const buildLevels = (levelsObj, mode) =>
    Object.entries(levelsObj || {})
      .filter(([, level]) => level && typeof level === "object")
      .sort(([keyA, levelA], [keyB, levelB]) => {
        const orderA = Number(levelA.order ?? Infinity);
        const orderB = Number(levelB.order ?? Infinity);
        if (orderA !== orderB) return orderA < orderB ? -1 : 1;
        return keyA.localeCompare(keyB, undefined, { numeric: true });
      })
      .map(([levelKey, { order, moves: levelMoves, ...level }]) => {
        addMoves(levelMoves);
        return { ...level, moves: sortedList(levelMoves).map((move) => move.id) };
      });

  const levels = {
    solo: buildLevels(remote?.game?.solo),
    multiplayer: buildLevels(remote?.game?.multiplayer)
  };

  if (!characters.length || !levels.solo.length || !levels.multiplayer.length) {
    throw new Error("Game data in Firebase (admin/characters, admin/game) is missing or incomplete.");
  }

  MOVES = Object.freeze(moves);
  CHARACTERS = Object.freeze(characters);
  LEVELS = Object.freeze(levels);
}

async function fetchRemote() {
  const [appMod, databaseMod, authMod, appCheckMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js")
  ]);

  // Separate app name so this doesn't clash with the battle sync app in scripts.js.
  const app = appMod.initializeApp(firebaseConfig, "gameDataLoader");

  if (["localhost", "127.0.0.1"].includes(location.hostname) || location.hostname.startsWith("192.168.")) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  appCheckMod.initializeAppCheck(app, {
    provider: new appCheckMod.ReCaptchaEnterpriseProvider("6LcSsdItAAAAAByIYOLLgdp8E0HdfGOr2SoBjwyU"),
    isTokenAutoRefreshEnabled: true
  });

  await authMod.signInAnonymously(authMod.getAuth(app));

  const snapshot = await databaseMod.get(databaseMod.ref(databaseMod.getDatabase(app), "admin"));
  if (!snapshot.exists()) {
    throw new Error("Nothing found at /admin in Firebase.");
  }
  return snapshot.val();
}

async function loadGameData() {
  try {
    const remote = await Promise.race([
      fetchRemote(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out loading game data.")), LOAD_TIMEOUT_MS))
    ]);
    applyGameData(remote);
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(remote));
    } catch (error) {
      // Cache is optional.
    }
    return;
  } catch (error) {
    console.warn("Could not load game data from Firebase.", error);
  }

  try {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (cached) {
      applyGameData(JSON.parse(cached));
      console.warn("Using cached game data from this device.");
    }
  } catch (error) {
    console.error("No game data available. The storefront battle will not work this session.", error);
  }
}

// Top-level await: scripts.js and shared.js wait here until the data is loaded (max 6s).
await loadGameData();

export function getCharacter(characterId) {
  return CHARACTERS.find((character) => character.id === characterId) || CHARACTERS[0];
}

export function getMove(moveId) {
  return MOVES[moveId] || null;
}

export function getMoves(moveIds) {
  return moveIds.map(getMove).filter(Boolean);
}

export function getLevel(mode, levelIndex) {
  const levels = LEVELS[mode] || LEVELS.solo;
  return levels[Math.min(Math.max(levelIndex, 0), levels.length - 1)];
}

export function getLevelCount(mode) {
  return (LEVELS[mode] || LEVELS.solo).length;
}