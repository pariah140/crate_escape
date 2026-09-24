import './style.css';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { World } from './world';
import {
  BOATS, PORTS, SHAPE_NAMES, canFitAll, canPlace, jobById, jobsForPort,
  loadSave, occupiedCells, persist, rotatedCells,
  type Job, type Phase, type Piece,
} from './model';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<div class="game-shell">
  <div id="scene" class="scene" aria-label="Colorful isometric harbour game scene"></div>
  <div class="scene-vignette"></div>
  <header class="topbar"><div class="brand-mark" aria-hidden="true">◈</div><div class="brand"><strong>CRATE <span>ESCAPE</span></strong><small>PACK IT · RUN IT · DON'T GET CAUGHT</small></div><div class="topbar-right"><span id="cash" class="coin-pill"></span><button id="sound" class="icon-button" type="button" aria-label="Toggle sound"></button></div></header>
  <div id="view"></div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
</div>`;

const sceneHost = document.querySelector<HTMLElement>('#scene')!;
const view = document.querySelector<HTMLElement>('#view')!;
const toastEl = document.querySelector<HTMLElement>('#toast')!;
const cashEl = document.querySelector<HTMLElement>('#cash')!;
const soundEl = document.querySelector<HTMLButtonElement>('#sound')!;
const world = new World(sceneHost);
const save = loadSave();
world.setBoatColor(BOATS[save.boat].color);

interface RunState {
  x: number; z: number; speed: number; hull: number; maxHull: number; heat: number;
  contact: number; damageCooldown: number; collisions: number; elapsed: number;
  steering: number; holding: boolean; pointer: number | null; deadline: number;
}

let phase: Phase = 'board';
let jobs: Job[] = [];
let pieces: Piece[] = [];
let selected: string | null = null;
let hover: { x: number; y: number } | null = null;
let dragPiece: string | null = null;
let dragMoved = false;
let run: RunState | null = null;
let result: { won: boolean; reason: string; payout: number; base: number; bonus: number; adjustment: number; rep: number } | null = null;
let toastTimer = 0;
let lastHud = 0;
let audioContext: AudioContext | null = null;

const boat = () => BOATS[save.boat];
const holdWidth = () => boat().width;
const holdHeight = () => boat().height;
const money = (value: number) => `$${Math.round(value).toLocaleString()}`;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

function beep(frequency: number, length = 0.08, type: OscillatorType = 'sine'): void {
  if (!save.sound) return;
  try {
    audioContext ??= new AudioContext();
    const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + length);
    osc.connect(gain).connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + length);
  } catch { /* Audio is optional. */ }
}

function tick(): void { beep(530, 0.06, 'triangle'); Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined); }
function notify(message: string, tone: 'info' | 'success' | 'danger' = 'info'): void {
  toastEl.textContent = message; toastEl.dataset.tone = tone; toastEl.classList.add('visible');
  window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toastEl.classList.remove('visible'), 3200);
}
function saveProgress(): void { persist(save); updateChrome(); }
function updateChrome(): void {
  cashEl.innerHTML = `<span aria-hidden="true">●</span> ${money(save.cash)}`;
  soundEl.innerHTML = save.sound ? '♪' : '♩'; soundEl.setAttribute('aria-label', save.sound ? 'Mute sound' : 'Turn on sound');
}

function jobCard(job: Job): string {
  const accepted = jobs.some(item => item.id === job.id);
  const count = job.shapes.reduce((sum, shape) => sum + rotatedCells(shape, 0).length, 0);
  const heat = '◆'.repeat(job.heat) + '<span class="heat-empty">◇</span>'.repeat(5 - job.heat);
  return `<article class="job-card" style="--cargo:${job.color}">
    <div class="job-symbol" aria-hidden="true">${job.icon}</div>
    <div class="job-content"><div class="job-top"><span class="eyebrow">${escapeHtml(job.client)}</span><span class="job-pay">${money(job.payout)}</span></div>
      <h3>${escapeHtml(job.cargo)}</h3><p>${escapeHtml(job.note)}</p>
      <div class="job-meta"><span>${count} hold cells</span><span>${escapeHtml(job.destination)}</span><span aria-label="Heat ${job.heat} of 5">${heat}</span></div>
    </div><button class="job-add ${accepted ? 'is-added' : ''}" type="button" data-action="${accepted ? 'remove-job' : 'add-job'}" data-id="${job.id}" aria-label="${accepted ? 'Remove' : 'Take'} ${escapeHtml(job.cargo)} job">${accepted ? '✓' : '+'}</button>
  </article>`;
}

function headerStep(step: string, title: string, subtitle: string): string {
  return `<div class="panel-head"><div class="step-label"><span class="step-dot"></span>${step}</div><h1>${title}</h1><p>${subtitle}</p></div>`;
}

function renderBoard(): void {
  const portJobs = jobsForPort(save.port);
  const selectedPayout = jobs.reduce((sum, job) => sum + job.payout, 0);
  view.innerHTML = `<main class="side-panel board-panel" aria-label="Job board">
    ${headerStep('01 / PICK A DELIVERY', 'The job board', `A little cargo. A little chaos. Sailing from ${PORTS[save.port]}.`)}
    <div class="port-strip"><div class="port-illustration" aria-hidden="true">⚓</div><div><span class="eyebrow">CURRENT PORT</span><strong>${PORTS[save.port]}</strong></div><span class="port-weather">☀ FAIR SEAS</span></div>
    <div class="section-heading"><span>AVAILABLE JOBS</span><span>${portJobs.length} TO PICK FROM</span></div>
    <div class="job-list">${portJobs.map(jobCard).join('')}</div>
    <div class="panel-foot"><div class="summary"><span>${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} aboard</span><strong>${money(selectedPayout)} possible</strong></div>
      <button class="primary-button" type="button" data-action="pack" ${jobs.length ? '' : 'disabled'}>Pack the hold <span>→</span></button>
      <button class="text-button" type="button" data-action="yard">Visit the shipyard <span>↗</span></button>
    </div>
  </main><div class="scene-caption"><span class="caption-badge">WELCOME TO ${PORTS[save.port].toUpperCase()}</span><strong>Small boat. Big plans.</strong><span>Pick a job and make a clean getaway.</span></div>`;
}

function ownerAt(x: number, y: number): Piece | undefined {
  return pieces.find(piece => occupiedCells(piece).some(([cx, cy]) => cx === x && cy === y));
}

function renderShape(shape: Piece['shape'], rotation: number): string {
  const cells = rotatedCells(shape, rotation);
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  return `<span class="mini-shape" style="--mini-w:${width};--mini-h:${height}">${Array.from({ length: width * height }, (_, i) => cells.some(([x, y]) => x === i % width && y === Math.floor(i / width)) ? '<i></i>' : '<b></b>').join('')}</span>`;
}

function renderPack(): void {
  const selectedPiece = pieces.find(piece => piece.id === selected && piece.x === null);
  const packed = pieces.filter(piece => piece.x !== null).length;
  const filled = pieces.reduce((sum, piece) => sum + occupiedCells(piece).length, 0);
  const total = holdWidth() * holdHeight();
  const preview = new Set<string>();
  let previewValid = false;
  if (selectedPiece && hover) {
    const { x: hoverX, y: hoverY } = hover;
    previewValid = canPlace(selectedPiece, hoverX, hoverY, pieces, holdWidth(), holdHeight());
    rotatedCells(selectedPiece.shape, selectedPiece.rotation).forEach(([cx, cy]) => preview.add(`${hoverX + cx},${hoverY + cy}`));
  }
  const cells = Array.from({ length: total }, (_, i) => {
    const x = i % holdWidth(), y = Math.floor(i / holdWidth());
    const owner = ownerAt(x, y); const job = owner ? jobById(owner.jobId) : undefined;
    const isPreview = preview.has(`${x},${y}`);
    const label = owner ? `${job?.cargo || 'Crate'}; tap to pick up` : `Empty hold cell, column ${x + 1}, row ${y + 1}`;
    return `<button class="hold-cell ${owner ? 'filled' : ''} ${isPreview ? previewValid ? 'preview-valid' : 'preview-invalid' : ''}" type="button" data-action="cell" data-x="${x}" data-y="${y}" style="--cell-color:${job?.color || '#e7cda5'}" aria-label="${escapeHtml(label)}">${owner ? `<span>${job?.icon || '■'}</span>` : '<span aria-hidden="true">+</span>'}</button>`;
  }).join('');
  const unpacked = pieces.filter(piece => piece.x === null);
  view.innerHTML = `<main class="side-panel pack-panel" aria-label="Cargo hold">
    ${headerStep('02 / MAKE IT FIT', 'Pack the hold', 'Tap a crate, then a square. Dragging works too. Rotate awkward pieces before placing.')}
    <div class="hold-header"><div><span class="eyebrow">${boat().name.toUpperCase()} · ${holdWidth()} × ${holdHeight()} HOLD</span><strong>${filled} / ${total} cells filled</strong></div><div class="fill-ring" style="--fill:${filled / total * 100}%"><span>${Math.round(filled / total * 100)}%</span></div></div>
    <div class="hold-wrap"><div id="hold-grid" class="hold-grid" style="--cols:${holdWidth()}">${cells}</div><div class="hold-bow" aria-hidden="true">▲ BOW</div></div>
    <div class="pack-help"><span>☝ Pick up: tap a packed crate</span><span>↻ Rotate: button or R</span></div>
    <div class="tray-heading"><span>CRATE TRAY</span><span>${packed}/${pieces.length} PACKED</span></div>
    <div class="crate-tray">${unpacked.length ? unpacked.map(piece => { const job = jobById(piece.jobId)!; return `<button class="crate-chip ${selected === piece.id ? 'selected' : ''}" style="--cargo:${job.color}" type="button" data-action="select-piece" data-id="${piece.id}" aria-pressed="${selected === piece.id}" aria-label="Select ${SHAPE_NAMES[piece.shape]} ${job.cargo} crate">${renderShape(piece.shape, piece.rotation)}<span><strong>${escapeHtml(job.cargo)}</strong><small>${SHAPE_NAMES[piece.shape]}</small></span></button>`; }).join('') : '<div class="tray-empty">Everything is tucked in. Nice packing.</div>'}</div>
    <div class="pack-actions"><button class="secondary-button" type="button" data-action="rotate" ${selectedPiece ? '' : 'disabled'}>↻ Rotate crate</button><button class="primary-button" type="button" data-action="sail" ${packed === pieces.length && pieces.length ? '' : 'disabled'}>Set sail <span>→</span></button></div>
    <div class="pack-footer"><button class="text-button" type="button" data-action="board">← Back to jobs</button><span>${filled === total ? '★ PERFECT PACK +10%' : `${total - filled} spaces left · fill them for +10%`}</span></div>
  </main><div class="scene-caption"><span class="caption-badge">CARGO MANIFEST</span><strong>Every square counts.</strong><span>Perfect Pack pays 10% extra.</span></div>`;
}

function renderRun(): void {
  view.innerHTML = `<main class="run-overlay" aria-label="Boat run">
    <div class="run-top"><div class="run-stat"><span>ROUTE</span><strong id="route-progress">0%</strong><div class="meter"><i id="route-fill"></i></div></div><div class="run-stat"><span>HULL</span><strong id="hull-number">100%</strong><div class="meter"><i id="hull-fill"></i></div></div><div class="run-stat heat-stat"><span>HEAT</span><strong id="heat-number">LOW</strong><div class="meter"><i id="heat-fill"></i></div></div></div>
    <div class="run-bottom"><div class="run-instruction"><strong>DRAG TO STEER</strong><span>Hold to speed up · release to coast</span></div><div id="run-timer" class="run-timer">00:00</div></div>
    <div id="steer-zone" class="steer-zone" aria-label="Drag here to steer boat"></div>
  </main>`;
  updateHud();
}

function renderResult(): void {
  if (!result) return;
  const icon = result.won ? '✦' : '↝';
  view.innerHTML = `<main class="result-screen"><div class="result-card ${result.won ? 'success' : 'failure'}">
    <div class="result-icon" aria-hidden="true">${icon}</div><span class="eyebrow">${result.won ? 'DELIVERY COMPLETE' : 'RUN ENDED'}</span>
    <h1>${result.won ? 'Made it in one piece!' : result.reason === 'caught' ? 'Caught by the Patrol!' : 'The boat took a bath.'}</h1>
    <p>${result.won ? 'The cargo is ashore and nobody asked any questions.' : 'The cargo is gone, but your boat and upgrades are safe. Try another route.'}</p>
    ${result.won ? `<div class="receipt"><div><span>Delivery pay</span><strong>${money(result.base)}</strong></div><div><span>Perfect Pack</span><strong>+${money(result.bonus)}</strong></div>${result.adjustment ? `<div><span>Cargo wear / delay</span><strong>−${money(result.adjustment)}</strong></div>` : ''}<div class="receipt-total"><span>Cash earned</span><strong>${money(result.payout)}</strong></div></div><div class="rep-note">★ +${result.rep} reputation</div>` : `<div class="failure-note">No payout this time · -${Math.abs(result.rep)} reputation</div>`}
    <button class="primary-button" type="button" data-action="next">${result.won ? 'Next delivery' : 'Try again'} <span>→</span></button>
    ${result.won ? '<button class="secondary-button full share-button" type="button" data-action="share">Share this run ↗</button>' : ''}
    <button class="text-button" type="button" data-action="yard">Visit the shipyard ↗</button>
  </div></main>`;
}

function renderYard(): void {
  const nextBoat = BOATS[1];
  const speedPrice = 90 + save.upgrades.engine * 75;
  const hullPrice = 85 + save.upgrades.hull * 70;
  view.innerHTML = `<main class="side-panel yard-panel" aria-label="Shipyard">
    ${headerStep('THE SHIPYARD', 'Make waves.', 'A sturdier boat means bigger cargo and bolder routes.')}
    <div class="yard-current"><div class="yard-boat-art" aria-hidden="true">⛵</div><div><span class="eyebrow">YOUR BOAT</span><h2>${boat().name}</h2><p>${boat().description}</p></div></div>
    <div class="yard-stats"><div><span>HOLD</span><strong>${holdWidth()} × ${holdHeight()}</strong></div><div><span>SPEED</span><strong>${Math.round((boat().speed + save.upgrades.engine * 0.09) * 100)}%</strong></div><div><span>HULL</span><strong>${boat().hull + save.upgrades.hull * 15}</strong></div></div>
    <div class="section-heading"><span>UPGRADES</span><span>KEEP FOREVER</span></div>
    <div class="upgrade-list"><div class="upgrade"><div><span class="upgrade-icon">↗</span><strong>Better engine</strong><small>Go faster · level ${save.upgrades.engine}/3</small></div><button class="buy-button" type="button" data-action="engine" ${save.upgrades.engine >= 3 || save.cash < speedPrice ? 'disabled' : ''}>${save.upgrades.engine >= 3 ? 'MAX' : money(speedPrice)}</button></div>
    <div class="upgrade"><div><span class="upgrade-icon">♥</span><strong>Reinforced hull</strong><small>Take more bumps · level ${save.upgrades.hull}/3</small></div><button class="buy-button" type="button" data-action="hull" ${save.upgrades.hull >= 3 || save.cash < hullPrice ? 'disabled' : ''}>${save.upgrades.hull >= 3 ? 'MAX' : money(hullPrice)}</button></div></div>
    ${save.boat === 0 ? `<div class="next-boat"><span class="eyebrow">NEXT BOAT · UNLOCKS FOGBANK HARBOUR</span><h3>${nextBoat.name}</h3><p>More cargo space. Faster escapes. Yellow paint.</p><div class="next-boat-bottom"><span>5 × 3 HOLD</span><button class="primary-button" type="button" data-action="buy-boat" ${save.cash < nextBoat.price ? 'disabled' : ''}>Buy for ${money(nextBoat.price)}</button></div></div>` : `<div class="next-boat owned"><span class="eyebrow">NEW PORT OPEN</span><h3>Fogbank Harbour</h3><p>Longer trips and stranger cargo.</p><button class="secondary-button" type="button" data-action="port">${save.port === 0 ? 'Sail from Fogbank' : 'Sail from Sleepy Cove'}</button></div>`}
    <div class="panel-foot"><button class="secondary-button full" type="button" data-action="board">← Back to the job board</button></div>
  </main><div class="scene-caption"><span class="caption-badge">THE SHIPYARD</span><strong>Good boats get better.</strong><span>Your boat survives every rough run.</span></div>`;
}

function render(): void {
  updateChrome();
  if (phase === 'board') renderBoard();
  if (phase === 'pack') renderPack();
  if (phase === 'run') renderRun();
  if (phase === 'result') renderResult();
  if (phase === 'yard') renderYard();
}

function addJob(id: string): void {
  const job = jobsForPort(save.port).find(item => item.id === id);
  if (!job || jobs.some(item => item.id === id)) return;
  const nextPieces = [...pieces, ...job.shapes.map((shape, index): Piece => ({ id: `${job.id}-${index}`, jobId: job.id, shape, rotation: 0, x: null, y: null }))];
  if (!canFitAll(nextPieces, holdWidth(), holdHeight())) { notify('That cargo will not fit. Move crates or choose a smaller job.', 'danger'); beep(210, 0.13, 'sawtooth'); return; }
  jobs.push(job); pieces = nextPieces; tick(); render(); notify(`${job.cargo} added to the manifest.`, 'success');
}

function removeJob(id: string): void {
  jobs = jobs.filter(job => job.id !== id); pieces = pieces.filter(piece => piece.jobId !== id);
  if (selected && !pieces.some(piece => piece.id === selected)) selected = null;
  tick(); render(); notify('Job removed from the manifest.');
}

function placeAt(x: number, y: number): void {
  const owner = ownerAt(x, y);
  if (owner) {
    owner.x = null; owner.y = null; selected = owner.id; hover = null; tick(); render();
    notify('Crate picked up. Tap a new square to move it.'); return;
  }
  const piece = pieces.find(item => item.id === selected);
  if (!piece) { notify('Choose a crate from the tray first.'); return; }
  if (!canPlace(piece, x, y, pieces, holdWidth(), holdHeight())) { notify(jobById(piece.jobId)?.kind === 'vip' ? 'VIP cargo must cover a centre square and fit inside the hold.' : 'That crate overlaps or hangs over the side.', 'danger'); beep(210, 0.1, 'sawtooth'); return; }
  piece.x = x; piece.y = y; selected = pieces.find(item => item.x === null)?.id || null;
  hover = null; tick(); render();
  if (pieces.every(item => item.x !== null)) notify('All cargo secured. Set sail when ready!', 'success');
}

function beginRun(): void {
  if (!pieces.length || pieces.some(piece => piece.x === null)) return;
  const maxHull = boat().hull + save.upgrades.hull * 15;
  run = { x: 0, z: 0, speed: 5.7, hull: maxHull, maxHull, heat: jobs.reduce((sum, job) => sum + (job.kind === 'hot' ? 7 : 0), 0), contact: 0, damageCooldown: 0, collisions: 0, elapsed: 0, steering: 0, holding: false, pointer: null, deadline: jobs.some(job => job.kind === 'perishable') ? 70 : Infinity };
  phase = 'run'; render(); beep(400, 0.15, 'triangle'); notify('Cargo aboard. Follow the open water!', 'success');
}

function updateHud(): void {
  if (!run) return;
  const progress = Math.min(100, Math.round(run.z / 520 * 100));
  const hull = Math.max(0, Math.round(run.hull / run.maxHull * 100));
  const heat = Math.round(run.heat);
  const set = (id: string, value: string) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  const fill = (id: string, value: number) => { const el = document.getElementById(id); if (el) el.style.width = `${value}%`; };
  set('route-progress', `${progress}%`); fill('route-fill', progress);
  set('hull-number', `${hull}%`); fill('hull-fill', hull);
  set('heat-number', heat < 35 ? 'LOW' : heat < 70 ? 'WARM' : 'HOT!'); fill('heat-fill', heat);
  const minutes = Math.floor(run.elapsed / 60).toString().padStart(2, '0');
  const seconds = Math.floor(run.elapsed % 60).toString().padStart(2, '0');
  set('run-timer', `${minutes}:${seconds}`);
}

function endRun(won: boolean, reason: string): void {
  if (!run || phase !== 'run') return;
  const base = jobs.reduce((sum, job) => sum + job.payout, 0);
  const full = pieces.reduce((sum, piece) => sum + occupiedCells(piece).length, 0) === holdWidth() * holdHeight();
  const bonus = won && full ? Math.round(base * 0.1) : 0;
  let payout = won ? base + bonus : 0;
  if (won && jobs.some(job => job.kind === 'fragile')) payout = Math.max(0, payout - Math.round(base * Math.min(run.collisions * 0.2, 0.8)));
  if (won && jobs.some(job => job.kind === 'perishable') && run.elapsed > run.deadline) payout = Math.round(payout * 0.7);
  const adjustment = won ? base + bonus - payout : 0;
  const rep = won ? 8 + jobs.length * 4 : -3;
  save.cash += payout; save.reputation = Math.max(0, save.reputation + rep); save.runs++;
  result = { won, reason, payout, base, bonus, adjustment, rep };
  run = null; phase = 'result'; saveProgress(); render();
  beep(won ? 660 : 180, 0.25, won ? 'triangle' : 'sawtooth');
  if (won) window.setTimeout(() => beep(880, 0.22, 'triangle'), 110);
}

function updateRun(dt: number): void {
  if (!run || phase !== 'run') return;
  run.elapsed += dt; run.damageCooldown = Math.max(0, run.damageCooldown - dt);
  const maxSpeed = (run.holding ? 9.8 : 6.1) * (boat().speed + save.upgrades.engine * 0.09);
  run.speed += (maxSpeed - run.speed) * Math.min(1, dt * (run.holding ? 1.5 : 0.75));
  run.x += Math.max(-1, Math.min(1, run.steering - run.x)) * Math.min(1, dt * (run.holding ? 4.2 : 2.1));
  run.x = Math.max(-6.8, Math.min(6.8, run.x)); run.z += run.speed * dt;
  const hotCargo = jobs.some(job => job.kind === 'hot');
  let spotted = false;
  let contact = false;
  for (const patrol of world.patrols) {
    const dz = run.z - patrol.mesh.position.z;
    const dx = Math.abs(run.x - patrol.x);
    if (dz > -12 && dz < -2 && dx < 3.1 + (hotCargo ? 0.8 : 0)) spotted = true;
    if (Math.abs(dz) < 1.8 && dx < 1.8) contact = true;
  }
  run.contact = contact ? run.contact + dt : Math.max(0, run.contact - dt * 1.5);
  run.heat = Math.max(hotCargo ? 12 : 0, Math.min(100, run.heat + (spotted ? 37 : hotCargo ? -2 : -8) * dt));
  if (spotted && run.heat > 50 && Math.floor(run.elapsed * 2) % 5 === 0) beep(340, 0.08, 'square');
  if (run.contact >= 2) { endRun(false, 'caught'); return; }
  for (const hazard of world.hazards) {
    if (Math.abs(run.z - hazard.z) < hazard.radius + 0.9 && Math.abs(run.x - hazard.x) < hazard.radius + 0.9 && run.damageCooldown === 0) {
      run.hull = Math.max(0, run.hull - (hazard.kind === 'rock' ? 24 : 12));
      run.collisions++; run.speed *= 0.6; run.damageCooldown = 1.25;
      beep(135, 0.22, 'sawtooth'); Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
      notify(hazard.kind === 'rock' ? 'Rock! Steer into open water.' : 'Buoy bump! Watch the channel.', 'danger');
      if (run.hull <= 0) { endRun(false, 'sunk'); return; }
    }
  }
  if (run.z >= 520) { endRun(true, 'delivered'); return; }
  if (performance.now() - lastHud > 90) { updateHud(); lastHud = performance.now(); }
}

function handleAction(action: string, id?: string, target?: HTMLElement): void {
  if (action === 'add-job' && id) addJob(id);
  else if (action === 'remove-job' && id) removeJob(id);
  else if (action === 'pack' && jobs.length) { phase = 'pack'; selected = pieces.find(piece => piece.x === null)?.id || null; render(); }
  else if (action === 'board') { phase = 'board'; render(); }
  else if (action === 'yard') { phase = 'yard'; render(); }
  else if (action === 'select-piece' && id) { selected = id; tick(); render(); }
  else if (action === 'rotate') { const piece = pieces.find(item => item.id === selected); if (piece && piece.x === null) { piece.rotation = (piece.rotation + 1) % 4; tick(); render(); } }
  else if (action === 'cell' && target) placeAt(Number(target.dataset.x), Number(target.dataset.y));
  else if (action === 'sail') beginRun();
  else if (action === 'next') { jobs = []; pieces = []; selected = null; phase = 'board'; render(); }
  else if (action === 'share' && result?.won) {
    const text = `I delivered ${jobs.map(job => job.cargo).join(', ')} in Crate Escape and earned ${money(result.payout)}. Pack it. Run it. Don't get caught!`;
    Share.share({ title: 'Crate Escape', text }).catch(async () => {
      try { await navigator.clipboard.writeText(text); notify('Run story copied to clipboard.', 'success'); }
      catch { notify('Sharing is unavailable on this device.', 'danger'); }
    });
  }
  else if (action === 'engine' || action === 'hull') {
    const level = save.upgrades[action]; const cost = (action === 'engine' ? 90 : 85) + level * (action === 'engine' ? 75 : 70);
    if (level >= 3 || save.cash < cost) return;
    save.cash -= cost; save.upgrades[action]++; saveProgress(); tick(); render(); notify(`${action === 'engine' ? 'Engine' : 'Hull'} upgraded.`, 'success');
  }
  else if (action === 'buy-boat' && save.boat === 0 && save.cash >= BOATS[1].price) {
    save.cash -= BOATS[1].price; save.boat = 1; save.port = 1; jobs = []; pieces = [];
    world.setBoatColor(BOATS[1].color); saveProgress(); tick(); render(); notify('Skipjack is yours. Fogbank Harbour is open!', 'success');
  }
  else if (action === 'port' && save.boat === 1) { save.port = save.port === 0 ? 1 : 0; jobs = []; pieces = []; saveProgress(); tick(); render(); notify(`Now sailing from ${PORTS[save.port]}.`); }
}

