// AI decisions, following AI_STRATEGY.md. Pure functions: given the current
// state, return a decision object. The caller (main.js) is responsible for
// actually mutating state and animating it.

// at most this many colors are ever started at once -- spreading thinner
// than this means more expeditions sitting at a loss than the AI can
// realistically pull back into profit before the round ends.
const MAX_ACTIVE_EXPEDITIONS = 3;

// once the deck gets this low, there may not be enough draws left to turn
// a fresh "statistical bet" expedition into a profitable one.
const DECK_LOW_THRESHOLD = 20;

// how many colors the AI has already started (and so is locked into).
function activeExpeditionCount(oppTableau) {
  return COLORS.filter((color) => oppTableau[color].length > 0).length;
}

function isCommitted(hand, color, tableauLen, deckLength) {
  // already played a card of this color: the expedition is locked in
  // regardless of what's left in hand, there's no backing out.
  if (tableauLen > 0) return true;
  const cardsOfColor = hand.filter((c) => c.color === color);
  const sum = cardsOfColor
    .filter((c) => c.label !== 'X')
    .reduce((s, c) => s + parseInt(c.label, 10), 0);
  if (sum > 20) return true; // already a guaranteed profit, deck state irrelevant
  // late in the round, don't start a *new* expedition on the strength of a
  // statistical bet alone -- there may not be enough draws left to make the
  // held numbers add up to anything.
  if (deckLength <= DECK_LOW_THRESHOLD) return false;
  // 3+ cards alone isn't enough -- worthless X-heavy hands (e.g. three X's,
  // sum 0) were reading as "committed" just from card count. Require the
  // held numbers to actually add up to something before banking on more.
  return cardsOfColor.length >= 3 && sum >= 10;
}

// a not-yet-started color is "promising" if the hand is already partway to
// meeting isCommitted's own bar -- worth keeping hold of even when a card
// of that color would otherwise look like a free, safe discard.
function isPromisingCandidate(hand, oppTableau, color) {
  if (oppTableau[color].length > 0) return false; // already committed, not this function's concern
  if (activeExpeditionCount(oppTableau) >= MAX_ACTIVE_EXPEDITIONS) return false; // capped out, no point protecting it
  const ofColor = hand.filter((c) => c.color === color);
  if (ofColor.length < 2) return false;
  const sum = ofColor
    .filter((c) => c.label !== 'X')
    .reduce((s, c) => s + parseInt(c.label, 10), 0);
  return sum >= 6;
}

// Decide which card to play and where (tableau or discard).
// Returns { card, action: 'tableau' | 'discard' }
function aiChoosePlay(state) {
  const hand = state.oppHand;

  // gather every committed color that has something playable right now,
  // instead of stopping at the first match in fixed COLORS order.
  const candidates = [];
  const activeCount = activeExpeditionCount(state.oppTableau);
  for (const color of COLORS) {
    const tableauLen = state.oppTableau[color].length;
    // don't open a new expedition once MAX_ACTIVE_EXPEDITIONS are already
    // running -- already-started colors (tableauLen > 0) are unaffected,
    // there's no backing out of those anyway.
    if (tableauLen === 0 && activeCount >= MAX_ACTIVE_EXPEDITIONS) continue;
    if (!isCommitted(hand, color, tableauLen, state.deck.length)) continue;
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
    for (const { color, ofColor, playable } of candidates) {
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
      // only X is playable here and there's no confidence yet -- don't
      // amplify a possible loss. Skip this color and try the next
      // candidate, or fall through to discard if none are left.
    }
  }

  // Nothing committed is playable -- discard. Priority: a card the human
  // (myTableau) can no longer use, then -- only once the deck is running
  // low, since early on this isn't a real signal -- a color the human
  // hasn't started, then just our own lowest-value card.
  for (const card of hand) {
    const humanHighest = highestNumberInPile(state.myTableau[card.color]);
    if (humanHighest !== null && cardValue(card) <= humanHighest) {
      // safe from the human, but not necessarily worthless to us -- don't
      // throw away a card that's still helping this color edge toward its
      // own commitment bar.
      if (isPromisingCandidate(hand, state.oppTableau, card.color)) continue;
      return { card, action: 'discard' };
    }
  }
  if (state.deck.length <= DECK_LOW_THRESHOLD) {
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
  const activeCount = activeExpeditionCount(state.oppTableau);
  for (const color of COLORS) {
    if (color === state.justDiscardedColor) continue; // can't take back what it just discarded this turn
    const pile = state.discards[color];
    if (pile.length === 0) continue;
    const topCard = pile[pile.length - 1];
    if (!canPlaceOnTableau(state.oppTableau[color], topCard.label)) continue; // dead card, can never be played
    const tableauLen = state.oppTableau[color].length;
    if (tableauLen === 0 && activeCount >= MAX_ACTIVE_EXPEDITIONS) continue; // capped out, don't open a new one
    if (!isCommitted(state.oppHand, color, tableauLen, state.deck.length)) continue;
    const highest = highestNumberInPile(state.oppTableau[color]) || 0;
    if (!best || highest > best.highest) best = { color, highest };
  }
  if (best) return { source: 'discard', color: best.color };

  // nothing committed to grab, but the round still has real work left --
  // pull a safe (non-dead) card off the board instead of the deck, so the
  // shared deck (and the round) doesn't run out faster than it needs to.
  // Only for colors already held in hand, though -- grabbing a color with
  // zero existing stake in it isn't "delaying," it's just noise. And not
  // for a color that's capped out anyway -- there'd be nowhere to ever
  // play it, so it'd just sit dead in hand.
  if (hasOngoingExpedition(state.oppTableau)) {
    for (const color of COLORS) {
      if (color === state.justDiscardedColor) continue;
      if (!state.oppHand.some((c) => c.color === color)) continue;
      const tableauLen = state.oppTableau[color].length;
      if (tableauLen === 0 && activeCount >= MAX_ACTIVE_EXPEDITIONS) continue;
      const pile = state.discards[color];
      if (pile.length === 0) continue;
      const topCard = pile[pile.length - 1];
      if (!canPlaceOnTableau(state.oppTableau[color], topCard.label)) continue;
      return { source: 'discard', color };
    }
  }

  return { source: 'deck' };
}
