'use strict';
/* ================================================================
   FutMon World — RPG de fútbol tipo monster-catcher.
   Un solo archivo, sin dependencias ni build. Ver CLAUDE.md.
   Secciones: helpers · mapa · datos · estado · audio · vistas ·
   render del mundo · movimiento · interacción · batalla ·
   historia · paneles · entrada · arranque.
   ================================================================ */

/* ---------------- Helpers ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const randi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
// Ruido determinista barato: mismo (x,y,s) → mismo valor, para decorar el mapa.
const noise = (x, y, s = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 91.3) * 43758.5453; return n - Math.floor(n); };
// Rectángulo redondeado (compatible con navegadores sin ctx.roundRect).
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
const INK = '#1c2438'; // contorno oscuro estilo cartoon

/* ---------------- Constantes del mundo ---------------- */
const TILE = 48;                 // píxeles por casilla en el canvas
const WORLD = 48;                // casillas por lado del mundo
const VIEW_W = 20, VIEW_H = 11;  // casillas visibles (960×528)
const canvas = $('#world');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

/* ---------------- Generación del mapa ----------------
   Códigos de casilla:
   T árbol/borde · W agua · B puente · R camino · F césped de estadio
   .  hierba llana      G hierba alta (encuentros)
   s  arena llana       S hierba solar alta
   a  suelo de bosque   A hierba de bosque alta
   d  suelo nocturno    D hierba nocturna alta
   H centro médico · M tienda · P cartel · L farola                */
const MAP = Array.from({ length: WORLD }, (_, y) => Array.from({ length: WORLD }, (_, x) => {
  if (x < 2 || y < 2 || x > WORLD - 3 || y > WORLD - 3) return 'T';
  if (x > 35 && y < 18) return noise(x, y) < .4 ? 'S' : 's';   // Ciudad Solar
  if (x < 18 && y > 33) return noise(x, y) < .42 ? 'A' : 'a';  // Bosque Cantera
  if (x > 33 && y > 33) return noise(x, y) < .42 ? 'D' : 'd';  // Distrito Nocturno
  return noise(x, y) < .17 ? 'G' : '.';                        // Villa Cantera
}));
// Río serpenteante de norte a sur, con tres puentes.
for (let y = 2; y < WORLD - 2; y++) { const x = 23 + Math.round(Math.sin(y / 5) * 3); MAP[y][x] = MAP[y][x + 1] = 'W'; }
[12, 28, 40].forEach(y => { const x = 23 + Math.round(Math.sin(y / 5) * 3); for (let i = -1; i < 3; i++) MAP[y][x + i] = 'B'; });
// Caminos principales.
for (let x = 3; x < WORLD - 3; x++) { MAP[9][x] = 'R'; MAP[27][x] = 'R'; }
for (let y = 3; y < WORLD - 3; y++) MAP[y][9] = 'R';
// Estadio Central.
const FIELD = { x0: 32, y0: 20, x1: 44, y1: 28 }; // casillas inclusivas
for (let y = FIELD.y0; y <= FIELD.y1; y++) for (let x = FIELD.x0; x <= FIELD.x1; x++) MAP[y][x] = 'F';
// Edificios y carteles.
[[6, 6, 'H'], [13, 6, 'M'], [39, 12, 'H'], [40, 36, 'M'],
 [11, 13, 'P'], [34, 19, 'P'], [14, 38, 'P'], [43, 14, 'P'], [38, 33, 'P']]
  .forEach(([x, y, t]) => MAP[y][x] = t);
// Farolas dispersas en el Distrito Nocturno.
for (let y = 34; y < WORLD - 3; y++) for (let x = 34; x < WORLD - 3; x++)
  if (MAP[y][x] === 'd' && noise(x, y, 7) > .94) MAP[y][x] = 'L';

const SIGNS = {
  '11,13': 'Villa Cantera — donde nacen las leyendas. Si pierdes un partido, despertarás en el centro médico (cruz roja).',
  '34,19': 'Estadio Central — solo los mejores ojeadores ganan aquí. Rivales de élite.',
  '14,38': 'Bosque Cantera — hogar de cerebros del mediocampo y defensas de hierro.',
  '43,14': 'Ciudad Solar — velocidad y desborde bajo el sol.',
  '38,33': 'Distrito Nocturno — el talento que brilla cuando cae la noche.',
};

const CHESTS = [
  { x: 18, y: 19, reward: { balls: 4 } },
  { x: 35, y: 8,  reward: { coins: 60 } },
  { x: 7,  y: 42, reward: { balls: 3, drinks: 1 } },
  { x: 40, y: 40, reward: { coins: 80, drinks: 1 } },
  { x: 43, y: 16, reward: { balls: 5 } },
  { x: 30, y: 36, reward: { drinks: 2 } },
  { x: 8,  y: 26, reward: { balls: 3 } },
  { x: 44, y: 30, reward: { coins: 50, balls: 2 } },
];

const ALEX = { x: 11, y: 11 };   // ojeador amigo
const SOMBRA = { x: 38, y: 24 }; // jefe, visible desde el capítulo 5

/* ---------------- Datos de juego ---------------- */
const STARS = [
  { id: 'lamine', name: 'Lamine Yamal', short: 'LY', pos: 'DEL', rating: 90, color: '#5b7ee5', moves: ['Regate eléctrico', 'Rosca mágica'] },
  { id: 'mbappe', name: 'Kylian Mbappé', short: 'KM', pos: 'DEL', rating: 93, color: '#273c8f', moves: ['Velocidad sónica', 'Disparo cruzado'] },
  { id: 'aitana', name: 'Aitana Bonmatí', short: 'AB', pos: 'MED', rating: 92, color: '#d44f72', moves: ['Pase imposible', 'Control total'] },
  { id: 'haaland', name: 'Erling Haaland', short: 'EH', pos: 'DEL', rating: 92, color: '#58a7d8', moves: ['Martillazo', 'Carga nórdica'] },
  { id: 'bellingham', name: 'Jude Bellingham', short: 'JB', pos: 'MED', rating: 91, color: '#6d3a9c', moves: ['Llegada sorpresa', 'Giro imperial'] },
  { id: 'alexia', name: 'Alexia Putellas', short: 'AP', pos: 'MED', rating: 91, color: '#b53a68', moves: ['Visión maestra', 'Gol de oro'] },
  { id: 'rodri', name: 'Rodri Hernández', short: 'RH', pos: 'MED', rating: 90, color: '#bf3a3a', moves: ['Muro táctico', 'Pase largo'] },
  { id: 'vinicius', name: 'Vinícius Júnior', short: 'VJ', pos: 'DEL', rating: 91, color: '#e0b12d', moves: ['Danza veloz', 'Recorte doble'] },
  { id: 'cubarsi', name: 'Pau Cubarsí', short: 'PC', pos: 'DEF', rating: 86, color: '#cf6a34', moves: ['Anticipación', 'Salida limpia'] },
  { id: 'courtois', name: 'Thibaut Courtois', short: 'TC', pos: 'POR', rating: 90, color: '#54a16a', moves: ['Parada gigante', 'Saque preciso'] },
  { id: 'pedri', name: 'Pedri González', short: 'PG', pos: 'MED', rating: 89, color: '#4c8be0', moves: ['Pausa maestra', 'Túnel canario'] },
  { id: 'salma', name: 'Salma Paralluelo', short: 'SP', pos: 'DEL', rating: 89, color: '#cf477a', moves: ['Sprint total', 'Remate veloz'] },
  { id: 'musiala', name: 'Jamal Musiala', short: 'JM', pos: 'MED', rating: 90, color: '#c33a4c', moves: ['Slalom mágico', 'Toque sutil'] },
  { id: 'saliba', name: 'William Saliba', short: 'WS', pos: 'DEF', rating: 88, color: '#355da2', moves: ['Cierre perfecto', 'Choque limpio'] },
];
const SOMBRA_STAR = { id: 'sombra', name: 'Capitán de Sombra', short: '??', pos: 'DEL', rating: 96, color: '#1a1430', moves: ['Mercado oscuro', 'Presión asfixiante', 'Contragolpe letal'] };

const PORTRAITS = {};
const portraitPath = id => `assets/portraits/${id}.webp`;
STARS.forEach(p => { const img = new Image(); img.src = portraitPath(p.id); PORTRAITS[p.id] = img; });
const portraitStyle = id => `background-image:url('${portraitPath(id)}');background-size:cover;background-position:center top;background-repeat:no-repeat`;

const COACHES = [
  { id: 'mourinho', name: 'José Mourinho', initials: 'JM', philosophy: 'Carácter y defensa', skill: 'La presión bloquea 22 en vez de 12', skin: '#c99572', hair: '#313139', suit: '#202a38', accent: '#9da7b3' },
  { id: 'guardiola', name: 'Pep Guardiola', initials: 'PG', philosophy: 'Posesión y control', skill: 'El regate hace un 20% más de daño', skin: '#c88d67', hair: '#70533e', suit: '#252a34', accent: '#65b9e8' },
  { id: 'ancelotti', name: 'Carlo Ancelotti', initials: 'CA', philosophy: 'Calma y equilibrio', skill: 'Los fichajes tienen un 8% más de éxito', skin: '#d3a17e', hair: '#d5d1c8', suit: '#263143', accent: '#f1f1ef' },
  { id: 'zidane', name: 'Zinedine Zidane', initials: 'ZZ', philosophy: 'Técnica y liderazgo', skill: 'Doble probabilidad de jugada perfecta', skin: '#b97b5b', hair: '#5a493e', suit: '#183b6a', accent: '#f0e6d3' },
  { id: 'luis', name: 'Luis Enrique', initials: 'LE', philosophy: 'Intensidad y valentía', skill: 'El disparo casi nunca se va fuera', skin: '#c98e69', hair: '#5a4639', suit: '#273a55', accent: '#d34242' },
];

