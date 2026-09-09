// Card data + deck construction/shuffling. No UI code here.

const COLORS = ['sun', 'water', 'fire', 'leaf', 'moon'];
const LABELS = ['X', 'X', 'X', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function cardValue(card) {
  return card.label === 'X' ? 0 : parseInt(card.label, 10);
}

function makeDeck() {
  const deck = [];
  for (const color of COLORS) {
    for (const label of LABELS) {
      deck.push({ color, label });
    }
  }
  return deck;
}

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
