// AI decisions, following AI_STRATEGY.md. Pure functions: given the current
// state, return a decision object. The caller (main.js) is responsible for
// actually mutating state and animating it.

function isCommitted(hand, color) {
  const cardsOfColor = hand.filter((c) => c.color === color);
  const sum = cardsOfColor
    .filter((c) => c.label !== 'X')
    .reduce((s, c) => s + parseInt(c.label, 10), 0);
  return sum > 20 || cardsOfColor.length >= 3;
}

// Decide which card to play and where (tableau or discard).
// Returns { card, action: 'tableau' | 'discard' }
function aiChoosePlay(state) {
  const hand = state.oppHand;

  for (const color of COLORS) {
    if (!isCommitted(hand, color)) continue;
    const candidates = hand.filter((c) => c.color === color);
    const playable = candidates.filter((c) =>
      canPlaceOnTableau(state.oppTableau[color], c.label)
    );
    if (playable.length === 0) continue;
    // X first (build the multiplier while it's still committed), otherwise
    // the lowest legal number (keeps future numbers playable longest).
    const xCard = playable.find((c) => c.label === 'X');
    if (xCard) return { card: xCard, action: 'tableau' };
    playable.sort((a, b) => parseInt(a.label, 10) - parseInt(b.label, 10));
    return { card: playable[0], action: 'tableau' };
  }

  // Nothing committed is playable -- discard. Priority: a card the human
  // (myTableau) can no longer use, then a color the human hasn't started,
  // then just our own lowest-value card.
  for (const card of hand) {
    const humanHighest = highestNumberInPile(state.myTableau[card.color]);
    if (humanHighest !== null && cardValue(card) <= humanHighest) {
      return { card, action: 'discard' };
    }
  }
  for (const card of hand) {
    if (state.myTableau[card.color].length === 0) {
      return { card, action: 'discard' };
    }
  }
  const byValue = hand.slice().sort((a, b) => cardValue(a) - cardValue(b));
  return { card: byValue[0], action: 'discard' };
}

// Decide where to draw from, after the play above has already happened.
// Returns { source: 'deck' } or { source: 'discard', color }
function aiChooseDraw(state) {
  for (const color of COLORS) {
    const pile = state.discards[color];
    if (pile.length === 0) continue;
    if (isCommitted(state.oppHand, color)) {
      return { source: 'discard', color };
    }
  }
  return { source: 'deck' };
}