const CHAPTERS = [
  { title: 'La llamada', emoji: '📞', objective: 'Habla con Álex, el ojeador de Villa Cantera.', copy: 'Tras años estudiando fútbol desde la grada, recibes una llamada inesperada. La Liga FutMon busca un entrenador capaz de reunir a estrellas enfrentadas y salvar el Torneo Mundial.' },
  { title: 'La primera promesa', emoji: '🎁', objective: 'Abre un cofre y consigue balones contrato.', copy: 'Álex te entrega a Lamine como capitán provisional. Para atraer más talento necesitarás balones contrato ocultos por las antiguas rutas de entrenamiento.' },
  { title: 'El rival del río', emoji: '🌉', objective: 'Ficha a tu primer nuevo futbolista.', copy: 'Un misterioso entrenador cruza el puente y se lleva a las jóvenes promesas. Debes demostrar que tu proyecto merece la confianza de una estrella.' },
  { title: 'El Estadio Central', emoji: '🏟️', objective: 'Gana 3 duelos en el Estadio Central.', copy: 'Tus victorias llaman la atención del presidente de la Liga. Te invita al Estadio Central, donde compiten rivales de élite. Demuestra tu nivel sobre el gran césped.' },
  { title: 'Las cuatro regiones', emoji: '🗺️', objective: 'Reúne al menos 6 jugadores.', copy: 'La competición se extiende a Ciudad Solar, Bosque Cantera y Distrito Nocturno. Cada región esconde especialistas diferentes: recórrelas todas.' },
  { title: 'La sombra del mercado', emoji: '🕶️', objective: 'Derrota al Entrenador Sombra en el Estadio Central.', copy: 'Por fin tiene rostro: el Entrenador Sombra, el hombre que manipula el mercado de fichajes, te espera en el círculo central del estadio. Su capitán no puede ser fichado. Solo puedes agotarlo.' },
  { title: 'Los especialistas', emoji: '🧤', objective: 'Ficha un portero y un defensa.', copy: 'Sombra ha huido, pero volverá más fuerte. Álex es claro: sin una muralla atrás no hay copa posible. Busca un portero y un defensa que sostengan al equipo.' },
  { title: 'La copa relámpago', emoji: '⚡', objective: 'Alcanza 12 victorias en duelos.', copy: 'La Liga organiza una copa relámpago para elegir a los aspirantes. Cada duelo cuenta: encadena victorias por todas las regiones para clasificarte.' },
  { title: 'El equipo soñado', emoji: '🌟', objective: 'Reúne 10 jugadores en tu vestuario.', copy: 'Los grandes torneos se ganan con vestuarios profundos. Completa una plantilla de diez estrellas capaces de cubrir cualquier posición.' },
  { title: 'La Copa de las Leyendas', emoji: '🏆', objective: 'Vence a Sombra en la final del estadio.', copy: 'Todo termina donde empezó: el Estadio Central. Sombra ha reunido su propio equipo oscuro y te espera para la final. Gana y el fútbol volverá a ser libre.' },
];

// Triángulo de posiciones: quién supera a quién.
const BEATS = { DEL: 'MED', MED: 'DEF', DEF: 'DEL' };

const ENCOUNTER_POOLS = {
  'Ciudad Solar': ['vinicius', 'salma', 'mbappe', 'pedri'],
  'Bosque Cantera': ['cubarsi', 'rodri', 'aitana', 'lamine'],
  'Distrito Nocturno': ['bellingham', 'musiala', 'haaland', 'courtois'],
  'Estadio Central': ['mbappe', 'haaland', 'aitana', 'alexia', 'saliba'],
};

/* ---------------- Estado y guardado ---------------- */
const DEFAULT = {
  version: 2, x: 7, y: 7, balls: 6, coins: 100, drinks: 2,
  owned: ['lamine'], captain: 'lamine', hp: 100, level: 5,
  wins: 0, steps: 0, chests: [], coach: null, chapter: 0,
  stadiumWins: 0, bossWins: 0, tutorialSeen: false, muted: false, storySeen: false,
};
function load() {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem('futmon-world') || '{}') } }
  catch { return { ...DEFAULT } }
}
function save() { localStorage.setItem('futmon-world', JSON.stringify(state)); updateHud(); }

let state = load();
let battle = null;          // objeto de duelo activo o null
let facing = 'down';
let held = null;            // dirección mantenida (táctil o teclado)
let selectedCoach = null;
let pendingStory = null;    // capítulo cuya escena se mostrará al volver al mapa
let pendingEnding = false;
let animTime = 0;

// Posición suave del jugador en píxeles (interpola entre casillas).
const player = { px: 0, py: 0, tx: 0, ty: 0, moving: false };
function syncPlayer() { player.tx = state.x; player.ty = state.y; player.px = state.x * TILE; player.py = state.y * TILE; player.moving = false; }

const tile = (x, y) => MAP[y]?.[x] ?? 'T';
const walkable = t => !['T', 'W'].includes(t);
const zone = () =>
  state.x > 35 && state.y < 18 ? 'Ciudad Solar' :
  state.x < 18 && state.y > 33 ? 'Bosque Cantera' :
  state.x > 33 && state.y > 33 ? 'Distrito Nocturno' :
  state.x >= FIELD.x0 && state.x <= FIELD.x1 && state.y >= FIELD.y0 && state.y <= FIELD.y1 ? 'Estadio Central' : 'Villa Cantera';

/* ---------------- Audio (WebAudio, sin ficheros) ---------------- */
let AC = null;
const SFX = {
  select: [[660, 0, .05]],
  bump: [[130, 0, .05]],
  hit: [[240, 0, .08], [180, .06, .08]],
  crit: [[500, 0, .06], [750, .06, .12]],
  miss: [[260, 0, .08], [170, .09, .12]],
  heal: [[520, 0, .08], [660, .09, .1]],
  chest: [[523, 0, .08], [659, .09, .08], [784, .18, .16]],
  sign: [[523, 0, .09], [659, .1, .09], [784, .2, .09], [1047, .3, .22]],
  fail: [[233, 0, .12], [185, .13, .18]],
  story: [[392, 0, .1], [523, .12, .18]],
  boss: [[110, 0, .2], [104, .22, .3]],
  goal: [[392, 0, .07], [523, .08, .07], [659, .16, .22]],
  concede: [[311, 0, .1], [262, .11, .1], [208, .22, .2]],
  whistle: [[1568, 0, .09], [1568, .13, .18]],
};
function sfx(name) {
  if (state.muted || !SFX[name]) return;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = AC.currentTime;
    for (const [freq, off, dur] of SFX[name]) {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(.12, t0 + off);
      g.gain.exponentialRampToValueAtTime(.001, t0 + off + dur);
      o.connect(g).connect(AC.destination);
      o.start(t0 + off); o.stop(t0 + off + dur + .02);
    }
  } catch { /* audio no disponible: se ignora */ }
}

/* ---------------- HUD y vistas ---------------- */
function updateHud() {
  $('#ball-count').textContent = state.balls;
  $('#coin-count').textContent = state.coins;
  $('#drink-count').textContent = state.drinks;
  $('#sound-btn').textContent = state.muted ? '🔇' : '🔊';
}
function updateObjective() {
  $('#objective-text').textContent = CHAPTERS[Math.min(state.chapter, CHAPTERS.length - 1)].objective;
}
function setGameChrome(on) {
  $('#game-header').classList.toggle('visible', on);
  $('#game-nav').classList.toggle('visible', on);
}
function showView(id) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
  const cinematic = ['title-view', 'coach-view', 'story-view', 'ending-view'].includes(id);
  setGameChrome(!cinematic);
  $$('#game-nav button').forEach(b => b.classList.remove('active'));
  if (id === 'world-view') $('#nav-world').classList.add('active');
  if (id === 'team-view') { $('#nav-team').classList.add('active'); renderTeam(); }
  if (id === 'journal-view') { $('#nav-journal').classList.add('active'); renderJournal(); }
  if (id === 'help-view') $('#nav-help').classList.add('active');
  if (!cinematic) updateObjective();
}
function message(t) {
  const el = $('#world-message');
  el.textContent = t; el.style.display = 'block';
  clearTimeout(message.t);
  message.t = setTimeout(() => el.style.display = 'none', 2800);
}
function dialog(t) { $('#dialog-text').textContent = t; $('#dialog').classList.add('show'); }
const dialogOpen = () => $('#dialog').classList.contains('show') || $('#shop').classList.contains('show');

/* ---------------- Render del mundo ---------------- */
const GROUND = {
  '.': ['#7ed957', '#73cf4d', '#57b13a'], G: ['#63c247', '#59b63e', '#3f9a2e'],
  s: ['#ffd97a', '#f7cf6c', '#dfb254'], S: ['#f2c256', '#e7b54b', '#c89937'],
  a: ['#57b658', '#4daa4e', '#37903b'], A: ['#42a047', '#3b9540', '#2b7b32'],
  d: ['#6a5ba2', '#615297', '#4e4182'], D: ['#564988', '#4e417c', '#3e3469'],
};
const camera = () => [
  clamp(player.px + TILE / 2 - VIEW_W * TILE / 2, 0, WORLD * TILE - VIEW_W * TILE),
  clamp(player.py + TILE / 2 - VIEW_H * TILE / 2, 0, WORLD * TILE - VIEW_H * TILE),
];

