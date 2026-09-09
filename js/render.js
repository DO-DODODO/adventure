// DOM rendering: turns `state` into HTML. No game-logic decisions here.

const SLOT_LEFT = [13.4, 31.5, 49.7, 67.8, 86.0]; // must match board.png's 5 slot centers
const COLOR_HEX = {
  sun: '#c9852f', water: '#3f7fb0', fire: '#c1462f', leaf: '#4f7a4a', moon: '#7d5fa3',
};
const COLOR_LABEL_KO = {
  sun: '해', water: '물', fire: '불', leaf: '잎', moon: '달',
};

// characters.png sprite geometry (measured once, see project notes)
const CHAR_IMG_W = 1489, CHAR_IMG_H = 666;
const CHAR_COL_BOUNDS = [[0, 280], [300, 283], [601, 283], [904, 281], [1204, 285]];
const CHAR_ROW_BOUNDS = [[0, 293], [367, 299]];
function charStyle(idx) {
  const col = idx % 5, row = Math.floor(idx / 5);
  const [left, w] = CHAR_COL_BOUNDS[col];
  const [top, h] = CHAR_ROW_BOUNDS[row];
  const sizeX = (CHAR_IMG_W / w) * 100, sizeY = (CHAR_IMG_H / h) * 100;
  const posX = (left / (CHAR_IMG_W - w)) * 100, posY = (top / (CHAR_IMG_H - h)) * 100;
  return `background-size:${sizeX.toFixed(3)}% ${sizeY.toFixed(3)}%;background-position:${posX.toFixed(3)}% ${posY.toFixed(3)}%;`;
}

function cardUrl(card) {
  return `img/cards/${card.color}-${card.label}.png`;
}

function cardEl(card, sizeClass, extraAttrs) {
  return `<div class="card ${sizeClass}" style="background-image:url('${cardUrl(card)}')" ${extraAttrs || ''}></div>`;
}

function backEl(sizeClass) {
  return `<div class="card back ${sizeClass}"></div>`;
}

function renderOppHand() {
  const cards = state.oppHand.map(() => backEl('opp-hand')).join('');
  document.getElementById('opp-hand-lane').innerHTML = cards;
  document.getElementById('opp-count').textContent = state.oppHand.length + '장';
}

function renderTableau(containerId, tableau, mine) {
  const el = document.getElementById(containerId);
  el.innerHTML = COLORS.map((color) => {
    const pile = tableau[color];
    const cards = pile.map((c) => cardEl(c, 'tab')).join('');
    return `<div class="col" data-color="${color}" data-mine="${mine}" style="left:${SLOT_LEFT[COLORS.indexOf(color)]}%">${cards}</div>`;
  }).join('');
}

function renderBoard() {
  const wrap = document.getElementById('discard-slots');
  wrap.innerHTML = COLORS.map((color, i) => {
    const pile = state.discards[color];
    const top = pile[pile.length - 1];
    const inner = top ? cardEl(top, '', `style="border-color:${COLOR_HEX[color]};background-image:url('${cardUrl(top)}')"`) : '';
    return `<div class="discard-slot" data-color="${color}" style="left:${SLOT_LEFT[i]}%">${inner}</div>`;
  }).join('');
  document.getElementById('deck-count').textContent = state.deck.length;
}

function renderMyHand() {
  const lane = document.getElementById('my-hand-lane');
  lane.innerHTML = state.myHand
    .map((c, i) => {
      const selected = i === state.selectedIndex ? 'selected' : '';
      return cardEl(c, `held mine-clickable ${selected}`, `data-hand-index="${i}"`);
    })
    .join('');
  layoutMyHand();
}

function layoutMyHand() {
  const lane = document.getElementById('my-hand-lane');
  const cards = [...lane.querySelectorAll('.card.held')];
  if (!cards.length) return;
  const containerW = lane.parentElement.clientWidth;
  const cardW = cards[0].getBoundingClientRect().width;
  const n = cards.length;
  const minReveal = 20;
  let reveal = n > 1 ? (containerW - cardW) / (n - 1) : cardW;
  reveal = Math.max(minReveal, Math.min(cardW, reveal));
  cards.forEach((c, i) => {
    c.style.marginLeft = i === 0 ? '0' : (reveal - cardW) + 'px';
  });
}

function layoutTableauColumns() {
  document.querySelectorAll('.tableau .col').forEach((col) => {
    const cards = col.querySelectorAll('.card.tab');
    if (!cards.length) return;
    const tableau = col.closest('.tableau');
    const containerH = tableau.clientHeight;
    const cardH = cards[0].getBoundingClientRect().height;
    const n = cards.length;
    const minReveal = 16;
    let reveal = n > 1 ? (containerH - cardH) / (n - 1) : cardH;
    reveal = Math.max(minReveal, Math.min(cardH, reveal));
    cards.forEach((c, i) => {
      c.style.marginTop = i === 0 ? '0' : (reveal - cardH) + 'px';
    });
  });
}

function renderAvatars() {
  document.getElementById('opp-avatar').setAttribute('style', charStyle(state.oppCharacterIndex));
  document.getElementById('my-avatar').setAttribute('style', charStyle(state.myCharacterIndex));
  document.getElementById('opp-avatar').classList.toggle('turn', state.turn === 'opp');
  document.getElementById('my-avatar').classList.toggle('turn', state.turn === 'me');
}

function renderGame() {
  renderOppHand();
  renderTableau('opp-tableau', state.oppTableau, 'false');
  renderBoard();
  renderTableau('my-tableau', state.myTableau, 'true');
  renderMyHand();
  renderAvatars();
  layoutTableauColumns();
  clearHighlights();
}

function clearHighlights() {
  document.querySelectorAll('.hl').forEach((el) => el.classList.remove('hl'));
}

function highlightPlacementTargets(card) {
  clearHighlights();
  const discardSlot = document.querySelector(`.discard-slot[data-color="${card.color}"]`);
  if (discardSlot) discardSlot.classList.add('hl');
  if (canPlaceOnTableau(state.myTableau[card.color], card.label)) {
    const col = document.querySelector(`.col[data-mine="true"][data-color="${card.color}"]`);
    if (col) col.classList.add('hl');
  }
}

function highlightDrawTargets() {
  clearHighlights();
  if (state.deck.length > 0) {
    document.getElementById('draw-pile').classList.add('hl');
  }
  for (const color of COLORS) {
    if (state.discards[color].length > 0) {
      const slot = document.querySelector(`.discard-slot[data-color="${color}"]`);
      if (slot) slot.classList.add('hl');
    }
  }
}

function renderScore(result) {
  const rows = COLORS.map((color) => {
    return `<div class="score-row">
      <span class="dot" style="background:${COLOR_HEX[color]}"></span>
      <span class="label">${COLOR_LABEL_KO[color]}</span>
      <span class="val">${result.byColor[color]}</span>
    </div>`;
  }).join('');
  document.getElementById('score-rows').innerHTML = rows;
  document.getElementById('score-total-val').textContent = result.total;
  const oppLabel = result.oppTotal !== undefined ? result.oppTotal : '-';
  document.getElementById('score-subtitle').textContent =
    `상대 총점 ${oppLabel} | ${result.total > result.oppTotal ? '승리!' : result.total < result.oppTotal ? '패배' : '무승부'}`;
}