view.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (target && !((target as HTMLButtonElement).disabled)) handleAction(target.dataset.action!, target.dataset.id, target);
});

view.addEventListener('pointerdown', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action="select-piece"]');
  if (phase === 'pack' && target) { dragPiece = target.dataset.id!; dragMoved = false; }
  if (phase === 'run' && (event.target as HTMLElement).closest('.steer-zone') && run) {
    run.pointer = event.pointerId; run.holding = true; sceneHost.classList.add('steering');
    steerFromPointer(event.clientX);
  }
});

function steerFromPointer(clientX: number): void {
  if (!run) return;
  const rect = sceneHost.getBoundingClientRect();
  run.steering = Math.max(-6.7, Math.min(6.7, ((clientX - rect.left) / rect.width - 0.5) * 16));
}

window.addEventListener('pointermove', event => {
  if (phase === 'run' && run?.pointer === event.pointerId) { steerFromPointer(event.clientX); return; }
  if (phase !== 'pack') return;
  const el = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.hold-cell');
  if (dragPiece) { dragMoved = true; if (selected !== dragPiece) selected = dragPiece; }
  const next = el ? { x: Number(el.dataset.x), y: Number(el.dataset.y) } : null;
  if (next?.x !== hover?.x || next?.y !== hover?.y) { hover = next; renderPack(); }
});

