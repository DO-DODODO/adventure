// DOM rendering: turns `state` into HTML. No game-logic decisions here.

const SLOT_LEFT = [13.0, 31.3, 49.8, 68.3, 86.8]; // must match board.png's 5 slot centers
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

const CARD_BACK_URL = 'img/card-back.png';

function cardUrl(card) {
  return `img/cards/${card.color}-${card.label}.png`;
}

function cardEl(card, sizeClass, extraAttrs) {
  return `<div class="card ${sizeClass}" data-color="${card.color}" data-label="${card.label}" style="background-image:url('${cardUrl(card)}')" ${extraAttrs || ''}></div>`;
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
  const existing = [...lane.querySelectorAll('.card.held')];
  const sameSet = existing.length === state.myHand.length &&
    existing.every((el, i) => el.dataset.color === state.myHand[i].color && el.dataset.label === state.myHand[i].label);

  if (sameSet) {
    // hand contents/order unchanged (e.g. just a select/deselect click) --
    // toggle classes in place instead of tearing down and rebuilding every
    // card, which was causing the whole hand to visibly flash each time.
    existing.forEach((el, i) => el.classList.toggle('selected', i === state.selectedIndex));
    return;
  }

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

// Targeted re-renders for a single place/draw action, so an action by one
// side doesn't rebuild (and visually flicker) DOM the other side owns.
function renderPlaceResult(who, action) {
  if (who === 'me') renderMyHand(); else renderOppHand();
  if (action === 'discard') renderBoard();
  else renderTableau(who === 'me' ? 'my-tableau' : 'opp-tableau', who === 'me' ? state.myTableau : state.oppTableau, who === 'me' ? 'true' : 'false');
  layoutTableauColumns();
  clearHighlights();
}

function renderDrawResult(who) {
  if (who === 'me') renderMyHand(); else renderOppHand();
  renderBoard();
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
    if (color === state.justDiscardedColor) continue; // can't take back what I just discarded this turn
    if (state.discards[color].length > 0) {
      const slot = document.querySelector(`.discard-slot[data-color="${color}"]`);
      if (slot) slot.classList.add('hl');
    }
  }
}

// Animates a flying clone card from fromRect to toRect. If startFace !==
// endFace, plays a pseudo-3D flip (scaleX pinch + image swap) at the
// midpoint. Resolves once the clone has been removed.
function flyCard({ fromRect, toRect, frontUrl, backUrl, startFace, endFace, duration }) {
  const dur = duration || 380;
  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;
  const sx = toRect.width / fromRect.width;
  const sy = toRect.height / fromRect.height;
  const flips = startFace !== endFace;

  const clone = document.createElement('div');
  clone.className = 'card flying';
  clone.style.backgroundImage = `url('${startFace === 'front' ? frontUrl : backUrl}')`;
  clone.style.left = fromRect.left + 'px';
  clone.style.top = fromRect.top + 'px';
  clone.style.width = fromRect.width + 'px';
  clone.style.height = fromRect.height + 'px';
  document.body.appendChild(clone);

  return new Promise((resolve) => {
    if (!flips) {
      const anim = clone.animate(
        [{ transform: 'translate(0,0) scale(1,1)' }, { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }],
        { duration: dur, easing: 'ease' }
      );
      anim.onfinish = () => { clone.remove(); resolve(); };
    } else {
      const midX = dx / 2, midY = dy / 2, midSx = sx / 2 + 0.5, midSy = sy / 2 + 0.5;
      const anim1 = clone.animate(
        [
          { transform: 'translate(0,0) scale(1,1)' },
          { transform: `translate(${midX}px,${midY}px) scale(0.02,${midSy})` },
        ],
        { duration: dur / 2, easing: 'ease-in' }
      );
      anim1.onfinish = () => {
        clone.style.backgroundImage = `url('${endFace === 'front' ? frontUrl : backUrl}')`;
        const anim2 = clone.animate(
          [
            { transform: `translate(${midX}px,${midY}px) scale(0.02,${midSy})` },
            { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` },
          ],
          { duration: dur / 2, easing: 'ease-out' }
        );
        anim2.onfinish = () => { clone.remove(); resolve(); };
      };
    }
  });
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