function groundBase(px, py, key, wx, wy) {
  const pal = GROUND[key] || GROUND['.'];
  ctx.fillStyle = (wx + wy) % 2 ? pal[0] : pal[1];
  ctx.fillRect(px, py, TILE, TILE);
  return pal;
}
function drawGroundDecor(px, py, key, wx, wy) {
  const n = noise(wx, wy, 3);
  if (n > .94) { // flor
    const colors = { '.': '#fff3f8', s: '#e86a4a', a: '#ffd45c', d: '#8fe8ff' };
    ctx.fillStyle = colors[key] || '#fff3f8';
    ctx.fillRect(px + 20, py + 18, 4, 4); ctx.fillRect(px + 16, py + 22, 4, 4);
    ctx.fillRect(px + 24, py + 22, 4, 4); ctx.fillRect(px + 20, py + 26, 4, 4);
    ctx.fillStyle = '#ffd45c'; ctx.fillRect(px + 20, py + 22, 4, 4);
  } else if (n > .86) { // matojo
    ctx.fillStyle = (GROUND[key] || GROUND['.'])[2];
    ctx.fillRect(px + 10, py + 30, 3, 8); ctx.fillRect(px + 16, py + 27, 3, 11); ctx.fillRect(px + 22, py + 31, 3, 7);
  }
}
function drawTallGrass(px, py, key, wx, wy, time) {
  const pal = GROUND[key];
  ctx.fillStyle = pal[2] + '55'; ctx.fillRect(px, py + TILE - 10, TILE, 10);
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = pal[0];
  for (let i = 8; i < TILE - 4; i += 10) {
    const sway = Math.sin(time / 320 + wx * 2 + i) * 2.5;
    ctx.beginPath();
    ctx.moveTo(px + i, py + TILE - 4);
    ctx.quadraticCurveTo(px + i + sway, py + TILE - 16, px + i + sway * 1.7, py + TILE - 28);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
// Arbusto redondeado con contorno grueso, al estilo cartoon.
function drawTree(px, py, wx, wy) {
  const n = noise(wx, wy, 2), ox = (n - .5) * 5;
  ctx.fillStyle = '#57b13a'; ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = 'rgba(15,50,20,.3)';
  ctx.beginPath(); ctx.ellipse(px + 24, py + 41, 19, 6, 0, 0, Math.PI * 2); ctx.fill();
  const blobs = [[24 + ox, 24, 16], [11, 31, 11], [37, 30, 11]];
  ctx.fillStyle = '#1e6b28'; // contorno
  blobs.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(px + x, py + y, r + 3, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#33a44b';
  blobs.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(px + x, py + y, r, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = '#5bcf72'; // brillos arriba-izquierda
  blobs.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(px + x - r * .3, py + y - r * .35, r * .45, 0, Math.PI * 2); ctx.fill(); });
  if (n > .72) { // bayas
    ctx.fillStyle = '#ff5b7d';
    ctx.beginPath(); ctx.arc(px + 18 + ox, py + 22, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 31 + ox, py + 29, 3, 0, Math.PI * 2); ctx.fill();
  }
}
function drawWater(px, py, wx, wy, time) {
  ctx.fillStyle = '#38a1f2'; ctx.fillRect(px, py, TILE, TILE);
  if (noise(wx, wy) > .6) { ctx.fillStyle = '#3195e4'; ctx.fillRect(px + 8, py + 8, 30, 30); }
  ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const row of [14, 34]) {
    const o = Math.sin(time / 380 + wy + row) * 4;
    ctx.beginPath();
    ctx.moveTo(px, py + row + o * .4);
    ctx.quadraticCurveTo(px + 12, py + row - 4 + o * .4, px + 24, py + row + o * .4);
    ctx.quadraticCurveTo(px + 36, py + row + 4 + o * .4, px + 48, py + row + o * .4);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // Espuma en el borde con tierra.
  ctx.fillStyle = '#eaf9ff';
  const land = (x, y) => !['W', 'B'].includes(tile(x, y));
  if (land(wx - 1, wy)) ctx.fillRect(px, py, 4, TILE);
  if (land(wx + 1, wy)) ctx.fillRect(px + TILE - 4, py, 4, TILE);
  if (land(wx, wy - 1)) ctx.fillRect(px, py, TILE, 4);
  if (land(wx, wy + 1)) ctx.fillRect(px, py + TILE - 4, TILE, 4);
}
function drawBridge(px, py, wx, wy, time) {
  drawWater(px, py, wx, wy, time);
  ctx.fillStyle = '#c08a4e'; ctx.fillRect(px, py + 7, TILE, 34);
  ctx.fillStyle = '#a3713c';
  for (let i = 6; i < TILE; i += 9) ctx.fillRect(px + i, py + 7, 3, 34);
  ctx.fillStyle = INK; ctx.fillRect(px, py + 4, TILE, 4); ctx.fillRect(px, py + 40, TILE, 4);
}
function drawRoad(px, py, wx, wy) {
  ctx.fillStyle = '#f2dc96'; ctx.fillRect(px, py, TILE, TILE);
  const n = noise(wx, wy, 4);
  ctx.fillStyle = '#dcc178';
  ctx.fillRect(px + (n * 34 | 0), py + (n * 28 | 0) + 6, 4, 3);
  ctx.fillRect(px + ((1 - n) * 30 | 0) + 6, py + (n * 36 | 0), 3, 3);
  ctx.fillStyle = '#cbaf64';
  const path = (x, y) => ['R', 'B', 'H', 'M', 'F'].includes(tile(x, y));
  if (!path(wx - 1, wy)) ctx.fillRect(px, py, 3, TILE);
  if (!path(wx + 1, wy)) ctx.fillRect(px + TILE - 3, py, 3, TILE);
  if (!path(wx, wy - 1)) ctx.fillRect(px, py, TILE, 3);
  if (!path(wx, wy + 1)) ctx.fillRect(px, py + TILE - 3, TILE, 3);
}
function drawField(px, py, wx) {
  ctx.fillStyle = wx % 2 ? '#54b944' : '#5fc74e';
  ctx.fillRect(px, py, TILE, TILE);
}
function drawBuilding(px, py, type) {
  // base de hierba detrás del edificio
  ctx.fillStyle = '#7ed957'; ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = 'rgba(15,50,20,.28)';
  ctx.beginPath(); ctx.ellipse(px + 24, py + 44, 21, 5, 0, 0, Math.PI * 2); ctx.fill();
  const wall = type === 'H' ? '#fdf7e6' : '#ffe9a8';
  ctx.fillStyle = wall; rr(ctx, px + 4, py + 16, 40, 28, 6); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = INK; rr(ctx, px + 4, py + 16, 40, 28, 6); ctx.stroke();
  // tejado redondeado
  ctx.fillStyle = type === 'H' ? '#ff6b6b' : '#3d9df6';
  ctx.beginPath(); ctx.moveTo(px - 1, py + 18); ctx.quadraticCurveTo(px + 24, py - 8, px + 49, py + 18);
  ctx.lineTo(px + 43, py + 21); ctx.quadraticCurveTo(px + 24, py + 4, px + 5, py + 21); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.stroke();
  // puerta y ventanas
  ctx.fillStyle = '#8a6142'; rr(ctx, px + 20, py + 32, 9, 12, 3); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; rr(ctx, px + 20, py + 32, 9, 12, 3); ctx.stroke();
  ctx.fillStyle = '#aee1ff';
  rr(ctx, px + 8, py + 23, 8, 8, 3); ctx.fill(); rr(ctx, px + 8, py + 23, 8, 8, 3); ctx.stroke();
  rr(ctx, px + 33, py + 23, 8, 8, 3); ctx.fill(); rr(ctx, px + 33, py + 23, 8, 8, 3); ctx.stroke();
  if (type === 'H') { // cruz médica
    ctx.fillStyle = 'white'; rr(ctx, px + 18, py + 16, 13, 13, 4); ctx.fill();
    rr(ctx, px + 18, py + 16, 13, 13, 4); ctx.stroke();
    ctx.fillStyle = '#ff5b5b'; ctx.fillRect(px + 23, py + 18, 3, 9); ctx.fillRect(px + 20, py + 21, 9, 3);
  } else { // toldo de tienda
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff6e8' : '#ff6b6b'; ctx.fillRect(px + 4 + i * 7, py + 14, 7, 7); }
    ctx.strokeStyle = INK; ctx.strokeRect(px + 4, py + 14, 42, 7);
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚽', px + 24, py + 31);
  }
}
function drawSign(px, py, wx, wy) {
  groundBase(px, py, '.', wx, wy);
  ctx.fillStyle = '#8a6142'; rr(ctx, px + 21, py + 20, 6, 20, 2); ctx.fill();
  ctx.fillStyle = '#e0aa5f'; rr(ctx, px + 9, py + 7, 30, 17, 5); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; rr(ctx, px + 9, py + 7, 30, 17, 5); ctx.stroke();
  ctx.fillStyle = INK; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('i', px + 24, py + 20);
}
function drawLamp(px, py, wx, wy, time) {
  groundBase(px, py, 'd', wx, wy);
  ctx.fillStyle = '#39325c'; rr(ctx, px + 21, py + 12, 6, 32, 3); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = INK; rr(ctx, px + 21, py + 12, 6, 32, 3); ctx.stroke();
  const pulse = .6 + Math.sin(time / 400 + wx) * .2;
  const grad = ctx.createRadialGradient(px + 24, py + 10, 2, px + 24, py + 10, 20);
  grad.addColorStop(0, `rgba(255,220,110,${pulse})`);
  grad.addColorStop(1, 'rgba(255,220,110,0)');
  ctx.fillStyle = grad; ctx.fillRect(px + 4, py - 10, 40, 40);
  ctx.fillStyle = '#ffce3c'; rr(ctx, px + 19, py + 5, 10, 9, 4); ctx.fill();
  ctx.strokeStyle = INK; rr(ctx, px + 19, py + 5, 10, 9, 4); ctx.stroke();
}
function drawTile(px, py, t, wx, wy, time) {
  switch (t) {
    case 'T': drawTree(px, py, wx, wy); break;
    case 'W': drawWater(px, py, wx, wy, time); break;
    case 'B': drawBridge(px, py, wx, wy, time); break;
    case 'R': drawRoad(px, py, wx, wy); break;
    case 'F': drawField(px, py, wx); break;
    case 'H': case 'M': drawBuilding(px, py, t); break;
    case 'P': drawSign(px, py, wx, wy); break;
    case 'L': drawLamp(px, py, wx, wy, time); break;
    case 'G': case 'S': case 'A': case 'D':
      groundBase(px, py, t, wx, wy); drawTallGrass(px, py, t, wx, wy, time); break;
    default:
      groundBase(px, py, t, wx, wy); drawGroundDecor(px, py, t, wx, wy);
  }
}
function drawFieldMarkings(camX, camY) {
  const x0 = FIELD.x0 * TILE - camX, y0 = FIELD.y0 * TILE - camY;
  const w = (FIELD.x1 - FIELD.x0 + 1) * TILE, h = (FIELD.y1 - FIELD.y0 + 1) * TILE;
  if (x0 > canvas.width || y0 > canvas.height || x0 + w < 0 || y0 + h < 0) return;
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4;
  ctx.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12);
  const cx = x0 + w / 2, cy = y0 + h / 2;
  ctx.beginPath(); ctx.moveTo(cx, y0 + 6); ctx.lineTo(cx, y0 + h - 6); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 56, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(x0 + 6, cy - 66, 62, 132);                 // área izquierda
  ctx.strokeRect(x0 + w - 68, cy - 66, 62, 132);            // área derecha
}

/* Sprite chibi de 48px estilo cartoon: cabezota, ojos grandes, contorno
   grueso y salto al andar. Cuatro direcciones (la derecha se refleja).
   Recibe el contexto para poder dibujarse en el mundo y en el mini-campo. */
function drawActor(c, px, py, look, dir, phase, walking, opts = {}) {
  const bob = walking ? -Math.abs(Math.sin(phase)) * 3 : Math.sin(animTime / 550 + px) * .8;
  const flip = dir === 'right';
  c.save();
  if (flip) { c.translate(px * 2 + TILE, 0); c.scale(-1, 1); }
  if (opts.aura) {
    const g = c.createRadialGradient(px + 24, py + 28, 4, px + 24, py + 28, 26);
    g.addColorStop(0, 'rgba(255,51,85,.28)'); g.addColorStop(1, 'rgba(255,51,85,0)');
    c.fillStyle = g; c.fillRect(px - 4, py - 4, 56, 56);
  }
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.beginPath(); c.ellipse(px + 24, py + 45, 13, 4.5, 0, 0, Math.PI * 2); c.fill();
  c.lineWidth = 2.5; c.strokeStyle = INK;
  // piernas cortitas
  const step = walking ? Math.sin(phase) * 3 : 0;
  c.fillStyle = '#2a3550';
  if (dir === 'left' || dir === 'right') {
    rr(c, px + 14 + step, py + 37, 8, 9, 3); c.fill(); c.stroke();
    rr(c, px + 26 - step, py + 37, 8, 9, 3); c.fill(); c.stroke();
  } else {
    rr(c, px + 14, py + 37 + Math.max(0, step), 8, 9 - Math.max(0, step) * .5, 3); c.fill(); c.stroke();
    rr(c, px + 26, py + 37 + Math.max(0, -step), 8, 9 - Math.max(0, -step) * .5, 3); c.fill(); c.stroke();
  }
  // cuerpo pequeño y redondeado
  c.fillStyle = look.suit;
  rr(c, px + 12, py + 27 + bob, 24, 14, 6); c.fill(); c.stroke();
  c.fillStyle = look.accent; rr(c, px + 21, py + 28 + bob, 6, 12, 3); c.fill();
  // bracitos
  c.fillStyle = look.suit;
  rr(c, px + 7, py + 29 + bob, 6, 9, 3); c.fill(); c.stroke();
  rr(c, px + 35, py + 29 + bob, 6, 9, 3); c.fill(); c.stroke();
  // CABEZOTA
  c.fillStyle = look.skin;
  rr(c, px + 9, py + 3 + bob, 30, 26, 11); c.fill(); c.stroke();
  // pelo: casquete + patillas (de espaldas cubre casi toda la cabeza)
  c.fillStyle = look.hair;
  if (dir === 'up') {
    rr(c, px + 9, py + 3 + bob, 30, 21, 11); c.fill(); c.stroke();
  } else {
    c.beginPath();
    c.moveTo(px + 9, py + 16 + bob);
    c.quadraticCurveTo(px + 9, py + 3 + bob, px + 24, py + 3 + bob);
    c.quadraticCurveTo(px + 39, py + 3 + bob, px + 39, py + 16 + bob);
    c.lineTo(px + 35, py + 12 + bob);
    c.quadraticCurveTo(px + 24, py + 8 + bob, px + 13, py + 12 + bob);
    c.closePath(); c.fill(); c.stroke();
  }
  if (dir !== 'up') {
    // ojos grandes con brillo
    const side = (dir === 'left' || dir === 'right') ? -3 : 0;
    for (const ex of [18 + side, 30 + side]) {
      c.fillStyle = 'white';
      c.beginPath(); c.ellipse(px + ex, py + 18 + bob, 4, 5.2, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = opts.eyes || INK;
      c.beginPath(); c.arc(px + ex + side * .6, py + 19 + bob, 2.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'white';
      c.beginPath(); c.arc(px + ex - 1 + side * .6, py + 17.5 + bob, .9, 0, Math.PI * 2); c.fill();
    }
    // sonrisa
    c.strokeStyle = INK; c.lineWidth = 1.8;
    c.beginPath(); c.arc(px + 24 + side, py + 24 + bob, 3, .15 * Math.PI, .85 * Math.PI); c.stroke();
  }
  c.restore();
}
function drawPlayerSprite(camX, camY, time) {
  const coach = COACHES.find(c => c.id === state.coach) || COACHES[1];
  drawActor(ctx, player.px - camX, player.py - camY, coach, facing, time / 90, player.moving);
}
function drawNPCs(camX, camY, time) {
  // Álex, el ojeador amigo.
  const ax = ALEX.x * TILE - camX, ay = ALEX.y * TILE - camY;
  if (ax > -TILE && ax < canvas.width && ay > -TILE && ay < canvas.height) {
    drawActor(ctx, ax, ay, { skin: '#e9b184', hair: '#8a5a33', suit: '#3f7f4e', accent: '#f1e6c8' }, 'down', 0, false);
    if (state.chapter === 0) { // burbuja de aviso
      const by = ay - 14 + Math.sin(time / 300) * 3;
      ctx.fillStyle = 'white'; ctx.fillRect(ax + 16, by, 16, 16);
      ctx.fillStyle = '#d94b4b'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
      ctx.fillText('!', ax + 24, by + 12);
    }
  }
  // Entrenador Sombra (jefe).
  if (state.chapter >= 5) {
    const sx = SOMBRA.x * TILE - camX, sy = SOMBRA.y * TILE - camY;
    if (sx > -TILE && sx < canvas.width && sy > -TILE && sy < canvas.height)
      drawActor(ctx, sx, sy, { skin: '#4a4066', hair: '#161226', suit: '#191430', accent: '#ff3355' }, 'down', 0, false, { eyes: '#ff3355', aura: true });
  }
}
function drawChests(camX, camY, time) {
  CHESTS.forEach((c, i) => {
    if (state.chests.includes(i)) return;
    const px = c.x * TILE - camX, py = c.y * TILE - camY;
    if (px < -TILE || px > canvas.width || py < -TILE || py > canvas.height) return;
    const glow = .35 + Math.sin(time / 350 + i) * .2;
    const g = ctx.createRadialGradient(px + 24, py + 26, 4, px + 24, py + 26, 26);
    g.addColorStop(0, `rgba(255,212,92,${glow})`); g.addColorStop(1, 'rgba(255,212,92,0)');
    ctx.fillStyle = g; ctx.fillRect(px - 4, py - 4, 56, 56);
    ctx.fillStyle = 'rgba(15,50,20,.28)';
    ctx.beginPath(); ctx.ellipse(px + 24, py + 41, 17, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = INK;
    ctx.fillStyle = '#9a6132'; rr(ctx, px + 7, py + 17, 34, 23, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b57840'; rr(ctx, px + 7, py + 13, 34, 11, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffce3c'; ctx.fillRect(px + 9, py + 25, 30, 5);
    rr(ctx, px + 19, py + 21, 10, 12, 3); ctx.fill(); ctx.stroke();
    // destello
    const tw = Math.sin(time / 260 + i * 2);
    if (tw > .55) {
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.moveTo(px + 36, py + 12); ctx.lineTo(px + 38.5, py + 17); ctx.lineTo(px + 43, py + 19);
      ctx.lineTo(px + 38.5, py + 21); ctx.lineTo(px + 36, py + 26); ctx.lineTo(px + 33.5, py + 21);
      ctx.lineTo(px + 29, py + 19); ctx.lineTo(px + 33.5, py + 17);
      ctx.closePath(); ctx.fill();
    }
  });
}

/* Partículas ligeras (polvo de pasos, hojas, chispas). */
let particles = [];
function spawnDust() {
  for (let i = 0; i < 3; i++) particles.push({
    x: player.px + 18 + Math.random() * 12, y: player.py + 40 + Math.random() * 4,
    vx: (Math.random() - .5) * .03, vy: -.015 - Math.random() * .02,
    life: 380, max: 380, size: 3, color: '215,205,175',
  });
}
function spawnAmbient(camX, camY) {
  const z = zone();
  if (z !== 'Bosque Cantera' && z !== 'Distrito Nocturno') return;
  if (Math.random() > .03) return;
  particles.push({
    x: camX + Math.random() * VIEW_W * TILE, y: camY + Math.random() * VIEW_H * TILE,
    vx: (Math.random() - .5) * .02, vy: z === 'Bosque Cantera' ? .02 : -.012,
    life: 2400, max: 2400, size: z === 'Bosque Cantera' ? 4 : 2,
    color: z === 'Bosque Cantera' ? '150,200,110' : '140,230,255',
  });
}
function updateParticles(dt, camX, camY) {
  particles = particles.filter(p => (p.life -= dt) > 0);
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    ctx.fillStyle = `rgba(${p.color},${(p.life / p.max) * .8})`;
    ctx.fillRect(p.x - camX, p.y - camY, p.size, p.size);
  }
}

/* Viñeta cacheada y ambiente por zona. */
const vignette = document.createElement('canvas');
vignette.width = canvas.width; vignette.height = canvas.height;
{
  const v = vignette.getContext('2d');
  const g = v.createRadialGradient(480, 264, 240, 480, 264, 620);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.32)');
  v.fillStyle = g; v.fillRect(0, 0, 960, 528);
}
const AMBIENT = { 'Ciudad Solar': 'rgba(255,190,80,.09)', 'Bosque Cantera': 'rgba(15,70,35,.13)', 'Distrito Nocturno': 'rgba(25,15,80,.26)' };
function drawAmbient(camX, camY, time) {
  const tint = AMBIENT[zone()];
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (zone() === 'Distrito Nocturno') { // estrellas ancladas al mundo
    const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
    for (let ty = y0; ty <= y0 + VIEW_H; ty++) for (let tx = x0; tx <= x0 + VIEW_W; tx++) {
      if (noise(tx, ty, 9) > .96) {
        const a = .4 + Math.sin(time / 300 + tx * 3 + ty) * .35;
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`;
        ctx.fillRect(tx * TILE - camX + 20, ty * TILE - camY + 8, 2, 2);
      }
    }
  }
  ctx.drawImage(vignette, 0, 0);
}

function drawWorld(time) {
  const [camX, camY] = camera();
  const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
  for (let ty = y0; ty <= y0 + VIEW_H; ty++)
    for (let tx = x0; tx <= x0 + VIEW_W; tx++)
      drawTile(tx * TILE - camX, ty * TILE - camY, tile(tx, ty), tx, ty, time);
  drawFieldMarkings(camX, camY);
  drawChests(camX, camY, time);
  drawNPCs(camX, camY, time);
  drawPlayerSprite(camX, camY, time);
  spawnAmbient(camX, camY);
  updateParticles(16, camX, camY);
  drawAmbient(camX, camY, time);
}

/* ---------------- Minimapa ---------------- */
const MINI_COLORS = { T: '#237a30', W: '#38a1f2', B: '#c08a4e', R: '#f2dc96', F: '#5abf49', H: '#fdf7e6', M: '#ffce3c', P: '#e0aa5f', L: '#9d8fd6', '.': '#6ecb49', G: '#57b13a', s: '#f7cf6c', S: '#dfb254', a: '#4a9e48', A: '#3b8a3d', d: '#5d5090', D: '#4c4180' };
const miniBase = document.createElement('canvas');
miniBase.width = miniBase.height = 96;
{
  const m = miniBase.getContext('2d');
  for (let y = 0; y < WORLD; y++) for (let x = 0; x < WORLD; x++) {
    m.fillStyle = MINI_COLORS[MAP[y][x]] || '#5da648';
    m.fillRect(x * 2, y * 2, 2, 2);
  }
}
const miniCtx = $('#minimap').getContext('2d');
function drawMinimap(time) {
  miniCtx.clearRect(0, 0, 96, 96);
  miniCtx.drawImage(miniBase, 0, 0);
  miniCtx.fillStyle = '#ffd45c';
  CHESTS.forEach((c, i) => { if (!state.chests.includes(i)) miniCtx.fillRect(c.x * 2 - 1, c.y * 2 - 1, 3, 3); });
  if (state.chapter >= 5) { miniCtx.fillStyle = '#ff3355'; miniCtx.fillRect(SOMBRA.x * 2 - 1, SOMBRA.y * 2 - 1, 3, 3); }
  const blink = Math.sin(time / 250) > -0.3;
  if (blink) {
    miniCtx.fillStyle = '#ffffff';
    miniCtx.fillRect(Math.round(player.px / TILE) * 2 - 1, Math.round(player.py / TILE) * 2 - 1, 4, 4);
    miniCtx.fillStyle = '#e5484d';
    miniCtx.fillRect(Math.round(player.px / TILE) * 2, Math.round(player.py / TILE) * 2, 2, 2);
  }
}

/* ---------------- Movimiento ---------------- */
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const occupied = (x, y) => (x === ALEX.x && y === ALEX.y) || (state.chapter >= 5 && x === SOMBRA.x && y === SOMBRA.y);
let lastBump = 0;

function tryMove(dir) {
  if (player.moving || battle || dialogOpen() || !$('#world-view').classList.contains('active')) return;
  facing = dir;
  const [dx, dy] = DIRS[dir];
  const nx = state.x + dx, ny = state.y + dy;
  if (!walkable(tile(nx, ny)) || occupied(nx, ny)) return bump();
  state.x = nx; state.y = ny;
  player.tx = nx; player.ty = ny; player.moving = true;
}
function bump() {
  if (animTime - lastBump < 350) return;
  lastBump = animTime;
  sfx('bump');
  canvas.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 120 });
}
function updateMovement(dt) {
  if (!player.moving) { if (held) tryMove(held); return; }
  const speed = .21 * dt; // px por ms ≈ 210 px/s
  const gx = player.tx * TILE, gy = player.ty * TILE;
  player.px += clamp(gx - player.px, -speed, speed);
  player.py += clamp(gy - player.py, -speed, speed);
  if (Math.abs(gx - player.px) < .5 && Math.abs(gy - player.py) < .5) {
    player.px = gx; player.py = gy; player.moving = false;
    onArrive();
    if (held) tryMove(held);
  }
}
function onArrive() {
  state.steps++;
  $('#zone-name').textContent = zone();
  spawnDust();
  if (state.steps % 10 === 0) save();
  const t = tile(state.x, state.y);
  checkChest();
  if (['G', 'A', 'S', 'D'].includes(t) && Math.random() < (t === 'G' ? .07 : .11)) startEncounter();
  else if (t === 'F' && Math.random() < .1) startEncounter(); // rivales de élite sobre el césped del estadio
}
function checkChest() {
  CHESTS.forEach((c, i) => {
    if (state.x !== c.x || state.y !== c.y || state.chests.includes(i)) return;
    state.chests.push(i);
    const r = c.reward, parts = [];
    if (r.balls) { state.balls += r.balls; parts.push(`${r.balls} balones contrato`); }
    if (r.coins) { state.coins += r.coins; parts.push(`${r.coins} monedas`); }
    if (r.drinks) { state.drinks += r.drinks; parts.push(`${r.drinks} bebida${r.drinks > 1 ? 's' : ''}`); }
    save(); sfx('chest');
    dialog(`¡Cofre encontrado! Consigues ${parts.join(' y ')}.`);
    checkProgress();
  });
}

/* ---------------- Interacción (botón A) ---------------- */
const near = (x, y, d = 1) => Math.abs(state.x - x) + Math.abs(state.y - y) <= d;
function action() {
  if (battle) return;
  if ($('#dialog').classList.contains('show')) { closeDialog(); return; }
  if ($('#shop').classList.contains('show')) return;
  if (near(ALEX.x, ALEX.y)) return talkToAlex();
  if (state.chapter >= 5 && near(SOMBRA.x, SOMBRA.y)) return talkToSombra();
  const here = tile(state.x, state.y);
  const adjacentTo = t => [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => tile(state.x + dx, state.y + dy) === t);
  if (adjacentTo('M')) return openShop();
  if (here === 'P') { const s = SIGNS[`${state.x},${state.y}`]; if (s) return dialog(`🪧 ${s}`); }
  if (here === 'H' || adjacentTo('H')) return message('Centro médico: si pierdes un duelo, aquí te recuperas.');
  message('No hay nada con lo que interactuar aquí.');
}
function talkToAlex() {
  const lines = [
    'Álex: Te esperaba, míster. Lamine confía en tu proyecto. Busca un cofre al otro lado del camino y comienza a formar el equipo.',
    'Álex: los cofres brillan en el mapa. ¡Ábrelos para conseguir balones contrato!',
    'Álex: reta a un futbolista en la hierba alta a un 1 contra 1. ¡Gánale el partido y lánzale un balón contrato!',
    'Álex: el Estadio Central está al este, en el gran césped. Allí compiten los mejores.',
    'Álex: cada región tiene estrellas distintas. La clave es construir un equipo equilibrado.',
    'Álex: ten cuidado con el Entrenador Sombra… le he visto en el círculo central del estadio.',
    'Álex: sin portero ni defensa no hay copa. Busca a Courtois de noche y a los defensas en el bosque.',
    'Álex: ¡la copa relámpago ya está en marcha! Cada victoria te acerca a la final.',
    'Álex: diez estrellas… casi tienes el equipo soñado, míster.',
    'Álex: todo el mundo hablará de esta final. ¡Ve al estadio y gana la Copa de las Leyendas!',
  ];
  dialog(lines[Math.min(state.chapter, lines.length - 1)]);
  if (state.chapter === 0) advanceChapter(1);
}
function talkToSombra() {
  if (state.chapter === 5) { dialog('Sombra: ¿Tú eres la esperanza de la Liga? Mi capitán te enseñará quién controla el mercado.'); setTimeout(() => { closeDialog(); startBossBattle(9); }, 1600); }
  else if (state.chapter === 9) { dialog('Sombra: La final, míster. Todo o nada. Mi equipo oscuro no perdona.'); setTimeout(() => { closeDialog(); startBossBattle(17); }, 1600); }
  else if (state.chapter >= 10) dialog('Sombra: … Ganaste con honor. El mercado vuelve a ser libre. Quizá algún día quiera la revancha.');
  else dialog('Sombra: Aún no eres rival para mí. Vuelve cuando la historia te llame.');
}
function closeDialog() { $('#dialog').classList.remove('show'); maybeShowStory(); }

/* Tienda */
function openShop() {
  $('#shop-coins').textContent = state.coins;
  $('#buy-ball').disabled = state.coins < 40;
  $('#buy-drink').disabled = state.coins < 30;
  $('#shop').classList.add('show');
}
function buy(kind) {
  const cost = kind === 'ball' ? 40 : 30;
  if (state.coins < cost) return;
  state.coins -= cost;
  if (kind === 'ball') state.balls++; else state.drinks++;
  save(); sfx('chest'); openShop();
}

/* ---------------- Batalla: partido 1 contra 1 al mejor de 3 goles ----------------
   El duelo se juega sobre un mini-campo animado (#pitch): eliges una jugada por
   ronda, tu jugada también define cómo defiendes el contraataque rival, y el
   primero en marcar 3 goles gana. Si ganas el partido, puedes fichar al rival. */
const PLAY_NAMES = { dribble: 'Regate', shot: 'Disparo', press: 'Presión' };
const GOALS_TO_WIN = 3;

function posBonus(att, def) { // puntos porcentuales del triángulo táctico
  if (BEATS[att] === def) return 10;
  if (BEATS[def] === att) return -8;
  return 0;
}
// Probabilidad (0-1) de que tu jugada acabe en gol. Se muestra en vivo en cada botón.
function goalChance(type) {
  const hero = STARS.find(s => s.id === state.captain) || STARS[0];
  const r = battle.rival;
  let c = { dribble: 40, shot: 55, press: 20 }[type];
  if (r.pos === 'POR') c += type === 'shot' ? -15 : type === 'dribble' ? 10 : 0;
  else c += posBonus(hero.pos, r.pos);
  if (hero.pos === 'POR') c -= 6; // los porteros no definen bien
  if (type === 'dribble' && state.coach === 'guardiola') c += 8;
  if (type === 'shot' && state.coach === 'luis') c += 8;
  c += Math.min(10, state.level - 5); // el nivel del míster suma poco a poco
  if (battle.boss) c -= 8;
  return clamp(c, 5, 90) / 100;
}
// Probabilidad de que el rival marque en su contraataque, según tu última jugada.
function rivalChance(afterType) {
  const r = battle.rival;
  let c = 30 + Math.round((r.rating - 89) * 1.5) + (battle.boss ? battle.bossPower : 0);
  if (afterType === 'shot') c += 12;                                   // el disparo te deja vendido
  if (afterType === 'press') c -= state.coach === 'mourinho' ? 26 : 18; // la presión seca al rival
  return clamp(c, 4, 85) / 100;
}
// Fichaje tras ganar el partido: cuanto mayor la goleada, más fácil convencerle.
function captureChance() {
  if (!battle || battle.boss || battle.finished !== 'win') return 0;
  const margin = GOALS_TO_WIN - battle.rivalGoals; // 1 a 3
  let c = .45 + .15 * margin;
  if (state.coach === 'ancelotti') c += .08;
  if (state.owned.includes(battle.rival.id)) c += .1;
  return clamp(c, .1, .95);
}
function setBanner(txt, rival) {
  const b = $('#turn-banner');
  b.textContent = txt; b.classList.toggle('rival', !!rival); b.classList.remove('hidden');
}
function popDamage(side, text, kind = '') {
  const bf = $('#battlefield');
  const el = document.createElement('div');
  el.className = `dmg-pop ${kind}`;
  el.textContent = text;
  el.style.left = (side === 'foe' ? 72 : side === 'me' ? 28 : 50) + '%';
  el.style.top = '38%';
  bf.appendChild(el);
  setTimeout(() => el.remove(), 950);
}
function battleText(t) { $('#battle-text').textContent = t; }

function startEncounter() {
  const ids = ENCOUNTER_POOLS[zone()] || STARS.map(s => s.id);
  const available = STARS.filter(s => ids.includes(s.id) && s.id !== state.captain);
  const rival = available[Math.floor(Math.random() * available.length)];
  beginBattle({ rival, boss: false, bossPower: 0 });
}
function startBossBattle(power) {
  sfx('boss');
  beginBattle({ rival: SOMBRA_STAR, boss: true, bossPower: power });
}
function beginBattle({ rival, boss, bossPower }) {
  battle = {
    rival, boss, bossPower,
    myGoals: 0, rivalGoals: 0,
    busy: false, finished: null, rewarded: false,
    drinkShield: false, lastPlay: null,
    scene: { mode: 'idle', t0: 0, dur: 1, result: null },
    confetti: [], shake: 0,
  };
  held = null;
  $('#flash').classList.add('go');
  setTimeout(() => {
    $('#flash').classList.remove('go');
    showView('battle-view');
    setupBattle();
  }, 450);
}
function setupBattle() {
  const hero = STARS.find(s => s.id === state.captain) || STARS[0];
  const r = battle.rival;
  const zoneClass = { 'Ciudad Solar': 'zone-solar', 'Bosque Cantera': 'zone-bosque', 'Distrito Nocturno': 'zone-noche', 'Estadio Central': 'zone-estadio' }[zone()] || '';
  $('#battlefield').className = `battlefield ${zoneClass}`;
  $('#rival-name').textContent = r.name;
  $('#rival-level').textContent = Math.round(r.rating / 10) + (battle.boss ? 6 : 0);
  $('#rival-pos').textContent = r.pos; $('#rival-pos').className = `pos-badge ${r.pos}`;
  $('#hero-name').textContent = hero.name;
  $('#hero-level').textContent = state.level;
  $('#hero-pos').textContent = hero.pos; $('#hero-pos').className = `pos-badge ${hero.pos}`;
  $('#hero-face').style.cssText = portraitStyle(hero.id);
  $('#rival-face').style.cssText = r.id === 'sombra' ? 'background:#191430' : portraitStyle(r.id);
  // Pista táctica para que el emparejamiento se entienda de un vistazo.
  let hint;
  if (battle.boss) hint = '⚠️ Jefe: no se puede fichar. ¡Gana el partido para expulsarlo!';
  else if (r.pos === 'POR') hint = `${hero.pos} vs POR — el portero rival resiste disparos: prueba el regate.`;
  else {
    const b = posBonus(hero.pos, r.pos);
    hint = b > 0 ? `${hero.pos} vs ${r.pos} — ¡ventaja táctica! Tus jugadas suman +10% de gol.`
      : b < 0 ? `${hero.pos} vs ${r.pos} — desventaja táctica: −8% de gol.`
      : `${hero.pos} vs ${r.pos} — duelo igualado.`;
  }
  $('#matchup').textContent = '🔺 ' + hint;
  setBanner('TU JUGADA');
  battle.scene = { mode: 'idle', t0: performance.now(), dur: 1, result: null };
  updateBattle();
  sfx('whistle');
  battleText(battle.boss
    ? `¡${r.name} pisa el campito entre silbidos! Primero en marcar ${GOALS_TO_WIN} gana.`
    : `¡Duelo contra ${r.name}! Primero en marcar ${GOALS_TO_WIN} goles gana el partido.`);
  if (!state.tutorialSeen) openTutorial();
}
function updateBattle() {
  $('#score-me').textContent = battle.myGoals;
  $('#score-rival').textContent = battle.rivalGoals;
  const paint = (sel, n) => $$(sel + ' i').forEach((el, i) => el.classList.toggle('scored', i < n));
  paint('#hero-goals', battle.myGoals);
  paint('#rival-goals', battle.rivalGoals);
  const lock = battle.busy || !!battle.finished;
  $$('#battle-menu [data-move]').forEach(b => b.disabled = lock);
  if (!battle.finished) {
    $('#odds-dribble').textContent = `${Math.round(goalChance('dribble') * 100)}% gol · defensa sólida`;
    $('#odds-shot').textContent = `${Math.round(goalChance('shot') * 100)}% gol · te expone al contraataque`;
    $('#odds-press').textContent = `${Math.round(goalChance('press') * 100)}% gol · rival casi bloqueado`;
  }
  $('#drink-btn').disabled = lock || state.drinks < 1 || battle.drinkShield;
  $('#odds-drink').textContent = battle.drinkShield ? '¡portero gigante activado!' : `anula la próxima jugada rival · quedan ${state.drinks}`;
  $('#run-btn').disabled = battle.busy;
  $('#contract-btn').disabled = battle.busy || battle.boss || battle.finished !== 'win' || state.balls < 1;
  $('#contract-odds').textContent = battle.boss ? 'no disponible contra jefes'
    : battle.finished !== 'win' ? 'gana el partido para fichar'
    : state.balls < 1 ? 'sin balones: tienda o cofres'
    : `${state.balls} balones · ${Math.round(captureChance() * 100)}% de éxito`;
}
function attack(type) {
  if (!battle || battle.busy || battle.finished) return;
  battle.busy = true; battle.lastPlay = type;
  updateBattle(); sfx('select');
  const hero = STARS.find(s => s.id === state.captain) || STARS[0];
  const willGoal = Math.random() < goalChance(type);
  const golazo = willGoal && Math.random() < (state.coach === 'zidane' ? .18 : .07);
  setBanner('TU JUGADA');
  setScene('meRun');
  battleText(`${hero.name} avanza con el balón…`);
  setTimeout(() => {
    if (!battle) return;
    setScene('meShot', willGoal ? 'goal' : 'save');
    setTimeout(() => {
      if (!battle) return;
      if (willGoal) {
        battle.myGoals = Math.min(GOALS_TO_WIN, battle.myGoals + (golazo ? 2 : 1));
        battle.shake = performance.now() + 320;
        spawnConfetti('foe');
        popDamage('foe', golazo ? '¡GOLAZO! ×2' : '¡GOL!', golazo ? 'crit' : 'goal');
        sfx(golazo ? 'crit' : 'goal');
        battleText(`${hero.name}: ${PLAY_NAMES[type]}… ¡GOOOL${golazo ? 'AZO, vale doble' : ''}! (${battle.myGoals}-${battle.rivalGoals})`);
      } else {
        popDamage('foe', type === 'shot' ? '¡FUERA!' : '¡PARADA!', 'miss');
        sfx('miss');
        battleText(type === 'press'
          ? 'Presionas arriba: no llegas a rematar, pero el rival contraatacará frenado.'
          : `${hero.name}: ${PLAY_NAMES[type]}… ¡el rival la saca!`);
      }
      updateBattle();
      setTimeout(() => {
        if (!battle) return;
        if (battle.myGoals >= GOALS_TO_WIN) return winMatch();
        rivalPlay(type);
      }, 950);
    }, 430);
  }, 700);
}
function rivalPlay(afterType) {
  setBanner('JUGADA RIVAL', true);
  const r = battle.rival;
  const mv = r.moves[Math.floor(Math.random() * r.moves.length)];
  const shielded = battle.drinkShield;
  const willGoal = !shielded && Math.random() < rivalChance(afterType);
  setScene('foeRun');
  battleText(`${r.name} responde al contraataque…`);
  setTimeout(() => {
    if (!battle) return;
    setScene('foeShot', willGoal ? 'goal' : 'save');
    setTimeout(() => {
      if (!battle) return;
      if (shielded) {
        battle.drinkShield = false;
        popDamage('me', '¡PARADÓN!', 'heal'); sfx('heal');
        battleText(`${r.name} usa ${mv}… ¡pero tras el tiempo muerto tu portero lo detiene todo!`);
      } else if (willGoal) {
        battle.rivalGoals++;
        battle.shake = performance.now() + 320;
        popDamage('me', 'GOL RIVAL', 'bad'); sfx('concede');
        battleText(`${r.name} usa ${mv}… y marca. (${battle.myGoals}-${battle.rivalGoals})`);
      } else {
        popDamage('me', '¡SALVADA!', 'miss'); sfx('miss');
        battleText(`${r.name} usa ${mv}, ¡pero la sacas bajo palos!`);
      }
      updateBattle();
      setTimeout(() => {
        if (!battle) return;
        if (battle.rivalGoals >= GOALS_TO_WIN) return loseMatch();
        battle.busy = false;
        setBanner('TU JUGADA');
        updateBattle();
      }, 950);
    }, 430);
  }, 700);
}
function winMatch() {
  battle.finished = 'win'; battle.busy = false;
  battle.scene = { mode: 'idle', t0: performance.now(), dur: 1, result: null };
  spawnConfetti('foe'); spawnConfetti('me');
  sfx('whistle');
  let prize = 0;
  if (!battle.rewarded) {
    battle.rewarded = true;
    if (battle.boss) return bossVictory();
    const margin = GOALS_TO_WIN - battle.rivalGoals;
    prize = 10 + margin * 10;
    state.wins++; state.coins += prize;
    if (zone() === 'Estadio Central') state.stadiumWins++;
    if (state.wins % 3 === 0) state.level = Math.min(30, state.level + 1);
    save(); checkProgress();
  }
  setBanner('¡VICTORIA!');
  battleText(`¡Pitido final! Ganas ${battle.myGoals}-${battle.rivalGoals} (+${prize} 🪙). ¡Lanza el balón contrato para fichar a ${battle.rival.name}!`);
  updateBattle();
}
function loseMatch() {
  battle.finished = 'loss'; battle.busy = false;
  setBanner('DERROTA', true);
  sfx('fail');
  state.coins = Math.max(0, state.coins - 15);
  save();
  battleText(`Pitido final: pierdes ${battle.myGoals}-${battle.rivalGoals}. Te retiras al centro médico (−15 🪙).`);
  updateBattle();
  setTimeout(() => { if (battle) endBattle('defeat'); }, 2000);
}
function bossVictory() {
  state.bossWins++;
  state.coins += 200; state.balls += 5;
  state.level = Math.min(30, state.level + 2);
  save(); sfx('sign');
  setBanner('¡VICTORIA!');
  battleText(`¡Ganas la final ${battle.myGoals}-${battle.rivalGoals}! Sombra se retira. +200 🪙 y +5 balones contrato.`);
  updateBattle();
  setTimeout(() => { if (!battle) return; endBattle('bosswin'); checkProgress(); }, 2200);
}
// Tiempo muerto: la bebida garantiza que la próxima jugada rival acabe en parada.
function useDrink() {
  if (!battle || battle.busy || battle.finished || state.drinks < 1 || battle.drinkShield) return;
  state.drinks--;
  battle.drinkShield = true;
  save(); sfx('heal');
  popDamage('me', '🥤', 'heal');
  battleText('Tiempo muerto: bebida isotónica. ¡Tu portero parará seguro la próxima jugada rival!');
  updateBattle();
}
function contract() {
  if (!battle || battle.busy || battle.boss || battle.finished !== 'win') return;
  if (state.balls < 1) { battleText('No te quedan balones contrato. Busca cofres o visita la tienda.'); return; }
  battle.busy = true;
  state.balls--; save(); updateBattle();
  battleText(`Lanzas un balón contrato a ${battle.rival.name}…`);
  popDamage('foe', '⚽');
  const chance = captureChance();
  setTimeout(() => {
    if (!battle) return;
    if (Math.random() < chance) {
      const isNew = !state.owned.includes(battle.rival.id);
      if (isNew) state.owned.push(battle.rival.id); else state.coins += 15;
      save(); sfx('sign');
      spawnConfetti('foe');
      battleText(isNew ? `¡Fichaje conseguido! ${battle.rival.name} se une a tu equipo. 🎉` : `${battle.rival.name} renueva contigo (+15 🪙).`);
      checkProgress();
      setTimeout(() => { if (battle) endBattle('signed'); }, 1700);
    } else {
      sfx('fail');
      battleText(`${battle.rival.name} lo rechaza: quiere verte ganar con más autoridad. Puedes intentarlo otra vez.`);
      battle.busy = false;
      updateBattle();
    }
  }, 1200);
}
function endBattle(result) {
  battle = null;
  if (result === 'defeat') {
    state.x = 6; state.y = 7;
    syncPlayer(); save();
    showView('world-view');
    message('Has perdido el duelo. Te recuperas en el centro médico.');
  } else {
    showView('world-view');
    if (result === 'signed') message('¡Nuevo fichaje en tu vestuario! Míralo en 👥 Equipo.');
    else if (result === 'bosswin') message('¡Sombra se retira entre las sombras…!');
    else message('Has vuelto al mapa.');
  }
  maybeShowStory();
}

/* ---- Renderizado del mini-campo (#pitch) ---- */
const pitchCanvas = $('#pitch');
const pctx = pitchCanvas.getContext('2d');
const PITCH = { x: 60, y: 116, w: 840, h: 268 }; // campo dentro del canvas 960×420
const easeIO = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const fieldXY = (fx, fy) => [PITCH.x + fx * PITCH.w, PITCH.y + fy * PITCH.h];

function setScene(mode, result = null) {
  if (!battle) return;
  const dur = mode.endsWith('Run') ? 680 : mode.endsWith('Shot') ? 420 : 1;
  battle.scene = { mode, result, t0: performance.now(), dur };
}
// Posiciones de los dos jugadores y el balón según la fase de la escena.
function scenePositions(time) {
  const me = { x: .2, y: .55, dir: 'right', walking: false };
  const foe = { x: .8, y: .55, dir: 'left', walking: false };
  const ball = { x: .5, y: .62, air: 0 };
  const s = battle.scene;
  const k = Math.min(1, (time - s.t0) / (s.dur || 1));
  if (s.mode === 'meRun') {
    me.x = .2 + easeIO(k) * .32; me.walking = k < 1;
    ball.x = me.x + .05; ball.air = Math.abs(Math.sin(time / 90)) * 5;
  } else if (s.mode === 'foeRun') {
    foe.x = .8 - easeIO(k) * .32; foe.walking = k < 1;
    ball.x = foe.x - .05; ball.air = Math.abs(Math.sin(time / 90)) * 5;
  } else if (s.mode === 'meShot') {
    me.x = .52;
    if (s.result === 'goal') { ball.x = .58 + k * .41; ball.air = Math.sin(k * Math.PI) * 34; }
    else { ball.x = .58 + k * .3; ball.air = Math.sin(k * Math.PI) * 46; foe.x = .8 + easeIO(k) * .09; foe.walking = k < 1; }
  } else if (s.mode === 'foeShot') {
    foe.x = .48;
    if (s.result === 'goal') { ball.x = .42 - k * .41; ball.air = Math.sin(k * Math.PI) * 34; }
    else { ball.x = .42 - k * .3; ball.air = Math.sin(k * Math.PI) * 46; me.x = .2 - easeIO(k) * .07; me.walking = k < 1; }
  }
  return { me, foe, ball };
}
function spawnConfetti(side) {
  const [gx, gy] = fieldXY(side === 'foe' ? .97 : .03, .5);
  const colors = ['#ffce00', '#45d9ff', '#ff5b7d', '#7dff6e', '#ffffff'];
  for (let i = 0; i < 26; i++) battle.confetti.push({
    x: gx, y: gy - 20,
    vx: (Math.random() - (side === 'foe' ? .72 : .28)) * .3,
    vy: -.18 - Math.random() * .22,
    life: 900 + Math.random() * 300,
    color: colors[i % colors.length],
    size: 3 + Math.random() * 4,
  });
}
function drawGoalFrame(x, cy) {
  pctx.fillStyle = '#ffffff';
  rr(pctx, x - 12, cy - 58, 24, 116, 8); pctx.fill();
  pctx.lineWidth = 4; pctx.strokeStyle = INK; rr(pctx, x - 12, cy - 58, 24, 116, 8); pctx.stroke();
  pctx.strokeStyle = '#00000030'; pctx.lineWidth = 1.5;
  for (let i = -7; i <= 7; i += 5) { pctx.beginPath(); pctx.moveTo(x + i, cy - 54); pctx.lineTo(x + i, cy + 54); pctx.stroke(); }
  for (let j = -52; j <= 52; j += 12) { pctx.beginPath(); pctx.moveTo(x - 9, cy + j); pctx.lineTo(x + 9, cy + j); pctx.stroke(); }
}
function drawPitchActor(x, y, look, dir, time, walking, opts = {}) {
  const s = 1.75;
  pctx.save();
  pctx.translate(x - 24 * s, y - 46 * s);
  pctx.scale(s, s);
  drawActor(pctx, 0, 0, look, dir, time / 85, walking, opts);
  pctx.restore();
}
function drawBall(ball, time) {
  const [bx, by] = fieldXY(ball.x, ball.y);
  const air = ball.air || 0;
  pctx.fillStyle = 'rgba(0,0,0,.25)';
  pctx.beginPath(); pctx.ellipse(bx, by + 9, 10, 4, 0, 0, Math.PI * 2); pctx.fill();
  pctx.fillStyle = 'white';
  pctx.beginPath(); pctx.arc(bx, by - air, 9, 0, Math.PI * 2); pctx.fill();
  pctx.lineWidth = 2.5; pctx.strokeStyle = INK; pctx.stroke();
  pctx.fillStyle = INK;
  pctx.beginPath(); pctx.arc(bx + Math.sin(time / 140) * 3.5, by - air - Math.cos(time / 140) * 3.5, 3, 0, Math.PI * 2); pctx.fill();
}
function drawPitch(time) {
  const W = pitchCanvas.width, H = pitchCanvas.height;
  pctx.clearRect(0, 0, W, H);
  pctx.save();
  if (battle.shake > time) pctx.translate((Math.random() - .5) * 7, (Math.random() - .5) * 7);
  // gradas con público saltarín
  pctx.fillStyle = '#1a2a4a'; rr(pctx, 12, 6, W - 24, 74, 16); pctx.fill();
  pctx.lineWidth = 4; pctx.strokeStyle = INK; rr(pctx, 12, 6, W - 24, 74, 16); pctx.stroke();
  const crowdColors = ['#ff6b6b', '#ffd24d', '#3d9df6', '#7dff6e', '#ff9dd6', '#fff4dd'];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 44; i++) {
    const cxp = 32 + i * (W - 64) / 43;
    const cyp = 32 + row * 26 + (Math.sin(time / 260 + i * 1.7 + row) > .72 ? -6 : 0);
    pctx.fillStyle = crowdColors[(i + row * 3) % crowdColors.length];
    pctx.beginPath(); pctx.arc(cxp, cyp, 7, 0, Math.PI * 2); pctx.fill();
  }
  // campo con césped a franjas
  rr(pctx, PITCH.x - 16, PITCH.y - 14, PITCH.w + 32, PITCH.h + 30, 20);
  pctx.fillStyle = '#4fa843'; pctx.fill();
  pctx.save();
  rr(pctx, PITCH.x - 16, PITCH.y - 14, PITCH.w + 32, PITCH.h + 30, 20); pctx.clip();
  for (let i = 0; i < 10; i++) {
    pctx.fillStyle = i % 2 ? '#5fc74e' : '#55ba45';
    pctx.fillRect(PITCH.x - 16 + i * (PITCH.w + 32) / 10, PITCH.y - 14, (PITCH.w + 32) / 10 + 1, PITCH.h + 30);
  }
  pctx.strokeStyle = '#ffffffd9'; pctx.lineWidth = 4;
  pctx.strokeRect(PITCH.x, PITCH.y, PITCH.w, PITCH.h);
  pctx.beginPath(); pctx.moveTo(PITCH.x + PITCH.w / 2, PITCH.y); pctx.lineTo(PITCH.x + PITCH.w / 2, PITCH.y + PITCH.h); pctx.stroke();
  pctx.beginPath(); pctx.arc(PITCH.x + PITCH.w / 2, PITCH.y + PITCH.h / 2, 50, 0, Math.PI * 2); pctx.stroke();
  pctx.strokeRect(PITCH.x, PITCH.y + PITCH.h / 2 - 68, 66, 136);
  pctx.strokeRect(PITCH.x + PITCH.w - 66, PITCH.y + PITCH.h / 2 - 68, 66, 136);
  pctx.restore();
  pctx.lineWidth = 5; pctx.strokeStyle = INK;
  rr(pctx, PITCH.x - 16, PITCH.y - 14, PITCH.w + 32, PITCH.h + 30, 20); pctx.stroke();
  // porterías
  drawGoalFrame(PITCH.x - 26, PITCH.y + PITCH.h / 2);
  drawGoalFrame(PITCH.x + PITCH.w + 26, PITCH.y + PITCH.h / 2);
  // jugadores y balón
  const { me, foe, ball } = scenePositions(time);
  const hero = STARS.find(s => s.id === state.captain) || STARS[0];
  const meLook = { skin: '#f2b98a', hair: '#3a2b20', suit: hero.color, accent: '#ffffff' };
  const foeLook = battle.rival.id === 'sombra'
    ? { skin: '#4a4066', hair: '#161226', suit: '#191430', accent: '#ff3355' }
    : { skin: '#e8ab7c', hair: '#241a12', suit: battle.rival.color, accent: '#ffffff' };
  const [mx, my] = fieldXY(me.x, me.y);
  const [fx, fy] = fieldXY(foe.x, foe.y);
  drawPitchActor(mx, my, meLook, me.dir, time, me.walking);
  drawPitchActor(fx, fy, foeLook, foe.dir, time, foe.walking, battle.rival.id === 'sombra' ? { eyes: '#ff3355', aura: true } : {});
  drawBall(ball, time);
  // confeti
  battle.confetti = battle.confetti.filter(p => (p.life -= 16) > 0);
  for (const p of battle.confetti) {
    p.vy += .0011 * 16; p.x += p.vx * 16; p.y += p.vy * 16;
    pctx.globalAlpha = Math.min(1, p.life / 400);
    pctx.fillStyle = p.color;
    pctx.fillRect(p.x, p.y, p.size, p.size);
  }
  pctx.globalAlpha = 1;
  pctx.restore();
}

/* Tutorial de combate (solo la primera vez). */
const TUTORIAL = [
  { t: '⚽ ¡Partido 1 contra 1!', x: 'Un mini partido en el campito: el primero en marcar 3 goles gana. En cada ronda eliges una jugada, y cada botón muestra tu % de gol en vivo.' },
  { t: '🔺 Ataque y defensa', x: 'Tu jugada también define tu defensa: el Disparo es potente pero te expone al contraataque; la Presión apenas marca pero seca al rival. Y el triángulo DEL > MED > DEF > DEL cambia tus porcentajes (el portero rival resiste disparos).' },
  { t: '✍️ Si ganas, lo fichas', x: 'Gana el partido y lanza el balón contrato tras el pitido final. Cuanto mayor sea la goleada, más fácil será convencerle. ¡Suerte, míster!' },
];
let tutStep = 0;
function openTutorial() {
  tutStep = 0; renderTutorial();
  $('#battle-tutorial').classList.add('show');
}
function renderTutorial() {
  $('#tut-title').textContent = TUTORIAL[tutStep].t;
  $('#tut-text').textContent = TUTORIAL[tutStep].x;
  $('#tut-next').textContent = tutStep < TUTORIAL.length - 1 ? 'Siguiente →' : '¡A jugar!';
}
function nextTutorial() {
  tutStep++;
  if (tutStep >= TUTORIAL.length) {
    $('#battle-tutorial').classList.remove('show');
    state.tutorialSeen = true; save();
  } else renderTutorial();
}

/* ---------------- Historia y capítulos ---------------- */
function checkProgress() {
  const c = state.chapter;
  if (c === 1 && state.chests.length >= 1) advanceChapter(2);
  else if (c === 2 && state.owned.length >= 2) advanceChapter(3);
  else if (c === 3 && state.stadiumWins >= 3) advanceChapter(4);
  else if (c === 4 && state.owned.length >= 6) advanceChapter(5);
  else if (c === 5 && state.bossWins >= 1) advanceChapter(6);
  else if (c === 6 && state.owned.includes('courtois') && (state.owned.includes('cubarsi') || state.owned.includes('saliba'))) advanceChapter(7);
  else if (c === 7 && state.wins >= 12) advanceChapter(8);
  else if (c === 8 && state.owned.length >= 10) advanceChapter(9);
  else if (c === 9 && state.bossWins >= 2) advanceChapter(10);
}
function advanceChapter(next) {
  if (next <= state.chapter) return;
  state.chapter = next;
  save(); updateObjective(); sfx('story');
  if (next >= CHAPTERS.length) pendingEnding = true;
  else pendingStory = next;
}
function maybeShowStory() {
  if (pendingEnding) { pendingEnding = false; showEnding(); }
  else if (pendingStory != null) { const c = pendingStory; pendingStory = null; showStory(c); }
}
function showStory(chapter) {
  const c = CHAPTERS[chapter];
  const coach = COACHES.find(v => v.id === state.coach) || COACHES[1];
  $('#chapter-kicker').textContent = chapter === 0 ? 'PRÓLOGO' : `CAPÍTULO ${chapter + 1}`;
  $('#story-title').textContent = c.title;
  $('#story-art').textContent = c.emoji;
  $('#story-copy').textContent = chapter === 0
    ? `${coach.name} abandona los grandes estadios para aceptar el reto más extraño de su carrera. ${c.copy}`
    : c.copy;
  showView('story-view');
}
function showEnding() {
  $('#ending-copy').textContent = '¡Campeones! El estadio corea tu nombre mientras Sombra desaparece entre la multitud. El mercado vuelve a ser libre y tu vestuario, una familia. Puedes seguir explorando, fichando y ganando duelos: la leyenda no ha hecho más que empezar.';
  $('#ending-stats').innerHTML =
    `<span>🏆 ${state.wins} victorias</span><span>👥 ${state.owned.length}/${STARS.length} jugadores</span><span>🪙 ${state.coins} monedas</span><span>👟 ${state.steps} pasos</span>`;
  sfx('sign');
  showView('ending-view');
}

/* ---------------- Paneles ---------------- */
function renderTeam() {
  const list = state.owned.map(id => STARS.find(s => s.id === id)).filter(Boolean);
  $('#team-list').innerHTML =
    `<div class="team-summary"><b>${list.length}/${STARS.length} jugadores</b><span>🪙 ${state.coins} · 🏆 ${state.wins} victorias · NV ${state.level}</span></div>` +
    `<div class="team-grid">` +
    list.map(p => `<article class="player-row">
      <div class="portrait" style="${portraitStyle(p.id)}"></div>
      <div><h3>${p.name}</h3><p><span class="pos-badge ${p.pos}">${p.pos}</span> · GRL ${p.rating}</p>${state.captain === p.id ? '<span class="captain">★ CAPITÁN</span>' : ''}</div>
      <button data-id="${p.id}" class="${state.captain === p.id ? 'is-captain' : ''}">${state.captain === p.id ? '✓' : 'Elegir'}</button>
    </article>`).join('') + `</div>`;
  $$('.player-row button').forEach(b => b.onclick = () => {
    state.captain = b.dataset.id;
    save(); sfx('select'); renderTeam();
  });
}
function renderJournal() {
  $('#journal-content').innerHTML = CHAPTERS.map((c, i) => {
    const cls = i < state.chapter ? 'done' : i === state.chapter ? 'current' : 'locked';
    return `<article class="journal-card ${cls}">
      <small>CAPÍTULO ${i + 1}</small>
      <h3>${i > state.chapter ? '???' : `${c.emoji} ${c.title}`}</h3>
      <p>${i > state.chapter ? 'Continúa la aventura para desbloquearlo.' : c.objective}</p>
    </article>`;
  }).join('');
}
function renderCoaches() {
  $('#coach-grid').innerHTML = COACHES.map(c => `
    <button class="coach-card ${selectedCoach === c.id ? 'selected' : ''}" data-coach="${c.id}">
      <div class="coach-face" style="background:${c.suit};color:${c.accent};border-color:${c.accent}">${c.initials}</div>
      <h3>${c.name}</h3><p>${c.philosophy}</p><b>${c.skill}</b>
    </button>`).join('');
  $$('.coach-card').forEach(b => b.onclick = () => {
    selectedCoach = b.dataset.coach;
    $('#confirm-coach').disabled = false;
    sfx('select'); renderCoaches();
  });
}
/* En móvil, al empezar a jugar intentamos pantalla completa + orientación
   apaisada (requiere gesto del usuario; instalada como PWA ya viene bloqueada). */
async function goLandscape() {
  if (!matchMedia('(pointer:coarse)').matches) return;
  try {
    await document.documentElement.requestFullscreen?.();
    await screen.orientation?.lock?.('landscape');
  } catch { /* el navegador puede denegarlo: el aviso de rotación cubre ese caso */ }
}

function startNewGame() { goLandscape(); selectedCoach = null; renderCoaches(); showView('coach-view'); }
function confirmCoach() {
  if (!selectedCoach) return;
  state = { ...DEFAULT, coach: selectedCoach, storySeen: true };
  syncPlayer(); save();
  showStory(0);
}
function continueGame() {
  goLandscape();
  if (!state.coach) return startNewGame();
  showView('world-view');
}

/* ---------------- Entrada ---------------- */
$$('[data-dir]').forEach(b => {
  b.onpointerdown = e => { e.preventDefault(); held = b.dataset.dir; tryMove(held); };
  b.onpointerup = b.onpointerleave = b.onpointercancel = () => { held = null; };
});
const KEYMAP = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
document.addEventListener('keydown', e => {
  const dir = KEYMAP[e.key];
  if (dir) { e.preventDefault(); held = dir; tryMove(dir); return; }
  if ([' ', 'e', 'E', 'Enter'].includes(e.key)) {
    e.preventDefault();
    if ($('#battle-tutorial').classList.contains('show')) return nextTutorial();
    if (!battle) action();
  }
  if (e.key === 'Escape') {
    if ($('#shop').classList.contains('show')) { $('#shop').classList.remove('show'); return; }
    if ($('#dialog').classList.contains('show')) { closeDialog(); return; }
    if (!battle && !['title-view', 'coach-view', 'story-view', 'ending-view'].some(id => $('#' + id).classList.contains('active'))) showView('world-view');
  }
});
document.addEventListener('keyup', e => { if (KEYMAP[e.key] === held) held = null; });

$('#action-btn').onclick = action;
$('#dialog-next').onclick = closeDialog;
$('#nav-world').onclick = () => showView('world-view');
$('#nav-team').onclick = () => showView('team-view');
$('#nav-journal').onclick = () => showView('journal-view');
$('#nav-help').onclick = () => showView('help-view');
$$('.close-panel').forEach(b => b.onclick = () => showView('world-view'));
$$('[data-move]').forEach(b => b.onclick = () => attack(b.dataset.move));
$('#drink-btn').onclick = useDrink;
$('#contract-btn').onclick = contract;
$('#run-btn').onclick = () => { if (battle && !battle.busy) endBattle('flee'); };
$('#tut-next').onclick = nextTutorial;
$('#new-game-btn').onclick = startNewGame;
$('#continue-btn').onclick = continueGame;
$('#confirm-coach').onclick = confirmCoach;
$('#story-next').onclick = () => showView('world-view');
$('#ending-btn').onclick = () => showView('world-view');
$('#buy-ball').onclick = () => buy('ball');
$('#buy-drink').onclick = () => buy('drink');
$('#shop-close').onclick = () => $('#shop').classList.remove('show');
$('#sound-btn').onclick = () => { state.muted = !state.muted; save(); sfx('select'); };
// Salida de emergencia del aviso de rotación: es un gesto del usuario, así que
// aprovechamos para intentar el bloqueo apaisado; si falla, se juega en vertical.
$('#rotate-skip').onclick = () => { goLandscape(); $('#rotate-overlay').classList.add('dismissed'); };

/* ---------------- Arranque y bucle principal ---------------- */
// PWA: service worker para jugar sin conexión e instalar en Android.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* p. ej. file:// o sin permisos */ });
}
syncPlayer();
updateHud();
$('#zone-name').textContent = zone();
$('#continue-btn').style.display = state.coach ? 'block' : 'none';
setGameChrome(false);

let lastFrame = 0;
function loop(t) {
  const dt = Math.min(50, t - lastFrame);
  lastFrame = t; animTime = t;
  if ($('#world-view').classList.contains('active')) {
    updateMovement(dt);
    drawWorld(t);
    drawMinimap(t);
  } else if (battle && $('#battle-view').classList.contains('active')) {
    drawPitch(t);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
