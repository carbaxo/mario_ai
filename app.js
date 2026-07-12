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
  '11,13': 'Villa Cantera — donde nacen las leyendas. El centro médico (cruz roja) cura gratis.',
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

// Movimientos del jugador en el duelo.
const MOVES = {
  dribble: { name: 'Regate', min: 14, max: 24 },
  shot:    { name: 'Disparo', min: 24, max: 40, miss: .2 },
  press:   { name: 'Presión', min: 8, max: 14, shield: 12 },
};
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
  '.': ['#6cb851', '#64ae4a', '#4f9840'], G: ['#5da345', '#549a40', '#3d7f33'],
  s: ['#e0c476', '#d8ba6a', '#c2a254'], S: ['#d4ae55', '#caa14b', '#a8823a'],
  a: ['#4f9147', '#478540', '#356b31'], A: ['#3f7f3e', '#387539', '#2a5c2c'],
  d: ['#5e5385', '#564b7b', '#453b68'], D: ['#4c4272', '#453b68', '#352d57'],
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
  ctx.lineWidth = 2; ctx.strokeStyle = pal[0];
  for (let i = 7; i < TILE - 3; i += 9) {
    const sway = Math.sin(time / 320 + wx * 2 + i) * 2.5;
    ctx.beginPath();
    ctx.moveTo(px + i, py + TILE - 3);
    ctx.quadraticCurveTo(px + i + sway, py + TILE - 16, px + i + sway * 1.7, py + TILE - 29);
    ctx.stroke();
  }
}
function drawTree(px, py, wx, wy) {
  const n = noise(wx, wy, 2), ox = (n - .5) * 4;
  ctx.fillStyle = '#275c36'; ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(px + 24, py + 42, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4a2c'; ctx.fillRect(px + 20, py + 26, 8, 16);
  ctx.fillStyle = '#245f31';
  ctx.beginPath(); ctx.arc(px + 24 + ox, py + 20, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2f7d3f';
  ctx.beginPath(); ctx.arc(px + 24 + ox, py + 17, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#45a052';
  ctx.beginPath(); ctx.arc(px + 18 + ox, py + 12, 8, 0, Math.PI * 2); ctx.fill();
}
function drawWater(px, py, wx, wy, time) {
  ctx.fillStyle = '#2b76bd'; ctx.fillRect(px, py, TILE, TILE);
  if (noise(wx, wy) > .6) { ctx.fillStyle = '#286fb2'; ctx.fillRect(px + 8, py + 8, 30, 30); }
  ctx.strokeStyle = '#8fd4ef'; ctx.lineWidth = 2;
  for (const row of [14, 34]) {
    const o = Math.sin(time / 380 + wy + row) * 4;
    ctx.beginPath();
    ctx.moveTo(px, py + row + o * .4);
    ctx.quadraticCurveTo(px + 12, py + row - 4 + o * .4, px + 24, py + row + o * .4);
    ctx.quadraticCurveTo(px + 36, py + row + 4 + o * .4, px + 48, py + row + o * .4);
    ctx.stroke();
  }
  // Espuma en el borde con tierra.
  ctx.fillStyle = '#dff4fbcc';
  const land = (x, y) => !['W', 'B'].includes(tile(x, y));
  if (land(wx - 1, wy)) ctx.fillRect(px, py, 3, TILE);
  if (land(wx + 1, wy)) ctx.fillRect(px + TILE - 3, py, 3, TILE);
  if (land(wx, wy - 1)) ctx.fillRect(px, py, TILE, 3);
  if (land(wx, wy + 1)) ctx.fillRect(px, py + TILE - 3, TILE, 3);
}
function drawBridge(px, py, wx, wy, time) {
  drawWater(px, py, wx, wy, time);
  ctx.fillStyle = '#a87a45'; ctx.fillRect(px, py + 6, TILE, 36);
  ctx.fillStyle = '#8a5f36';
  for (let i = 6; i < TILE; i += 9) ctx.fillRect(px + i, py + 6, 2, 36);
  ctx.fillStyle = '#5d3f22'; ctx.fillRect(px, py + 3, TILE, 4); ctx.fillRect(px, py + 41, TILE, 4);
}
function drawRoad(px, py, wx, wy) {
  ctx.fillStyle = '#dbc389'; ctx.fillRect(px, py, TILE, TILE);
  const n = noise(wx, wy, 4);
  ctx.fillStyle = '#c3a86d';
  ctx.fillRect(px + (n * 34 | 0), py + (n * 28 | 0) + 6, 4, 3);
  ctx.fillRect(px + ((1 - n) * 30 | 0) + 6, py + (n * 36 | 0), 3, 3);
  ctx.fillStyle = '#b89a5e';
  const path = (x, y) => ['R', 'B', 'H', 'M', 'F'].includes(tile(x, y));
  if (!path(wx - 1, wy)) ctx.fillRect(px, py, 3, TILE);
  if (!path(wx + 1, wy)) ctx.fillRect(px + TILE - 3, py, 3, TILE);
  if (!path(wx, wy - 1)) ctx.fillRect(px, py, TILE, 3);
  if (!path(wx, wy + 1)) ctx.fillRect(px, py + TILE - 3, TILE, 3);
}
function drawField(px, py, wx) {
  ctx.fillStyle = wx % 2 ? '#4ea24e' : '#58b258';
  ctx.fillRect(px, py, TILE, TILE);
}
function drawBuilding(px, py, type) {
  // base de hierba detrás del edificio
  ctx.fillStyle = '#6cb851'; ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(px + 4, py + 42, 42, 5);
  const wall = type === 'H' ? '#f4efdd' : '#f5dfa0';
  ctx.fillStyle = wall; ctx.fillRect(px + 4, py + 16, 40, 28);
  // tejado
  ctx.fillStyle = type === 'H' ? '#cf5050' : '#3c70d7';
  ctx.beginPath(); ctx.moveTo(px, py + 18); ctx.lineTo(px + 24, py + 2); ctx.lineTo(px + 48, py + 18); ctx.closePath(); ctx.fill();
  // puerta y ventanas
  ctx.fillStyle = '#7b5b3d'; ctx.fillRect(px + 20, py + 32, 9, 12);
  ctx.fillStyle = '#9cc9e8'; ctx.fillRect(px + 8, py + 24, 8, 7); ctx.fillRect(px + 33, py + 24, 8, 7);
  ctx.strokeStyle = '#00000033'; ctx.strokeRect(px + 8, py + 24, 8, 7); ctx.strokeRect(px + 33, py + 24, 8, 7);
  if (type === 'H') { // cruz médica
    ctx.fillStyle = 'white'; ctx.fillRect(px + 19, py + 17, 11, 11);
    ctx.fillStyle = '#d94b4b'; ctx.fillRect(px + 23, py + 18, 3, 9); ctx.fillRect(px + 20, py + 21, 9, 3);
  } else { // toldo de tienda
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#f7f2ea' : '#d95555'; ctx.fillRect(px + 4 + i * 7, py + 15, 7, 6); }
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('⚽', px + 24, py + 30);
  }
}
function drawSign(px, py, wx, wy) {
  groundBase(px, py, '.', wx, wy);
  ctx.fillStyle = '#7a522d'; ctx.fillRect(px + 22, py + 22, 5, 18);
  ctx.fillStyle = '#c89858'; ctx.fillRect(px + 10, py + 8, 28, 16);
  ctx.strokeStyle = '#7a522d'; ctx.lineWidth = 2; ctx.strokeRect(px + 10, py + 8, 28, 16);
  ctx.fillStyle = '#5a3c1e'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  ctx.fillText('i', px + 24, py + 20);
}
function drawLamp(px, py, wx, wy, time) {
  groundBase(px, py, 'd', wx, wy);
  ctx.fillStyle = '#3a3554'; ctx.fillRect(px + 22, py + 12, 4, 32);
  const pulse = .6 + Math.sin(time / 400 + wx) * .2;
  const grad = ctx.createRadialGradient(px + 24, py + 10, 2, px + 24, py + 10, 20);
  grad.addColorStop(0, `rgba(255,220,110,${pulse})`);
  grad.addColorStop(1, 'rgba(255,220,110,0)');
  ctx.fillStyle = grad; ctx.fillRect(px + 4, py - 10, 40, 40);
  ctx.fillStyle = '#ffd45c'; ctx.fillRect(px + 20, py + 6, 8, 7);
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
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
  ctx.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12);
  const cx = x0 + w / 2, cy = y0 + h / 2;
  ctx.beginPath(); ctx.moveTo(cx, y0 + 6); ctx.lineTo(cx, y0 + h - 6); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 56, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeRect(x0 + 6, cy - 66, 62, 132);                 // área izquierda
  ctx.strokeRect(x0 + w - 68, cy - 66, 62, 132);            // área derecha
}

/* Sprite de personaje de 48px, cuatro direcciones y paso animado. */
function drawActor(px, py, look, dir, phase, walking, opts = {}) {
  const bob = walking ? Math.sin(phase) * 1.6 : Math.sin(animTime / 600 + px) * .6;
  const flip = dir === 'right';
  ctx.save();
  if (flip) { ctx.translate(px * 2 + TILE, 0); ctx.scale(-1, 1); }
  if (opts.aura) {
    const g = ctx.createRadialGradient(px + 24, py + 28, 4, px + 24, py + 28, 26);
    g.addColorStop(0, 'rgba(255,51,85,.25)'); g.addColorStop(1, 'rgba(255,51,85,0)');
    ctx.fillStyle = g; ctx.fillRect(px - 4, py - 4, 56, 56);
  }
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(px + 24, py + 44, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
  // piernas
  const step = walking ? Math.sin(phase) * 3 : 0;
  ctx.fillStyle = '#20283a';
  if (dir === 'left' || dir === 'right') {
    ctx.fillRect(px + 15 + step, py + 34, 7, 11);
    ctx.fillRect(px + 26 - step, py + 34, 7, 11);
  } else {
    ctx.fillRect(px + 15, py + 34 + Math.max(0, step), 7, 11 - Math.max(0, step));
    ctx.fillRect(px + 26, py + 34 + Math.max(0, -step), 7, 11 - Math.max(0, -step));
  }
  // cuerpo
  ctx.fillStyle = look.suit; ctx.fillRect(px + 12, py + 20 + bob, 24, 16);
  ctx.fillStyle = look.accent; ctx.fillRect(px + 22, py + 20 + bob, 4, 16);
  ctx.fillStyle = look.suit; ctx.fillRect(px + 8, py + 22 + bob, 5, 11); ctx.fillRect(px + 35, py + 22 + bob, 5, 11);
  ctx.fillStyle = look.skin; ctx.fillRect(px + 8, py + 31 + bob, 5, 4); ctx.fillRect(px + 35, py + 31 + bob, 5, 4);
  // cabeza
  ctx.fillStyle = look.skin; ctx.fillRect(px + 14, py + 6 + bob, 20, 15);
  ctx.fillStyle = look.hair;
  ctx.fillRect(px + 13, py + 3 + bob, 22, 7);
  ctx.fillRect(px + 13, py + 7 + bob, 4, 7); ctx.fillRect(px + 31, py + 7 + bob, 4, 7);
  if (dir === 'up') {
    ctx.fillRect(px + 14, py + 8 + bob, 20, 10); // nuca: sin cara
  } else {
    ctx.fillStyle = opts.eyes || '#1b2230';
    if (dir === 'left' || dir === 'right') {
      ctx.fillRect(px + 17, py + 12 + bob, 4, 4);
      ctx.fillStyle = look.skin;
    } else {
      ctx.fillRect(px + 18, py + 12 + bob, 4, 4); ctx.fillRect(px + 27, py + 12 + bob, 4, 4);
    }
  }
  ctx.restore();
}
function drawPlayerSprite(camX, camY, time) {
  const coach = COACHES.find(c => c.id === state.coach) || COACHES[1];
  drawActor(player.px - camX, player.py - camY, coach, facing, time / 90, player.moving);
}
function drawNPCs(camX, camY, time) {
  // Álex, el ojeador amigo.
  const ax = ALEX.x * TILE - camX, ay = ALEX.y * TILE - camY;
  if (ax > -TILE && ax < canvas.width && ay > -TILE && ay < canvas.height) {
    drawActor(ax, ay, { skin: '#e9b184', hair: '#8a5a33', suit: '#3f7f4e', accent: '#f1e6c8' }, 'down', 0, false);
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
      drawActor(sx, sy, { skin: '#4a4066', hair: '#161226', suit: '#191430', accent: '#ff3355' }, 'down', 0, false, { eyes: '#ff3355', aura: true });
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
    ctx.fillStyle = '#7a4a26'; ctx.fillRect(px + 8, py + 18, 32, 22);
    ctx.fillStyle = '#8f5a30'; ctx.fillRect(px + 8, py + 14, 32, 9);
    ctx.fillStyle = '#e8b13c'; ctx.fillRect(px + 8, py + 24, 32, 5);
    ctx.fillRect(px + 20, py + 20, 8, 11);
    ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = 2; ctx.strokeRect(px + 8, py + 14, 32, 26);
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
const MINI_COLORS = { T: '#1c4a28', W: '#2b76bd', B: '#a87a45', R: '#dbc389', F: '#4ea24e', H: '#f4efdd', M: '#ffd45c', P: '#c89858', L: '#8f83b8', '.': '#5da648', G: '#4f9440', s: '#d8ba6a', S: '#c9a34e', a: '#427c3c', A: '#376b34', d: '#544a78', D: '#463d6b' };
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
  if (t === 'H' && state.hp < 100) { state.hp = 100; save(); sfx('heal'); message('Centro médico: energía recuperada. 💚'); }
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
  if (here === 'H' || adjacentTo('H')) return message('Centro médico: pasa por encima para curarte gratis.');
  message('No hay nada con lo que interactuar aquí.');
}
function talkToAlex() {
  const lines = [
    'Álex: Te esperaba, míster. Lamine confía en tu proyecto. Busca un cofre al otro lado del camino y comienza a formar el equipo.',
    'Álex: los cofres brillan en el mapa. ¡Ábrelos para conseguir balones contrato!',
    'Álex: debilita a un futbolista en la hierba alta y lánzale un balón contrato. ¡El % de éxito sube cuanto más cansado esté!',
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
  if (state.chapter === 5) { dialog('Sombra: ¿Tú eres la esperanza de la Liga? Mi capitán te enseñará quién controla el mercado.'); setTimeout(() => { closeDialog(); startBossBattle(140); }, 1600); }
  else if (state.chapter === 9) { dialog('Sombra: La final, míster. Todo o nada. Mi equipo oscuro no perdona.'); setTimeout(() => { closeDialog(); startBossBattle(190); }, 1600); }
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

/* ---------------- Batalla ---------------- */
function posMult(att, def) {
  if (BEATS[att] === def) return 1.3;
  if (BEATS[def] === att) return .75;
  return 1;
}
function moveMult(type, hero, rival) {
  let m = 1;
  if (rival.pos === 'POR') m = type === 'shot' ? .7 : type === 'dribble' ? 1.25 : 1;
  else m = posMult(hero.pos, rival.pos);
  if (hero.pos === 'POR') m *= .9; // los porteros no atacan bien
  return m;
}
function captureChance() {
  if (!battle || battle.boss) return 0;
  let c = .15 + (1 - battle.rivalHp / battle.maxHp) * .65;
  if (state.coach === 'ancelotti') c += .08;
  if (state.owned.includes(battle.rival.id)) c += .15;
  return clamp(c, .05, .95);
}
function setBanner(txt, rival) {
  const b = $('#turn-banner');
  b.textContent = txt; b.classList.toggle('rival', !!rival); b.classList.remove('hidden');
}
function hpClass(el, ratio) {
  el.classList.toggle('low', ratio < .5 && ratio >= .22);
  el.classList.toggle('critical', ratio < .22);
}
function popDamage(target, text, kind = '') {
  const bf = $('#battlefield');
  const el = document.createElement('div');
  el.className = `dmg-pop ${kind}`; el.textContent = text;
  const spr = $(target === 'rival' ? '#rival-sprite' : '#hero-sprite');
  const r = spr.getBoundingClientRect(), b = bf.getBoundingClientRect();
  el.style.left = (r.left - b.left + r.width / 2) + 'px';
  el.style.top = (r.top - b.top + 6) + 'px';
  bf.appendChild(el);
  setTimeout(() => el.remove(), 950);
}
function battleText(t) { $('#battle-text').textContent = t; }

function startEncounter() {
  const ids = ENCOUNTER_POOLS[zone()] || STARS.map(s => s.id);
  const available = STARS.filter(s => ids.includes(s.id) && s.id !== state.captain);
  const rival = available[Math.floor(Math.random() * available.length)];
  const maxHp = 85 + randi(0, 30);
  beginBattle({ rival, maxHp, boss: false });
}
function startBossBattle(hp) {
  sfx('boss');
  beginBattle({ rival: SOMBRA_STAR, maxHp: hp, boss: true });
}
function beginBattle({ rival, maxHp, boss }) {
  battle = { rival, maxHp, rivalHp: maxHp, shield: 0, busy: false, exhausted: false, rewarded: false, boss };
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
  drawBattleSprite($('#rival-sprite'), r);
  drawBattleSprite($('#hero-sprite'), hero);
  // Pista de emparejamiento, para que la ventaja táctica se entienda.
  let hint;
  if (battle.boss) hint = '⚠️ Jefe: no puede ser fichado. ¡Agótalo para ganar!';
  else if (r.pos === 'POR') hint = `${hero.pos} vs POR — el portero resiste disparos: usa el regate (+25%).`;
  else {
    const m = posMult(hero.pos, r.pos);
    hint = m > 1 ? `${hero.pos} vs ${r.pos} — ¡ventaja táctica para ti! (+30% daño)`
      : m < 1 ? `${hero.pos} vs ${r.pos} — desventaja táctica (−25% daño)`
      : `${hero.pos} vs ${r.pos} — duelo igualado.`;
  }
  $('#matchup').textContent = '🔺 ' + hint;
  setBanner('TU TURNO');
  updateBattle();
  battleText(battle.boss ? `¡${r.name} salta al campo entre silbidos!` : `¡${r.name} aparece en el campo de entrenamiento!`);
  if (!state.tutorialSeen) openTutorial();
}
function drawBattleSprite(can, p) {
  const c = can.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.clearRect(0, 0, 160, 160);
  c.fillStyle = 'rgba(0,0,0,.22)';
  c.beginPath(); c.ellipse(80, 146, 56, 10, 0, 0, Math.PI * 2); c.fill();
  const img = PORTRAITS[p.id];
  if (img?.complete && img.naturalWidth) { c.drawImage(img, 4, 0, 152, 152); return; }
  if (p.id === 'sombra') { // silueta encapuchada
    c.fillStyle = '#120d24';
    c.beginPath(); c.moveTo(80, 8); c.quadraticCurveTo(20, 40, 30, 150); c.lineTo(130, 150); c.quadraticCurveTo(140, 40, 80, 8); c.fill();
    c.fillStyle = '#ff3355'; c.fillRect(62, 62, 12, 7); c.fillRect(88, 62, 12, 7);
    c.fillStyle = '#ff335522'; c.beginPath(); c.arc(80, 70, 52, 0, Math.PI * 2); c.fill();
    return;
  }
  c.fillStyle = p.color; c.fillRect(34, 22, 92, 122);
  c.fillStyle = 'white'; c.font = 'bold 34px monospace'; c.textAlign = 'center';
  c.fillText(p.short, 80, 95);
}
function updateBattle() {
  const rRatio = battle.rivalHp / battle.maxHp, hRatio = state.hp / 100;
  $('#rival-hp').style.width = Math.max(0, rRatio * 100) + '%';
  $('#hero-hp').style.width = Math.max(0, hRatio * 100) + '%';
  hpClass($('#rival-hp'), rRatio); hpClass($('#hero-hp'), hRatio);
  $('#rival-hp-text').textContent = `${Math.max(0, battle.rivalHp)}/${battle.maxHp}`;
  $('#hero-hp-text').textContent = `${Math.max(0, state.hp)}/100`;
  const lock = battle.busy;
  $$('#battle-menu [data-move]').forEach(b => b.disabled = lock || battle.exhausted);
  $('#drink-btn').disabled = lock || state.drinks < 1 || state.hp >= 100 || battle.exhausted;
  $('#run-btn').disabled = lock;
  const cBtn = $('#contract-btn');
  cBtn.disabled = lock || state.balls < 1 || battle.boss;
  $('#contract-odds').textContent = battle.boss ? 'no disponible contra jefes'
    : state.balls < 1 ? 'sin balones: tienda o cofres'
    : `${state.balls} balones · ${Math.round(captureChance() * 100)}% de éxito`;
}
function attack(type) {
  if (!battle || battle.busy || battle.exhausted) return;
  battle.busy = true; updateBattle();
  sfx('select');
  const hero = STARS.find(s => s.id === state.captain) || STARS[0];
  const mv = MOVES[type];
  const missChance = type === 'shot' ? (state.coach === 'luis' ? .05 : mv.miss) : 0;
  if (Math.random() < missChance) {
    battleText(`¡El disparo de ${hero.name} se marcha fuera!`);
    popDamage('rival', '¡FUERA!', 'miss'); sfx('miss');
    setTimeout(rivalTurn, 900);
    return;
  }
  let dmg = randi(mv.min, mv.max);
  dmg *= moveMult(type, hero, battle.rival);
  if (type === 'dribble' && state.coach === 'guardiola') dmg *= 1.2;
  dmg *= 1 + (state.level - 5) * .02; // el nivel del míster suma poco a poco
  const crit = Math.random() < (state.coach === 'zidane' ? .24 : .12);
  if (crit) dmg *= 1.5;
  dmg = Math.max(1, Math.round(dmg));
  if (type === 'press') battle.shield = state.coach === 'mourinho' ? 22 : mv.shield;
  battle.rivalHp = Math.max(0, battle.rivalHp - dmg);
  const eff = moveMult(type, hero, battle.rival);
  battleText(`${hero.name} usa ${mv.name}.${crit ? ' ¡JUGADA PERFECTA!' : ''}${eff > 1.15 ? ' ¡Es muy eficaz!' : eff < .9 ? ' No es muy eficaz…' : ''}${type === 'press' ? ` Bloqueará ${battle.shield} del próximo golpe.` : ''}`);
  popDamage('rival', `-${dmg}`, crit ? 'crit' : '');
  sfx(crit ? 'crit' : 'hit');
  $('#rival-sprite').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-12px)', filter: 'brightness(2.4)' }, { transform: 'translateX(9px)' }, { transform: 'translateX(0)' }], { duration: 330 });
  updateBattle();
  setTimeout(() => {
    if (!battle) return;
    if (battle.rivalHp <= 0) exhaustRival();
    else rivalTurn();
  }, 900);
}
function exhaustRival() {
  battle.exhausted = true; battle.busy = false;
  if (!battle.rewarded) {
    battle.rewarded = true;
    if (battle.boss) return bossVictory();
    state.wins++;
    state.coins += 20;
    if (zone() === 'Estadio Central') state.stadiumWins++;
    if (state.wins % 3 === 0) state.level = Math.min(30, state.level + 1);
    save(); checkProgress();
  }
  setBanner('¡RIVAL AGOTADO!');
  battleText(`${battle.rival.name} está agotado (+20 🪙). ¡Es el mejor momento para fichar!`);
  updateBattle();
}
function bossVictory() {
  state.bossWins++;
  state.coins += 200; state.balls += 5;
  state.level = Math.min(30, state.level + 2);
  save(); sfx('sign');
  setBanner('¡VICTORIA!');
  battleText('¡Has vencido al equipo de Sombra! +200 🪙 y +5 balones contrato.');
  updateBattle();
  setTimeout(() => { endBattle('bosswin'); checkProgress(); }, 2000);
}
function rivalTurn() {
  if (!battle || battle.exhausted) return;
  setBanner('TURNO RIVAL', true);
  const r = battle.rival;
  const mv = r.moves[Math.floor(Math.random() * r.moves.length)];
  setTimeout(() => {
    if (!battle) return;
    let dmg = randi(8, 18) + Math.max(0, Math.round((r.rating - 86) / 2)) + (battle.boss ? 7 : 0);
    const blocked = Math.min(dmg - 2, battle.shield);
    dmg = Math.max(2, dmg - battle.shield);
    battle.shield = 0;
    state.hp = Math.max(0, state.hp - dmg);
    save();
    battleText(`${r.name} usa ${mv}. ¡Pierdes ${dmg} de energía!${blocked > 0 ? ` (bloqueaste ${blocked})` : ''}`);
    popDamage('hero', `-${dmg}`);
    sfx('hit');
    $('#hero-sprite').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(12px)', filter: 'brightness(2.4)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(0)' }], { duration: 330 });
    updateBattle();
    if (state.hp <= 0) setTimeout(() => endBattle('defeat'), 1200);
    else { battle.busy = false; setBanner('TU TURNO'); updateBattle(); }
  }, 700);
}
function useDrink() {
  if (!battle || battle.busy || state.drinks < 1 || state.hp >= 100 || battle.exhausted) return;
  battle.busy = true; updateBattle();
  state.drinks--;
  const heal = Math.min(35, 100 - state.hp);
  state.hp += heal;
  save(); sfx('heal');
  battleText(`Bebida isotónica: recuperas ${heal} de energía.`);
  popDamage('hero', `+${heal}`, 'heal');
  updateBattle();
  setTimeout(rivalTurn, 900);
}
function contract() {
  if (!battle || battle.busy || battle.boss) return;
  if (state.balls < 1) { battleText('No te quedan balones contrato. Busca cofres o visita la tienda.'); return; }
  battle.busy = true;
  state.balls--; save(); updateBattle();
  battleText('¡Lanzas un balón contrato!');
  const chance = captureChance();
  $('#rival-sprite').animate([{ transform: 'scale(1)' }, { transform: 'scale(.1) rotate(360deg)' }, { transform: 'scale(.1)' }, { transform: 'scale(1)' }], { duration: 1000 });
  setTimeout(() => {
    if (!battle) return;
    if (Math.random() < chance) {
      const isNew = !state.owned.includes(battle.rival.id);
      if (isNew) state.owned.push(battle.rival.id);
      if (!battle.rewarded) {
        battle.rewarded = true;
        state.wins++; state.coins += 30;
        if (zone() === 'Estadio Central') state.stadiumWins++;
        if (state.wins % 3 === 0) state.level = Math.min(30, state.level + 1);
      } else state.coins += 10;
      save(); sfx('sign');
      battleText(isNew ? `¡Fichaje conseguido! ${battle.rival.name} se une a tu equipo. 🎉` : `${battle.rival.name} renueva contigo. +🪙`);
      checkProgress();
      setTimeout(() => endBattle('signed'), 1700);
    } else {
      sfx('fail');
      battleText(`¡${battle.rival.name} rechaza el contrato!`);
      if (battle.exhausted) { battle.busy = false; updateBattle(); }
      else setTimeout(rivalTurn, 900);
    }
  }, 1200);
}
function endBattle(result) {
  battle = null;
  if (result === 'defeat') {
    state.x = 6; state.y = 7; state.hp = 100;
    syncPlayer(); save();
    showView('world-view');
    message('Tu capitán se agotó. Has despertado en el centro médico.');
  } else {
    showView('world-view');
    if (result === 'signed') message('¡Nuevo fichaje en tu vestuario! Míralo en 👥 Equipo.');
    else if (result === 'bosswin') message('¡Sombra se retira entre las sombras…!');
    else message('Has vuelto al mapa.');
  }
  maybeShowStory();
}

/* Tutorial de combate (solo la primera vez). */
const TUTORIAL = [
  { t: '⚔️ ¡Tu primer duelo!', x: 'Es un combate por turnos: eliges una jugada y el rival responde. Cada jugada muestra su daño en el propio botón.' },
  { t: '🔺 Ventaja de posición', x: 'DEL supera a MED, MED a DEF y DEF a DEL (+30% de daño). El portero resiste disparos: contra él, regate. La pista amarilla te lo recuerda en cada duelo.' },
  { t: '⚽ El fichaje', x: 'Cuanta menos energía tenga el rival, mayor el % del botón Fichar. Si lo agotas del todo, la victoria es tuya y el fichaje casi seguro. ¡Suerte, míster!' },
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
    state.captain = b.dataset.id; state.hp = 100;
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
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
