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
  afterTurnChange();
}

// ---------------- my turn: card select / place / draw ----------------
document.getElementById('my-hand-lane').addEventListener('click', (e) => {
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

document.getElementById('table').addEventListener('click', (e) => {
  if (state.turn !== 'me') return;

  if (state.phase === 'idle' && state.selectedIndex !== null) {
    const target = e.target.closest('.hl');
    if (!target) return;
    const card = state.myHand[state.selectedIndex];
    if (target.classList.contains('discard-slot')) {
      placeCard('me', card, state.selectedIndex, 'discard', target.dataset.color);
    } else if (target.classList.contains('col')) {
      placeCard('me', card, state.selectedIndex, 'tableau', target.dataset.color);
    }
    return;
  }

  if (state.phase === 'placed') {
    const drawPile = e.target.closest('.draw-pile.hl');
    if (drawPile) { drawCard('me', 'deck'); return; }
    const slot = e.target.closest('.discard-slot.hl');
    if (slot) { drawCard('me', 'discard', slot.dataset.color); return; }
  }
});

function placeCard(who, card, handIndex, action, color) {
  const hand = who === 'me' ? state.myHand : state.oppHand;
  hand.splice(handIndex, 1);
  if (action === 'discard') state.discards[color].push(card);
  else (who === 'me' ? state.myTableau : state.oppTableau)[color].push(card);

  state.selectedIndex = null;
  state.phase = 'placed';
  if (who === 'me') {
    renderGame();
    highlightDrawTargets();
  } else {
    renderGame();
  }
}

function drawCard(who, source, color) {
  const hand = who === 'me' ? state.myHand : state.oppHand;
  let card;
  if (source === 'deck') card = state.deck.pop();
  else card = state.discards[color].pop();
  hand.push(card);
  state.phase = 'idle';
  renderGame();
  finishTurn();
}

function finishTurn() {
  if (isDeckEmpty()) {
    endRound();
    return;
  }
  state.turn = state.turn === 'me' ? 'opp' : 'me';
  afterTurnChange();
}

function afterTurnChange() {
  renderAvatars();
  if (state.turn === 'opp') {
    runAiTurn();
  }
}

// ---------------- AI turn ----------------
async function runAiTurn() {
  await wait(650); // "thinking" pause so the turn-highlight is visible first

  const play = aiChoosePlay(state);
  const handIndex = state.oppHand.indexOf(play.card);
  placeCard('opp', play.card, handIndex, play.action, play.card.color);
  await wait(700);

  const draw = aiChooseDraw(state);
  if (draw.source === 'deck') drawCard('opp', 'deck');
  else drawCard('opp', 'discard', draw.color);
}

// ---------------- round end / score ----------------
function endRound() {
  const mine = scoreTableau(state.myTableau);
  const opp = scoreTableau(state.oppTableau);
  state.lastScore = mine;
  state.lastWinner = mine.total === opp.total ? (Math.random() < 0.5 ? 'me' : 'opp')
    : (mine.total > opp.total ? 'me' : 'opp');
  state.firstPlayer = state.lastWinner;

  renderScore({ byColor: mine.byColor, total: mine.total, oppTotal: opp.total });
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
  afterTurnChange();
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
