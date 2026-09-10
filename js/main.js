// Screen flow + event wiring + turn orchestration.

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------- menu ----------------
document.getElementById('btn-single').addEventListener('click', startSingleModeFromMenu);

async function startSingleModeFromMenu() {
  // deal the round and show the game board FIRST, so it's already visible
  // behind the hourglass overlay while it plays -- not a blank screen.
  startNewRound();
  showScreen('game');
  renderGame();
  layoutMyHand();
  layoutTableauColumns();
  document.getElementById('screen-loading').classList.add('active');
  await wait(1100); // lets the hourglass animation play once
  document.getElementById('screen-loading').classList.remove('active');
  await afterTurnChange();
}

// ---------------- my turn: card select / place / draw ----------------
// guards against a fast double-tap firing a second place/draw before the
// first one's flight animation finishes (was leaving a card's element
// stuck at visibility:hidden from an interrupted/overlapping animation)
let uiBusy = false;

document.getElementById('my-hand-lane').addEventListener('click', (e) => {
  if (uiBusy) return;
  const cardEl = e.target.closest('.card.held');
  if (!cardEl) return;
  if (state.turn !== 'me' || state.phase !== 'idle') return;
  const i = parseInt(cardEl.dataset.handIndex, 10);
  if (state.selectedIndex === i) {
    state.selectedIndex = null;
    renderMyHand();
    clearHighlights();
  } else {
    state.selectedIndex = i;
    renderMyHand();
    highlightPlacementTargets(state.myHand[i]);
  }
});

document.getElementById('table').addEventListener('click', async (e) => {
  if (uiBusy) return;
  if (state.turn !== 'me') return;

  if (state.phase === 'idle' && state.selectedIndex !== null) {
    const target = e.target.closest('.hl');
    if (!target) return;
    const card = state.myHand[state.selectedIndex];
    uiBusy = true;
    try {
      if (target.classList.contains('discard-slot')) {
        await placeCard('me', card, state.selectedIndex, 'discard', target.dataset.color);
      } else if (target.classList.contains('col')) {
        await placeCard('me', card, state.selectedIndex, 'tableau', target.dataset.color);
      }
    } finally {
      uiBusy = false;
    }
    return;
  }

  if (state.phase === 'placed') {
    const drawPile = e.target.closest('.draw-pile.hl');
    const slot = e.target.closest('.discard-slot.hl');
    if (!drawPile && !slot) return;
    uiBusy = true;
    try {
      if (drawPile) await drawCard('me', 'deck');
      else await drawCard('me', 'discard', slot.dataset.color);
    } finally {
      uiBusy = false;
    }
  }
});

async function placeCard(who, card, handIndex, action, color) {
  const hand = who === 'me' ? state.myHand : state.oppHand;

  const sourceSelector = who === 'me'
    ? `#my-hand-lane .card.held:nth-child(${handIndex + 1})`
    : `#opp-hand-lane .card.back:nth-child(${handIndex + 1})`;
  const fromRect = document.querySelector(sourceSelector).getBoundingClientRect();

  hand.splice(handIndex, 1);
  if (action === 'discard') state.discards[color].push(card);
  else (who === 'me' ? state.myTableau : state.oppTableau)[color].push(card);

  state.justDiscardedColor = action === 'discard' ? color : null;
  state.selectedIndex = null;
  state.phase = 'placed';
  renderPlaceResult(who, action);

  const destSelector = action === 'discard'
    ? `.discard-slot[data-color="${color}"] .card`
    : `.col[data-color="${color}"][data-mine="${who === 'me'}"] .card.tab:last-child`;
  const destEl = document.querySelector(destSelector);
  const toRect = destEl.getBoundingClientRect();
  destEl.style.visibility = 'hidden';

  const startFace = who === 'me' ? 'front' : 'back';
  await flyCard({
    fromRect, toRect,
    frontUrl: cardUrl(card), backUrl: CARD_BACK_URL,
    startFace, endFace: 'front',
  });
  destEl.style.visibility = '';

  if (who === 'me') highlightDrawTargets();
}

