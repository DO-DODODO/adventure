// AI decisions, following AI_STRATEGY.md. Pure functions: given the current
// state, return a decision object. The caller (main.js) is responsible for
// actually mutating state and animating it.

function isCommitted(hand, color, tableauLen) {
  // already played a card of this color: the expedition is locked in
  // regardless of what's left in hand, there's no backing out.
  if (tableauLen > 0) return true;
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
    if (!isCommitted(hand, color, state.oppTableau[color].length)) continue;
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

// true if any expedition is underway and not yet maxed out at 10 -- i.e.
// there's still real work left to do this round.
function hasOngoingExpedition(oppTableau) {
  return COLORS.some((color) => {
    const pile = oppTableau[color];
    if (pile.length === 0) return false;
    const highest = highestNumberInPile(pile);
    return highest === null || highest < 10;
  });
}

// Decide where to draw from, after the play above has already happened.
// Returns { source: 'deck' } or { source: 'discard', color }
function aiChooseDraw(state) {
  // collect every discard pile that's actually worth taking (committed
  // color, not the one just discarded this turn, and the top card can
  // still legally be placed), then prefer whichever expedition is
  // furthest along -- not just the first match in COLORS order, so an
  // obviously good pickup (e.g. a 10 on a pile already at 9) doesn't
  // lose out to an earlier color that's merely also valid.
  let best = null;
  for (const color of COLORS) {
    if (color === state.justDiscardedColor) continue; // can't take back what it just discarded this turn
    const pile = state.discards[color];
    if (pile.length === 0) continue;
    const topCard = pile[pile.length - 1];
    if (!canPlaceOnTableau(state.oppTableau[color], topCard.label)) continue; // dead card, can never be played
    if (!isCommitted(state.oppHand, color, state.oppTableau[color].length)) continue;
    const highest = highestNumberInPile(state.oppTableau[color]) || 0;
    if (!best || highest > best.highest) best = { color, highest };
  }
  if (best) return { source: 'discard', color: best.color };

  // nothing committed to grab, but the round still has real work left --
  // pull any safe (non-dead) card off the board instead of the deck, so
  // the shared deck (and the round) doesn't run out faster than it needs to.
  if (hasOngoingExpedition(state.oppTableau)) {
    for (const color of COLORS) {
      if (color === state.justDiscardedColor) continue;
      const pile = state.discards[color];
      if (pile.length === 0) continue;
      const topCard = pile[pile.length - 1];
      if (!canPlaceOnTableau(state.oppTableau[color], topCard.label)) continue;
      return { source: 'discard', color };
    }
  }

  return { source: 'deck' };
}
