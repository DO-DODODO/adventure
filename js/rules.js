// Placement + scoring rules. Pure functions, no DOM/state mutation.

// pile = array of cards already played in one color's expedition column,
// in the order they were played (oldest first).
function highestNumberInPile(pile) {
  let highest = null;
  for (const c of pile) {
    if (c.label !== 'X') {
      const v = parseInt(c.label, 10);
      if (highest === null || v > highest) highest = v;
    }
  }
  return highest;
}

function canPlaceOnTableau(pile, label) {
  const highest = highestNumberInPile(pile);
  if (label === 'X') return highest === null; // X only before any number
  return highest === null || parseInt(label, 10) > highest;
}

function scoreForPile(pile) {
  if (pile.length === 0) return 0;
  let sum = 0;
  let xCount = 0;
  for (const c of pile) {
    if (c.label === 'X') xCount++;
    else sum += parseInt(c.label, 10);
  }
  return (sum - 20) * (xCount + 1);
}

function scoreTableau(tableau) {
  const byColor = {};
  let total = 0;
  for (const color of COLORS) {
    byColor[color] = scoreForPile(tableau[color]);
    total += byColor[color];
  }
  return { byColor, total };
}
