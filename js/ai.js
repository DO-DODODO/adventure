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
  // 3+ cards alone isn't enough -- worthless X-heavy hands (e.g. three X's,
  // sum 0) were reading as "committed" just from card count. Require the
  // held numbers to actually add up to something before banking on more.
  return sum > 20 || (cardsOfColor.length >= 3 && sum >= 10);
}

// Decide which card to play and where (tableau or discard).
// Returns { card, action: 'tableau' | 'discard' }
function aiChoosePlay(state) {
  const hand = state.oppHand;

  // gather every committed color that has something playable right now,
  // instead of stopping at the first match in fixed COLORS order.
  const candidates = [];
  for (const color of COLORS) {
    if (!isCommitted(hand, color, state.oppTableau[color].length)) continue;
    const ofColor = hand.filter((c) => c.color === color);
    const playable = ofColor.filter((c) => canPlaceOnTableau(state.oppTableau[color], c.label));
    if (playable.length === 0) continue;
    const highest = highestNumberInPile(state.oppTableau[color]) || 0;
    candidates.push({ color, ofColor, playable, highest });
  }

  if (candidates.length > 0) {
    // play into whichever committed expedition is furthest along -- the
    // most advantageous move, not just whichever color comes first.
    candidates.sort((a, b) => b.highest - a.highest);
    const { color, ofColor, playable } = candidates[0];

    // X can only ever be played before any number in that color -- once a
    // number goes down, X is locked out there for the rest of the round.
    // So "confident" (tableau sum so far + same-color numbers still in
    // hand already reaches 20) plays X now to build the multiplier while
    // it's still available; otherwise it's safer to bank a number and
    // not risk amplifying a loss with a multiplier that might not pay off.
    const tableauSum = state.oppTableau[color]
      .filter((c) => c.label !== 'X')
      .reduce((s, c) => s + parseInt(c.label, 10), 0);
    const handSum = ofColor
      .filter((c) => c.label !== 'X')
      .reduce((s, c) => s + parseInt(c.label, 10), 0);
    const confident = tableauSum + handSum >= 20;

    const numbers = playable
      .filter((c) => c.label !== 'X')
      .sort((a, b) => parseInt(a.label, 10) - parseInt(b.label, 10));
    const xCard = playable.find((c) => c.label === 'X');

    if (confident && xCard) return { card: xCard, action: 'tableau' };
    if (numbers.length > 0) return { card: numbers[0], action: 'tableau' };
    return { card: xCard, action: 'tableau' }; // only X is playable here
  }

  // Nothing committed is playable -- discard. Priority: a card the human
  // (myTableau) can no longer use, then -- only once the deck is running
  // low, since early on this isn't a real signal -- a color the human
  // hasn't started, then just our own lowest-value card.
  for (const card of hand) {
    const humanHighest = highestNumberInPile(state.myTableau[card.color]);
    if (humanHighest !== null && cardValue(card) <= humanHighest) {
      return { card, action: 'discard' };
    }
  }
  if (state.deck.length <= 20) {
    for (const card of hand) {
      if (state.myTableau[card.color].length === 0) {
        return { card, action: 'discard' };
      }
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
  // pull a safe (non-dead) card off the board instead of the deck, so the
  // shared deck (and the round) doesn't run out faster than it needs to.
  // Only for colors already held in hand, though -- grabbing a color with
  // zero existing stake in it isn't "delaying," it's just noise.
  if (hasOngoingExpedition(state.oppTableau)) {
    for (const color of COLORS) {
      if (color === state.justDiscardedColor) continue;
      if (!state.oppHand.some((c) => c.color === color)) continue;
      const pile = state.discards[color];
      if (pile.length === 0) continue;
      const topCard = pile[pile.length - 1];
      if (!canPlaceOnTableau(state.oppTableau[color], topCard.label)) continue;
      return { source: 'discard', color };
    }
  }

  return { source: 'deck' };
}