async function drawCard(who, source, color) {
  const hand = who === 'me' ? state.myHand : state.oppHand;
  const card = source === 'deck'
    ? state.deck[state.deck.length - 1]
    : state.discards[color][state.discards[color].length - 1];

  const sourceSelector = source === 'deck' ? '#draw-pile .card.back' : `.discard-slot[data-color="${color}"] .card`;
  const fromRect = document.querySelector(sourceSelector).getBoundingClientRect();

  if (source === 'deck') state.deck.pop();
  else state.discards[color].pop();
  hand.push(card);
  sortHand(hand);
  state.phase = 'idle';
  renderDrawResult(who);

  const destSelector = who === 'me'
    ? `#my-hand-lane .card.held[data-color="${card.color}"][data-label="${card.label}"]`
    : '#opp-hand-lane .card.back:last-child';
  const destEl = document.querySelector(destSelector);
  const toRect = destEl.getBoundingClientRect();
  destEl.style.visibility = 'hidden';

  // face logic: a card already visible on the discard pile stays visible
  // in flight; a deck card is unknown/hidden the whole way for the
  // opponent but gets revealed mid-flight for the player drawing it.
  const wasVisible = source === 'discard';
  const willBeVisible = who === 'me';
  const startFace = wasVisible ? 'front' : 'back';
  const endFace = willBeVisible ? 'front' : 'back';

  await flyCard({
    fromRect, toRect,
    frontUrl: cardUrl(card), backUrl: CARD_BACK_URL,
    startFace, endFace,
  });
  destEl.style.visibility = '';

  await finishTurn();
}

async function finishTurn() {
  if (isDeckEmpty()) {
    // let the last card's landed state be visible for a beat instead of
    // cutting straight to the score screen the instant it arrives
    await wait(800);
    endRound();
    return;
  }
  state.turn = state.turn === 'me' ? 'opp' : 'me';
  await afterTurnChange();
}

async function afterTurnChange() {
  renderAvatars();
  if (state.turn === 'opp') {
    await runAiTurn();
  }
}

// ---------------- AI turn ----------------
async function runAiTurn() {
  await wait(900); // "thinking" pause so the turn-highlight is visible first

  const play = aiChoosePlay(state);
  const handIndex = state.oppHand.indexOf(play.card);
  await placeCard('opp', play.card, handIndex, play.action, play.card.color);
  await wait(650); // beat to register what was played before drawing

  const draw = aiChooseDraw(state);
  if (draw.source === 'deck') await drawCard('opp', 'deck');
  else await drawCard('opp', 'discard', draw.color);
}

// ---------------- round end / score ----------------
function endRound() {
  const mine = scoreTableau(state.myTableau);
  const opp = scoreTableau(state.oppTableau);
  state.lastScore = mine;
  state.lastWinner = mine.total === opp.total ? (Math.random() < 0.5 ? 'me' : 'opp')
    : (mine.total > opp.total ? 'me' : 'opp');
  state.firstPlayer = state.lastWinner;

  renderScore({ myByColor: mine.byColor, myTotal: mine.total, oppByColor: opp.byColor, oppTotal: opp.total });
  showScreen('score');
}

document.getElementById('btn-again').addEventListener('click', async () => {
  startNewRound();
  showScreen('game');
  renderGame();
  layoutMyHand();
  layoutTableauColumns();
  document.getElementById('screen-loading').classList.add('active');
  await wait(900);
  document.getElementById('screen-loading').classList.remove('active');
  await afterTurnChange();
});

document.getElementById('btn-quit').addEventListener('click', () => {
  state.firstPlayer = null;
  state.oppCharacterIndex = null;
  showScreen('menu');
});

window.addEventListener('resize', () => {
  if (document.getElementById('screen-game').classList.contains('active')) {
    layoutMyHand();
    layoutTableauColumns();
  }
});