window.addEventListener('pointerup', event => {
  if (phase === 'run' && run?.pointer === event.pointerId) { run.holding = false; run.pointer = null; sceneHost.classList.remove('steering'); return; }
  if (phase === 'pack' && dragPiece) {
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.hold-cell');
    if (cell && dragMoved) { selected = dragPiece; placeAt(Number(cell.dataset.x), Number(cell.dataset.y)); }
    dragPiece = null;
  }
});

window.addEventListener('keydown', event => {
  if (phase === 'pack' && (event.key === 'r' || event.key === 'R')) { event.preventDefault(); handleAction('rotate'); }
  if (phase === 'run' && run) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'a', 'd', 'w', 'A', 'D', 'W'].includes(event.key)) event.preventDefault();
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { run.steering = -6.7; run.holding = true; }
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { run.steering = 6.7; run.holding = true; }
    if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') run.holding = true;
  }
});
window.addEventListener('keyup', event => {
  if (phase === 'run' && run && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'a', 'd', 'w', 'A', 'D', 'W'].includes(event.key)) {
    run.holding = false; run.steering = run.x;
  }
});

soundEl.addEventListener('click', () => { save.sound = !save.sound; saveProgress(); if (save.sound) beep(620); });

let previous = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - previous) / 1000, 0.05); previous = now;
  if (phase === 'run') updateRun(dt);
  world.update(dt, phase === 'run', run?.x || 0, run?.z || 0, run?.heat || 0, run?.speed || 0);
  requestAnimationFrame(frame);
}

render(); requestAnimationFrame(frame);
