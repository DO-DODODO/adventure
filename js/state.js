// Central game state + setup/transition helpers (no DOM here).

function emptyTableau() {
  const t = {};
  for (const c of COLORS) t[c] = [];
  return t;
}
function emptyDiscards() {
  const d = {};
  for (const c of COLORS) d[c] = [];
  return d;
}

const state = {
  screen: 'menu', // menu | loading | game | score
  deck: [],
  discards: emptyDiscards(),
  myHand: [],
  oppHand: [],
  myTableau: emptyTableau(),
  oppTableau: emptyTableau(),
  turn: 'me', // 'me' | 'opp'
  firstPlayer: null, // who starts the CURRENT round
  lastWinner: null, // who won the previous round (decides next round's firstPlayer)
  selectedIndex: null, // index into myHand of the currently-lifted card
  phase: 'idle', // idle | placed (waiting on draw)
  pendingCard: null, // the card just played, waiting to be replaced by a draw
  myCharacterIndex: 0,
  oppCharacterIndex: null, // fixed once per session (assigned at first game start)
  lastScore: null,
};

function startNewRound() {
  state.deck = shuffle(makeDeck());
  state.discards = emptyDiscards();
  state.myTableau = emptyTableau();
  state.oppTableau = emptyTableau();
  state.myHand = state.deck.splice(0, 8);
  state.oppHand = state.deck.splice(0, 8);
  state.selectedIndex = null;
  state.phase = 'idle';
  state.pendingCard = null;

  if (state.firstPlayer === null) {
    state.firstPlayer = Math.random() < 0.5 ? 'me' : 'opp';
  }
  state.turn = state.firstPlayer;

  if (state.oppCharacterIndex === null) {
    // random opponent avatar, distinct from the player's own, fixed for the session
    const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
      (i) => i !== state.myCharacterIndex
    );
    state.oppCharacterIndex = pool[Math.floor(Math.random() * pool.length)];
  }
}

function isDeckEmpty() {
  return state.deck.length === 0;
}
