import './style.css';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { World } from './world';
import { advanceMotion } from './piloting';
import { canDock, channelCenter, currentPush, destinationX, levelPlan, offshoreState, roughWaterPush, ROUTE_END, weatherPush, type LevelPlan } from './levels';
import { heardBySoundPatrol, inVisionCone, sightProfile } from './patrols';
import {
  BOATS, PORTS, HARBORS, SHAPE_NAMES, canFitAll, canPlace, jobById, jobsForPort,
  loadSave, occupiedCells, persist, rotatedCells, usableCells, isBlocked, boatUpgrade, repairCost, rareChance, specialOfferFor,
  harborRequirements, refreshHarborUnlocks,
  BACKUP_BOAT_INDEX, MIN_SEAWORTHY_CONDITION,
  type Job, type Phase, type Piece,
} from './model';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<div class="game-shell">
  <div id="scene" class="scene" aria-label="Colorful isometric harbour game scene"></div>
  <div class="scene-vignette"></div>
  <header class="topbar"><div class="brand-mark" aria-hidden="true">◈</div><div class="brand"><strong>CRATE <span>ESCAPE</span></strong><small>PACK IT · RUN IT · DON'T GET CAUGHT</small></div><div class="topbar-right"><span id="cash" class="coin-pill"></span><button id="sound" class="icon-button" type="button" aria-label="Toggle sound"></button></div></header>
  <div id="view"></div>
  <div id="damage-flash" class="damage-flash" aria-hidden="true"></div>
  <div id="damage-callout" class="damage-callout" role="status" aria-live="polite"></div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
</div>`;
const gameShell = app.querySelector<HTMLElement>('.game-shell')!;

const sceneHost = document.querySelector<HTMLElement>('#scene')!;
const view = document.querySelector<HTMLElement>('#view')!;
const toastEl = document.querySelector<HTMLElement>('#toast')!;
const damageFlashEl = document.querySelector<HTMLElement>('#damage-flash')!;
const damageCalloutEl = document.querySelector<HTMLElement>('#damage-callout')!;
const cashEl = document.querySelector<HTMLElement>('#cash')!;
const soundEl = document.querySelector<HTMLButtonElement>('#sound')!;
const world = new World(sceneHost);
const save = loadSave();
world.setBoat(BOATS[save.boat]);
let currentPlan: LevelPlan = levelPlan(save.level, save.port);
world.configureLevel(currentPlan);

interface RunState {
  x: number; z: number; vx: number; vz: number; speed: number; hull: number; maxHull: number; heat: number;
  contact: number; damageCooldown: number; collisions: number; elapsed: number;
  holding: boolean; pointer: number | null; pointerX: number; pointerY: number;
  pointerStartX: number; pointerStartY: number; pointerDownAt: number; pointerMoved: boolean;
  dragOriginX: number; dragOriginZ: number;
  tapTarget: { x: number; z: number } | null; deadline: number; patrolHeat: number; hotCargo: boolean; ending: boolean;
  heading: number; engineOn: boolean; lightsOn: boolean; tutorialOpen: boolean; tutorialPending: boolean; soundExposure: number; offshoreTime: number;
}

let phase: Phase = 'board';
let yardSelected: number | null = null;
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
const heldKeys = new Set<string>();

const boat = () => BOATS[save.boat];
const holdWidth = () => boat().width;
const holdHeight = () => boat().height;
const holdCapacity = () => usableCells(boat());
const availableJobs = () => jobsForPort(save.port, specialOfferFor(save));
const money = (value: number) => `$${Math.round(value).toLocaleString()}`;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const heatExplanation = 'More diamonds mean more patrol attention. A 1/5 job is quiet; a 5/5 job starts hotter and patrols spot you sooner. Hot cargo cools down more slowly.';

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

function piecesForJob(job: Job): Piece[] {
  return job.shapes.map((shape, index) => ({ id: `${job.id}-${index}`, jobId: job.id, shape, rotation: 0, x: null, y: null }));
}

function jobCard(job: Job, remaining: number, payoutMultiplier: number): string {
  const accepted = jobs.some(item => item.id === job.id);
  const count = job.shapes.reduce((sum, shape) => sum + rotatedCells(shape, 0).length, 0);
  const fits = accepted || (count <= remaining && canFitAll([...pieces, ...piecesForJob(job)], holdWidth(), holdHeight(), boat().blocked));
  const noFitReason = count > remaining ? 'Not enough cells' : 'Crate shapes will not fit';
  const heat = '◆'.repeat(job.heat) + '<span class="heat-empty">◇</span>'.repeat(5 - job.heat);
  return `<article class="job-card ${fits ? '' : 'cannot-fit'}" style="--cargo:${job.color}">
    <div class="job-symbol" aria-hidden="true">${job.icon}</div>
    <div class="job-content"><div class="job-top"><span class="eyebrow">${job.rare ? '✦ RARE SPECIAL · ' : ''}${escapeHtml(job.client)}</span><span class="job-pay" title="Includes voyage pay multiplier ×${payoutMultiplier.toFixed(2)}">${money(job.payout * payoutMultiplier)}</span></div>
      <h3>${escapeHtml(job.cargo)}</h3><p>${escapeHtml(job.note)}</p>
      <div class="job-meta"><span>${count} hold cells</span><span>${escapeHtml(job.destination)}</span><span class="heat-rating" aria-label="Patrol heat ${job.heat} out of 5" title="Patrol heat ${job.heat}/5: higher heat makes patrols notice you sooner."><span aria-hidden="true">${heat}</span> HEAT ${job.heat}/5</span>${fits ? '' : `<span class="job-fit-note">${noFitReason}</span>`}</div>
    </div><button class="job-add ${accepted ? 'is-added' : ''} ${fits ? '' : 'is-unavailable'}" type="button" data-action="${accepted ? 'remove-job' : 'add-job'}" data-id="${job.id}" aria-label="${fits ? `${accepted ? 'Remove' : 'Take'} ${escapeHtml(job.cargo)} job` : `${noFitReason} for ${escapeHtml(job.cargo)}`}" ${fits ? '' : 'disabled'}>${accepted ? '✓' : fits ? '+' : count > remaining ? 'FULL' : 'NO FIT'}</button>
  </article>`;
}

function headerStep(step: string, title: string, subtitle: string): string {
  return `<div class="panel-head"><div class="step-label"><span class="step-dot"></span>${step}</div><h1>${title}</h1><p>${subtitle}</p></div>`;
}

function renderBoard(): void {
  const previousScroll = view.querySelector<HTMLElement>('.board-panel')?.scrollTop ?? 0;
  if (currentPlan.number !== save.level || currentPlan.port !== save.port) {
    currentPlan = levelPlan(save.level, save.port); world.configureLevel(currentPlan);
  }
  const portJobs = availableJobs();
  const plan = currentPlan;
  const selectedPayout = Math.round(jobs.reduce((sum, job) => sum + job.payout, 0) * plan.payoutMultiplier);
  const totalCells = holdCapacity();
  const usedCells = pieces.reduce((sum, piece) => sum + rotatedCells(piece.shape, 0).length, 0);
  const remainingCells = totalCells - usedCells;
  view.innerHTML = `<main class="side-panel board-panel" aria-label="Job board">
    ${headerStep('01 / PICK A DELIVERY', 'The job board', `A little cargo. A little chaos. Sailing from ${PORTS[save.port]}.`)}
    <div class="port-strip"><div class="port-illustration" aria-hidden="true">⚓</div><div><span class="eyebrow">CURRENT PORT</span><strong>${PORTS[save.port]}</strong></div><button class="port-map-link" type="button" data-action="map">View map →</button></div>
    <div class="level-strip"><span>VOYAGE ${save.level} · ${HARBORS[save.port].name.toUpperCase()}</span><strong>${plan.night ? '☾ NIGHT · ' : ''}${plan.weather.toUpperCase()} SEAS</strong><small>${plan.hazards.length} obstacles · ${plan.currents.length} currents · ${plan.patrols.length} patrols · ×${plan.payoutMultiplier.toFixed(2)} pay</small></div>
    <div class="capacity-strip" aria-label="Cargo hold capacity">
      <div class="capacity-main"><div><span class="eyebrow">${boat().name.toUpperCase()} · ${holdWidth()} × ${holdHeight()} HOLD</span><strong>${usedCells} / ${totalCells} cells booked</strong></div><span class="capacity-left">${remainingCells} left</span></div>
      <div class="capacity-meter" role="progressbar" aria-label="Cargo hold cells booked" aria-valuemin="0" aria-valuemax="${totalCells}" aria-valuenow="${usedCells}"><span style="width:${usedCells / totalCells * 100}%"></span></div>
      <p>Jobs use different amounts of space. Crate shapes must fit the outlined hold.</p>
    </div>
    ${save.boat !== BACKUP_BOAT_INDEX && (save.boatCondition[save.boat] ?? 100) < MIN_SEAWORTHY_CONDITION ? `<div class="boat-repair-warning">⚒ ${boat().name} is at ${save.boatCondition[save.boat]}% condition and needs repairs before sailing. <button type="button" data-action="yard">Open the shipyard →</button></div>` : ''}
    <div class="section-heading"><span>AVAILABLE JOBS · ${portJobs.length} TO PICK FROM</span><details class="heat-guide"><summary aria-label="Patrol heat: more diamonds mean more patrol attention. Show details." title="${heatExplanation}">HEAT? <span aria-hidden="true">ⓘ</span></summary><p>${heatExplanation}</p></details></div>
    <div class="job-list">${portJobs.map(job => jobCard(job, remainingCells, plan.payoutMultiplier)).join('')}</div>
    <div class="panel-foot"><div class="summary"><span>${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} aboard</span><strong>${money(selectedPayout)} possible</strong></div>
      <button class="primary-button" type="button" data-action="pack" ${jobs.length ? '' : 'disabled'}>Pack the hold <span>→</span></button>
      <div class="board-links"><button class="text-button" type="button" data-action="yard">⚓ Shipyard</button><button class="text-button" type="button" data-action="market">◈ Boat marketplace</button><button class="text-button" type="button" data-action="map">✦ Harbor map</button></div>
    </div>
  </main><div class="scene-caption"><span class="caption-badge">WELCOME TO ${PORTS[save.port].toUpperCase()}</span><strong>Small boat. Big plans.</strong><span>Pick a job and make a clean getaway.</span></div>`;
  view.querySelector<HTMLElement>('.board-panel')!.scrollTop = previousScroll;
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
  const total = holdCapacity();
  const preview = new Set<string>();
  let previewValid = false;
  if (selectedPiece && hover) {
    const { x: hoverX, y: hoverY } = hover;
    previewValid = canPlace(selectedPiece, hoverX, hoverY, pieces, holdWidth(), holdHeight(), boat().blocked);
    rotatedCells(selectedPiece.shape, selectedPiece.rotation).forEach(([cx, cy]) => preview.add(`${hoverX + cx},${hoverY + cy}`));
  }
  const cells = Array.from({ length: holdWidth() * holdHeight() }, (_, i) => {
    const x = i % holdWidth(), y = Math.floor(i / holdWidth());
    if (isBlocked(x, y, boat().blocked)) return `<div class="hold-cell hold-blocked" aria-label="Hull wall, no cargo space"></div>`;
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
    <div class="weather-layer ${currentPlan.weather}" aria-hidden="true"></div>
    ${currentPlan.night ? `<div id="night-visibility" class="night-visibility ${run?.lightsOn ? 'lights-on' : 'lights-off'}" aria-hidden="true"></div>` : ''}
    <div class="run-top"><div class="run-stat"><span>ROUTE</span><strong id="route-progress">0%</strong><div class="meter"><i id="route-fill"></i></div></div><div class="run-stat"><span>HULL</span><strong id="hull-number">100%</strong><div class="meter"><i id="hull-fill"></i></div></div><div class="run-stat heat-stat"><span>HEAT</span><strong id="heat-number">LOW</strong><div class="meter"><i id="heat-fill"></i></div></div></div>
    <div class="voyage-tag">VOYAGE ${currentPlan.number} · ${HARBORS[currentPlan.port].name.toUpperCase()} · ${currentPlan.night ? 'NIGHT · ' : ''}${currentPlan.weather.toUpperCase()}</div>
    <div id="sea-warning" class="sea-warning" role="status" aria-live="polite"></div>
    <div id="port-compass" class="port-compass" role="img" aria-label="Compass pointing toward ${escapeHtml(HARBORS[currentPlan.port].name)}"><div class="compass-face"><span class="compass-n">N</span><div id="compass-needle" class="compass-needle">➤</div><span id="compass-port" class="compass-harbor">⚓</span></div><div class="compass-copy"><strong>${escapeHtml(HARBORS[currentPlan.port].name.toUpperCase())}</strong><span id="port-distance">520 m</span></div></div>
    <div class="engine-controls"><div id="engine-status" class="engine-status">ENGINE IDLE</div>${currentPlan.night ? `<button id="light-toggle" class="light-toggle" type="button" data-action="toggle-lights" aria-pressed="${run?.lightsOn ? 'true' : 'false'}" aria-label="Toggle boat lights">☼ LIGHTS ON</button>` : ''}<button class="cut-engine" type="button" data-action="cut-engine" aria-label="Cut engine and coast">✦ CUT ENGINE</button></div>
    <div class="run-bottom"><div class="run-instruction"><strong id="run-instruction-title">DRAG TO PILOT</strong><span id="run-instruction-detail">Tap a spot or drag · release to coast</span></div><div id="run-timer" class="run-timer">00:00</div></div>
    ${run?.tutorialOpen ? `<div class="sound-tutorial"><div class="sound-card"><span class="eyebrow">NEW PATROL · ACOUSTIC LISTENING</span><h2>Quiet waters, loud engines.</h2><div class="sound-demo" aria-hidden="true"><span class="demo-boat">🚤</span><span class="demo-wave wave-one"></span><span class="demo-wave wave-two"></span><span class="demo-patrol">◉</span></div><p>Build speed before its listening ring. Then release the drag or tap target to cut the engine and coast silently through. You can steer again once clear.</p><button class="primary-button full" type="button" data-action="dismiss-sound-tutorial">Got it · set sail →</button></div></div>` : ''}
  </main>`;
  updateHud();
}

function renderResult(): void {
  if (!result) return;
  const icon = result.won ? '✦' : '↝';
  view.innerHTML = `<main class="result-screen"><div class="result-card ${result.won ? 'success' : 'failure'}">
    <div class="result-icon" aria-hidden="true">${icon}</div><span class="eyebrow">${result.won ? 'DELIVERY COMPLETE' : 'RUN ENDED'}</span>
    <h1>${result.won ? 'Made it in one piece!' : result.reason === 'caught' ? 'Caught by the Patrol!' : 'The boat took a bath.'}</h1>
    <p>${result.won ? 'The cargo is ashore and nobody asked any questions.' : 'The cargo is gone. Your boat is back at the yard for repairs; its upgrades are safe.'}</p>
    ${result.won ? `<div class="receipt"><div><span>Delivery pay</span><strong>${money(result.base)}</strong></div><div><span>Perfect Pack</span><strong>+${money(result.bonus)}</strong></div>${result.adjustment ? `<div><span>Cargo wear / delay</span><strong>−${money(result.adjustment)}</strong></div>` : ''}<div class="receipt-total"><span>Cash earned</span><strong>${money(result.payout)}</strong></div></div><div class="rep-note">★ +${result.rep} reputation</div>` : `<div class="failure-note">No payout this time · -${Math.abs(result.rep)} reputation</div>`}
    <button class="primary-button" type="button" data-action="next">${result.won ? 'Next delivery' : 'Try again'} <span>→</span></button>
    ${result.won ? '<button class="secondary-button full share-button" type="button" data-action="share">Share this run ↗</button>' : ''}
    <button class="text-button" type="button" data-action="yard">Visit the shipyard ↗</button>
  </div></main>`;
}

function holdDiagram(index: number): string {
  const craft = BOATS[index];
  return `<span class="yard-hold" style="--hold-cols:${craft.width}" aria-label="${usableCells(craft)} usable cargo cells in a ${craft.width} by ${craft.height} hold">${Array.from({ length: craft.width * craft.height }, (_, i) => `<i class="${isBlocked(i % craft.width, Math.floor(i / craft.width), craft.blocked) ? 'hull-wall' : ''}"></i>`).join('')}</span>`;
}

function boatIcon(index: number): string {
  const craft = BOATS[index];
  const contours = ['0,3 17,0 48,3 63,14 48,25 17,28 0,25', '0,11 15,3 46,0 67,14 46,28 15,25', '0,4 13,0 53,0 70,14 53,28 13,28 0,24', '0,9 12,1 56,0 72,14 56,28 12,27', '0,5 12,1 64,1 76,14 64,27 12,27 0,23', '0,12 19,5 51,3 73,14 51,25 19,23', '1,7 18,2 57,2 74,14 57,26 18,26 1,21', '0,5 13,1 60,1 73,14 60,27 13,27 0,23', '0,13 26,2 58,1 78,14 58,27 26,26', '0,3 13,1 66,1 80,14 66,27 13,27 0,25', '0,11 17,3 46,3 64,14 46,25 17,25'];
  return `<svg class="yard-silhouette" viewBox="-2 -2 82 32" aria-hidden="true"><polygon points="${contours[index]}" fill="${craft.color}" stroke="#31576c" stroke-width="2"/><path d="M18 6h28v16H18z" fill="#fff4da" opacity=".88"/><path d="M30 8h9v12h-9z" fill="#80c8ca"/></svg>`;
}

function renderYard(): void {
  const previousScroll = view.querySelector<HTMLElement>('.yard-panel')?.scrollTop ?? 0;
  const inspected = yardSelected !== null && save.ownedBoats.includes(yardSelected) ? yardSelected : null;
  const inspectedBoat = inspected === null ? null : BOATS[inspected];
  const upgrade = inspected === null ? null : boatUpgrade(save, inspected);
  const speedPrice = 90 + (upgrade?.engine ?? 0) * 75;
  const hullPrice = 85 + (upgrade?.hull ?? 0) * 70;
  const repair = inspected === null ? 0 : repairCost(save, inspected);
  const workshopPrice = 160 + save.yardUpgrades.repairBay * 190;
  const brokerPrice = 220 + save.yardUpgrades.brokerDesk * 260;
  const cards = BOATS.map((craft, index) => {
    const owned = save.ownedBoats.includes(index);
    if (!owned) return '';
    const active = save.boat === index;
    const state = save.boatCondition[index] ?? 100;
    return `<article class="fleet-card ${active ? 'active' : ''} ${inspected === index ? 'inspected' : ''}">
      <div class="fleet-card-top">${boatIcon(index)}<div><span class="eyebrow">${active ? 'ACTIVE BOAT' : owned ? 'IN YOUR FLEET' : 'NEW BOAT'}</span><h3>${craft.name}</h3><p>${craft.description}</p></div></div>
      <div class="fleet-card-bottom">${holdDiagram(index)}<div class="fleet-facts"><span><strong>${usableCells(craft)}</strong> cargo cells</span><span><strong>${Math.round(craft.speed * 100)}%</strong> speed · ${craft.handling}</span><span><strong>${craft.hull}</strong> hull · ${owned ? `${state}% condition` : `${money(craft.price)} to buy`}</span></div></div>
      <button class="secondary-button" type="button" data-action="inspect-boat" data-id="${index}" aria-label="Inspect ${craft.name}">${inspected === index ? 'Viewing boat ✓' : 'Inspect boat ↗'}</button>
    </article>`;
  }).join('');
  view.innerHTML = `<main class="side-panel yard-panel" aria-label="Shipyard">
    ${headerStep('THE SHIPYARD', 'The dockyard.', 'Choose a boat to bring it into the inspection bay. Tap a boat in the yard or fleet list.')}
    <div class="yard-summary"><span>⚓ ${save.ownedBoats.length} ${save.ownedBoats.length === 1 ? 'BOAT' : 'BOATS'} MOORED</span><span>ACTIVE · ${boat().name.toUpperCase()}</span></div>
    <div class="yard-destinations"><button class="secondary-button" type="button" data-action="market">Browse all ${BOATS.length} boats →</button><button class="secondary-button" type="button" data-action="map">Open harbor map →</button></div>
    <div class="section-heading"><span>YOUR FLEET & BOATYARD</span><span>${save.ownedBoats.length}/${BOATS.length} OWNED</span></div>
    <div class="fleet-list">${cards}</div>
    ${inspectedBoat && upgrade ? `<div class="section-heading"><span>${inspectedBoat.name.toUpperCase()} · INSPECTION</span><button class="yard-back" type="button" data-action="yard-overview">← ALL BOATS</button></div>
    <div class="inspection-card"><strong>${save.boatCondition[inspected!] ?? 100}% condition</strong><span>${usableCells(inspectedBoat)} cargo cells · ${inspectedBoat.handling}</span><span>${inspected === BACKUP_BOAT_INDEX ? 'Always free to sail · no repair bill' : (save.boatCondition[inspected!] ?? 100) < MIN_SEAWORTHY_CONDITION ? 'Needs repairs before sailing' : 'Seaworthy'}</span>${save.boat === inspected ? '<span class="fleet-active-label">✓ Active boat</span>' : `<button class="secondary-button" type="button" data-action="switch-boat" data-id="${inspected}" ${inspected !== BACKUP_BOAT_INDEX && (save.boatCondition[inspected!] ?? 100) < MIN_SEAWORTHY_CONDITION ? 'disabled' : ''}>${inspected !== BACKUP_BOAT_INDEX && (save.boatCondition[inspected!] ?? 100) < MIN_SEAWORTHY_CONDITION ? 'Repair to sail' : 'Use this boat'}</button>`}</div>
    <div class="upgrade-list">
      ${inspected === BACKUP_BOAT_INDEX ? '<p class="backup-note">The backup sailboat is always ready and free to repair. Earn with small deliveries, then restore your main boat.</p>' : `<div class="upgrade"><div><span class="upgrade-icon">↗</span><strong>Better engine</strong><small>+9% speed · level ${upgrade.engine}/3</small></div><button class="buy-button" type="button" data-action="engine" ${upgrade.engine >= 3 || save.cash < speedPrice ? 'disabled' : ''}>${upgrade.engine >= 3 ? 'MAX' : money(speedPrice)}</button></div>
      <div class="upgrade"><div><span class="upgrade-icon">♥</span><strong>Reinforced hull</strong><small>+15 hull · level ${upgrade.hull}/3</small></div><button class="buy-button" type="button" data-action="hull" ${upgrade.hull >= 3 || save.cash < hullPrice ? 'disabled' : ''}>${upgrade.hull >= 3 ? 'MAX' : money(hullPrice)}</button></div>
      <div class="upgrade"><div><span class="upgrade-icon">⚒</span><strong>Repair ${inspectedBoat.name}</strong><small>${save.boatCondition[inspected!] ?? 100}% condition · ${save.yardUpgrades.repairBay * 18}% yard discount</small></div><button class="buy-button" type="button" data-action="repair" ${repair === 0 || save.cash < repair ? 'disabled' : ''}>${repair === 0 ? 'FULL' : money(repair)}</button></div>`}
    </div>` : '<p class="yard-select-note">Select any boat to inspect its model, condition and upgrades.</p>'}
    <div class="section-heading"><span>SHIPYARD FACILITIES</span><span>BENEFIT EVERY BOAT</span></div>
    <div class="upgrade-list">
      <div class="upgrade"><div><span class="upgrade-icon">⚒</span><strong>Repair workshop</strong><small>Repairs cost ${save.yardUpgrades.repairBay * 18}% less · level ${save.yardUpgrades.repairBay}/3</small></div><button class="buy-button" type="button" data-action="repair-bay" ${save.yardUpgrades.repairBay >= 3 || save.cash < workshopPrice ? 'disabled' : ''}>${save.yardUpgrades.repairBay >= 3 ? 'MAX' : money(workshopPrice)}</button></div>
      <div class="upgrade"><div><span class="upgrade-icon">✦</span><strong>Broker's desk</strong><small>Rare, high paying job chance ${Math.round(rareChance(save) * 100)}% · level ${save.yardUpgrades.brokerDesk}/3</small></div><button class="buy-button" type="button" data-action="broker-desk" ${save.yardUpgrades.brokerDesk >= 3 || save.cash < brokerPrice ? 'disabled' : ''}>${save.yardUpgrades.brokerDesk >= 3 ? 'MAX' : money(brokerPrice)}</button></div>
    </div>
    <div class="panel-foot"><button class="secondary-button full" type="button" data-action="board">← Back to the job board</button></div>
  </main><div class="scene-caption"><span class="caption-badge">THE SHIPYARD</span><strong>All hands on deck.</strong><span>Build your fleet. Make every voyage count.</span></div>`;
  view.querySelector<HTMLElement>('.yard-panel')!.scrollTop = previousScroll;
}

function renderMarket(): void {
  const previousScroll = view.querySelector<HTMLElement>('.market-screen')?.scrollTop ?? 0;
  const catalog = BOATS.map((craft, index) => ({ craft, index })).sort((a, b) => a.craft.price - b.craft.price);
  const cards = catalog.map(({ craft, index }, position) => {
    const owned = save.ownedBoats.includes(index);
    const active = save.boat === index;
    return `<article class="market-card ${active ? 'market-active' : ''}" style="--boat-color:${craft.color}">
      <div class="market-art"><span class="market-number">NO. ${String(position + 1).padStart(2, '0')}</span>${boatIcon(index)}<span class="market-badge">${owned ? active ? 'SAILING' : 'OWNED' : money(craft.price)}</span></div>
      <div class="market-body"><h2>${craft.name}</h2><p>${craft.description}</p>
      <div class="market-hold">${holdDiagram(index)}<span><strong>${usableCells(craft)} cells</strong><small>${craft.width} × ${craft.height} shaped hold</small></span></div>
      <div class="market-stats"><span><strong>${Math.round(craft.speed * 100)}%</strong><small>Speed</small></span><span><strong>${craft.handling}</strong><small>Steering</small></span><span><strong>${craft.hull}</strong><small>Hull</small></span></div>
      ${active ? '<span class="fleet-active-label">✓ Your active boat</span>' : owned ? `<button class="secondary-button full" type="button" data-action="switch-boat" data-id="${index}" ${index !== BACKUP_BOAT_INDEX && (save.boatCondition[index] ?? 100) < MIN_SEAWORTHY_CONDITION ? 'disabled' : ''}>${index !== BACKUP_BOAT_INDEX && (save.boatCondition[index] ?? 100) < MIN_SEAWORTHY_CONDITION ? 'Repair to sail' : 'Use this boat'}</button>` : `<button class="primary-button full" type="button" data-action="buy-boat" data-id="${index}" ${save.cash < craft.price ? 'disabled' : ''}>Buy for ${money(craft.price)}</button>`}</div>
    </article>`;
  }).join('');
  view.innerHTML = `<main class="atlas-screen market-screen" aria-label="Boat marketplace"><div class="atlas-wrap">
    <div class="atlas-top"><button class="atlas-back" type="button" data-action="yard">← Shipyard</button><span>⚓ THE BOAT MARKET</span><button class="atlas-back" type="button" data-action="map">Harbor map →</button></div>
    <div class="atlas-heading"><span class="eyebrow">A BOAT FOR EVERY KIND OF CAPTAIN</span><h1>Find your next boat.</h1><p>Compare all ${BOATS.length} hulls. A bigger hold carries more cargo; a smaller boat answers the helm faster.</p></div>
    <div class="market-grid">${cards}</div><div class="atlas-bottom"><button class="secondary-button" type="button" data-action="board">← Job board</button><button class="secondary-button" type="button" data-action="yard">Your shipyard →</button></div>
  </div></main>`;
  view.querySelector<HTMLElement>('.market-screen')!.scrollTop = previousScroll;
}

function harborMiniRoute(index: number): string {
  const plan = levelPlan(1, index);
  const scale = 40 / Math.max(80, Math.abs(channelCenter(plan, ROUTE_END)));
  const points = Array.from({ length: 13 }, (_, i) => {
    const z = i * ROUTE_END / 12;
    return `${(50 + channelCenter(plan, z) * scale).toFixed(1)},${(92 - i * 7).toFixed(1)}`;
  }).join(' ');
  return `<svg class="map-mini-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="#fff8df" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".84"/><polyline points="${points}" fill="none" stroke="#398b94" stroke-width="2" stroke-dasharray="2 3"/><circle cx="50" cy="92" r="3" fill="#f8ce6a"/><circle cx="${(50 + channelCenter(plan, ROUTE_END) * scale).toFixed(1)}" cy="8" r="3" fill="#f78c70"/></svg>`;
}

function renderMap(): void {
  const previousScroll = view.querySelector<HTMLElement>('.map-screen')?.scrollTop ?? 0;
  const stops = HARBORS.map((harbor, index) => {
    const unlocked = save.unlockedPorts.includes(index);
    const current = save.port === index;
    const missing = unlocked ? [] : harborRequirements(save, index);
    const requirements = index === 0 ? 'Your first home port' : [index > 1 ? `Unlock ${HARBORS[index - 1].name}` : null, harbor.requiredBoat !== null ? `Own ${BOATS[harbor.requiredBoat].name}` : null, harbor.reputation ? `${harbor.reputation} reputation` : null, harbor.capacity ? `${harbor.capacity}+ cargo cells` : null].filter(Boolean).join(' · ');
    return `<article class="map-stop ${unlocked ? 'unlocked' : 'locked'} ${current ? 'current' : ''}" style="--harbor-color:${harbor.color}">
      <div class="map-island" aria-hidden="true"><span>${harbor.icon}</span></div>
      <div class="map-stop-body"><span class="eyebrow">HARBOR ${String(index + 1).padStart(2, '0')} · ${current ? 'CURRENT PORT' : unlocked ? 'UNLOCKED' : 'LOCKED'}</span><h2>${harbor.name}</h2><p>${harbor.subtitle}</p>
      <div class="map-mini" title="Unique ${harbor.biome} route map">${harborMiniRoute(index)}<span>${harbor.biome.toUpperCase()} ROUTE</span></div>
      <small>${index === 0 ? 'Open from the start' : `Unlock: ${requirements}`}</small>
      ${missing.length ? `<div class="map-missing">Still needed: ${missing.join(' · ')}</div>` : ''}
      ${current ? '<span class="fleet-active-label">⚓ Sailing from here</span>' : unlocked ? `<button class="secondary-button" type="button" data-action="select-port" data-id="${index}">Sail from here →</button>` : '<span class="map-lock">🔒 Locked until requirements are met</span>'}</div>
    </article>`;
  });
  const regionNames = ['The sheltered coast', 'The winding coast', 'The southern reaches', 'The outer islands', 'The far horizon'];
  const regions = Array.from({ length: 5 }, (_, region) => `<section class="map-region"><div class="map-region-head"><span>CHART ${region + 1} / 5</span><strong>${regionNames[region]}</strong><small>Harbours ${String(region * 5 + 1).padStart(2, '0')}–${String(region * 5 + 5).padStart(2, '0')}</small></div><div class="map-stops">${stops.slice(region * 5, region * 5 + 5).join('')}</div></section>`).join('');
  view.innerHTML = `<main class="atlas-screen map-screen" aria-label="Harbor progression map"><div class="atlas-wrap">
    <div class="atlas-top"><button class="atlas-back" type="button" data-action="board">← Job board</button><span>✦ THE HARBOR CHART</span><button class="atlas-back" type="button" data-action="market">Boat market →</button></div>
    <div class="atlas-heading"><span class="eyebrow">25 DISTINCT COASTS · ENDLESS VOYAGES</span><h1>Harbors ahead.</h1><p>Each harbor has its own coastline, route bends, landmarks and cargo. Unlock them in order, then sail any open harbor as voyages keep changing.</p></div>
    <div class="map-chart">${regions}</div>
    <div class="map-legend"><span><i class="legend-open"></i> Open harbor</span><span><i class="legend-locked"></i> Locked harbor</span><span>★ ${Math.floor(save.reputation)} reputation</span><span>${save.unlockedPorts.length} / ${HARBORS.length} discovered</span></div>
    <div class="atlas-bottom"><button class="secondary-button" type="button" data-action="yard">← Shipyard</button><button class="secondary-button" type="button" data-action="board">Job board →</button></div>
  </div></main>`;
  view.querySelector<HTMLElement>('.map-screen')!.scrollTop = previousScroll;
}

function render(): void {
  if (phase !== 'run' && phase !== 'result') world.resetVoyage();
  gameShell.classList.toggle('is-running', phase === 'run');
  updateChrome();
  if (phase === 'board') renderBoard();
  if (phase === 'pack') renderPack();
  if (phase === 'run') renderRun();
  if (phase === 'result') renderResult();
  if (phase === 'yard') { world.showShipyard(save.ownedBoats, save.boat); world.focusShipyardBoat(yardSelected); renderYard(); }
  else world.hideShipyard();
  if (phase === 'market') renderMarket();
  if (phase === 'map') renderMap();
}

function addJob(id: string): void {
  const job = availableJobs().find(item => item.id === id);
  if (!job || jobs.some(item => item.id === id)) return;
  const nextPieces = [...pieces, ...piecesForJob(job)];
  if (!canFitAll(nextPieces, holdWidth(), holdHeight(), boat().blocked)) { notify('That cargo will not fit. Move crates or choose a smaller job.', 'danger'); beep(210, 0.13, 'sawtooth'); return; }
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
  if (!canPlace(piece, x, y, pieces, holdWidth(), holdHeight(), boat().blocked)) { notify(jobById(piece.jobId)?.kind === 'vip' ? 'VIP cargo must cover a centre square and fit inside the hold.' : 'That crate overlaps or hangs over the side.', 'danger'); beep(210, 0.1, 'sawtooth'); return; }
  piece.x = x; piece.y = y; selected = pieces.find(item => item.x === null)?.id || null;
  hover = null; tick(); render();
  if (pieces.every(item => item.x !== null)) notify('All cargo secured. Set sail when ready!', 'success');
}

function beginRun(): void {
  if (!pieces.length || pieces.some(piece => piece.x === null)) return;
  if (save.boat !== BACKUP_BOAT_INDEX && (save.boatCondition[save.boat] ?? 100) < MIN_SEAWORTHY_CONDITION) {
    notify(`${boat().name} needs repairs. Choose the free Patchwork Sailboat in the shipyard.`, 'danger'); return;
  }
  currentPlan = levelPlan(save.level, save.port);
  world.configureLevel(currentPlan);
  world.resetVoyage();
  const maxHull = boat().hull + boatUpgrade(save).hull * 15;
  const patrolHeat = jobs.reduce((sum, job) => sum + job.heat, 0);
  const hotCargo = jobs.some(job => job.kind === 'hot');
  run = { x: 0, z: 0, vx: 0, vz: 0, speed: 0, hull: maxHull * (save.boatCondition[save.boat] ?? 100) / 100, maxHull, heat: Math.min(65, patrolHeat * 4 + (hotCargo ? 8 : 0)), contact: 0, damageCooldown: 0, collisions: 0, elapsed: 0, holding: false, pointer: null, pointerX: 0, pointerY: 0, pointerStartX: 0, pointerStartY: 0, pointerDownAt: 0, pointerMoved: false, dragOriginX: 0, dragOriginZ: 0, tapTarget: null, deadline: jobs.some(job => job.kind === 'perishable') ? 70 + (Math.hypot(destinationX(currentPlan), 532) - 532) / 9.2 : Infinity, patrolHeat, hotCargo, ending: false, heading: 0, engineOn: false, lightsOn: currentPlan.night, tutorialOpen: false, tutorialPending: currentPlan.patrols.some(patrol => patrol.sound) && !save.soundTutorialSeen, soundExposure: 0, offshoreTime: 0 };
  world.setNightLighting(currentPlan.night, run.lightsOn);
  heldKeys.clear(); phase = 'run'; render(); beep(400, 0.15, 'triangle'); notify('Cargo aboard. Tap the water or drag to pilot!', 'success');
}

function updateHud(): void {
  if (!run) return;
  const progress = Math.max(0, Math.min(100, Math.round(run.z / ROUTE_END * 100)));
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
  const portDx = destinationX(currentPlan) - run.x;
  const portDz = 532 - run.z;
  const portBearing = Math.atan2(portDx, portDz);
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const direction = points[((Math.round(portBearing / (Math.PI / 8)) % 16) + 16) % 16];
  set('port-distance', `${direction} · ${Math.round(Math.hypot(portDx, portDz))} m`);
  set('engine-status', run.engineOn ? 'ENGINE ON · PATROLS CAN HEAR' : 'ENGINE CUT · COASTING');
  const seaWarning = document.getElementById('sea-warning');
  if (seaWarning) {
    const offshore = offshoreState(currentPlan, run.x, run.z);
    seaWarning.className = `sea-warning ${offshore.zone}`;
    seaWarning.textContent = offshore.zone === 'charted' ? '' : offshore.zone === 'warning' ? '⚠ CHARTED WATER ENDS · SWELL AHEAD' : offshore.zone === 'rough' ? '⚠ ROUGH WATER · STEER BACK TOWARD PORT' : '⛔ BREAKERS · HULL DAMAGE AHEAD · STEER BACK';
  }
  const lightButton = document.getElementById('light-toggle');
  if (lightButton) { lightButton.textContent = run.lightsOn ? '☼ LIGHTS ON' : '◌ LIGHTS OFF'; lightButton.setAttribute('aria-pressed', String(run.lightsOn)); }
  const darkness = document.getElementById('night-visibility');
  if (darkness) darkness.className = `night-visibility ${run.lightsOn ? 'lights-on' : 'lights-off'}`;
  const needle = document.getElementById('compass-needle');
  if (needle) needle.style.transform = `translate(-50%, -50%) rotate(${portBearing - Math.PI / 2}rad)`;
  const portMark = document.getElementById('compass-port');
  if (portMark) { portMark.style.setProperty('--port-x', `${Math.sin(portBearing) * 17}px`); portMark.style.setProperty('--port-y', `${-Math.cos(portBearing) * 17}px`); }
  document.getElementById('port-compass')?.setAttribute('aria-label', `${HARBORS[currentPlan.port].name} lies ${direction}, ${Math.round(Math.hypot(portDx, portDz))} metres away`);
}

function endRun(won: boolean, reason: string): void {
  if (!run || phase !== 'run') return;
  const base = Math.round(jobs.reduce((sum, job) => sum + job.payout, 0) * currentPlan.payoutMultiplier);
  const full = pieces.reduce((sum, piece) => sum + occupiedCells(piece).length, 0) === holdCapacity();
  const bonus = won && full ? Math.round(base * 0.1) : 0;
  let payout = won ? base + bonus : 0;
  if (won && jobs.some(job => job.kind === 'fragile')) payout = Math.max(0, payout - Math.round(base * Math.min(run.collisions * 0.2, 0.8)));
  if (won && jobs.some(job => job.kind === 'perishable') && run.elapsed > run.deadline) payout = Math.round(payout * 0.7);
  const adjustment = won ? base + bonus - payout : 0;
  const rep = won ? 8 + jobs.length * 4 : -3;
  save.boatCondition[save.boat] = save.boat === BACKUP_BOAT_INDEX ? 100 : Math.max(30, Math.round(run.hull / run.maxHull * 100));
  save.cash += payout; save.reputation = Math.max(0, save.reputation + rep); save.runs++;
  const backupNeeded = save.boat !== BACKUP_BOAT_INDEX && save.boatCondition[save.boat] < MIN_SEAWORTHY_CONDITION && save.cash < repairCost(save);
  if (backupNeeded) { save.boat = BACKUP_BOAT_INDEX; world.setBoat(boat()); }
  if (won) save.level += 1;
  const previouslyOpen = save.unlockedPorts.length;
  refreshHarborUnlocks(save);
  result = { won, reason, payout, base, bonus, adjustment, rep };
  run = null; phase = 'result'; saveProgress(); render();
  beep(won ? 660 : 180, 0.25, won ? 'triangle' : 'sawtooth');
  if (won) window.setTimeout(() => beep(880, 0.22, 'triangle'), 110);
  if (backupNeeded) notify('Repairs are out of reach. Your free Patchwork Sailboat is ready for the next delivery.');
  else if (save.unlockedPorts.length > previouslyOpen) notify(`${PORTS[save.unlockedPorts.at(-1)!]} unlocked! Open the harbor map.`, 'success');
}

function showImpact(label: string): void {
  world.triggerDamage();
  damageCalloutEl.textContent = label;
  damageFlashEl.classList.remove('active'); damageCalloutEl.classList.remove('active');
  void damageFlashEl.offsetWidth;
  damageFlashEl.classList.add('active'); damageCalloutEl.classList.add('active');
}

function beginDeliveryDocking(): void {
  if (!run || run.ending) return;
  run.ending = true; run.holding = false; run.pointer = null; run.tapTarget = null;
  heldKeys.clear(); sceneHost.classList.remove('steering'); gameShell.classList.remove('is-running');
  const approach = world.beginDocking(run.x, run.z);
  document.getElementById('run-instruction-title')!.textContent = 'DOCKING AT THE PIER';
  document.getElementById('run-instruction-detail')!.textContent = 'Ease in and tie up alongside';
  window.setTimeout(() => {
    if (phase !== 'run' || !run?.ending) return;
    document.getElementById('run-instruction-title')!.textContent = 'UNLOADING CARGO';
    document.getElementById('run-instruction-detail')!.textContent = 'Crates ashore · delivery complete';
  }, approach * 1000);
  window.setTimeout(() => {
    if (phase === 'run' && run?.ending) endRun(true, 'delivered');
  }, (approach + 3.35) * 1000);
}

function steeringPoint(clientX: number, clientY: number): { x: number; z: number } {
  return world.screenToWater(clientX, clientY);
}

function dragPoint(): { x: number; z: number } | null {
  if (!run?.holding || !run.pointerMoved) return null;
  const start = world.screenToWater(run.pointerStartX, run.pointerStartY);
  const current = world.screenToWater(run.pointerX, run.pointerY);
  return {
    x: run.dragOriginX + current.x - start.x,
    z: run.dragOriginZ + current.z - start.z,
  };
}

function updateRun(dt: number): void {
  if (!run || phase !== 'run' || run.ending || run.tutorialOpen) return;
  if (run.tutorialPending && world.patrols.some(patrol => patrol.sound && Math.abs(run!.z - patrol.z) < 37)) {
    run.tutorialPending = false; run.tutorialOpen = true; run.tapTarget = null; run.holding = false; run.pointer = null;
    heldKeys.clear(); sceneHost.classList.remove('steering'); renderRun(); return;
  }
  run.elapsed += dt; run.damageCooldown = Math.max(0, run.damageCooldown - dt);
  const maxSpeed = 9.2 * (boat().speed + boatUpgrade(save).engine * .09);
  let target: { x: number; z: number } | null = null;
  if (run.holding && run.pointer !== null) target = dragPoint();
  else if (!heldKeys.size && run.tapTarget) target = run.tapTarget;
  if (target && Math.hypot(target.x - run.x, target.z - run.z) < .65 && !run.holding) { run.tapTarget = null; target = null; }
  if (target) target = { x: target.x, z: Math.max(0, Math.min(ROUTE_END, target.z)) };
  const dx = Number(heldKeys.has('arrowright') || heldKeys.has('d')) - Number(heldKeys.has('arrowleft') || heldKeys.has('a'));
  const dz = Number(heldKeys.has('arrowup') || heldKeys.has('w')) - Number(heldKeys.has('arrowdown') || heldKeys.has('s'));
  run.engineOn = Boolean(target || dx || dz);
  const nearListeningBoat = world.patrols.some(patrol => patrol.sound && Math.hypot(run!.x - patrol.x, run!.z - patrol.z) < 19);
  const presentOffshore = offshoreState(currentPlan, run.x, run.z);
  const handling = { ...boat(), coast: !run.engineOn && nearListeningBoat ? .16 : boat().coast,
    turnRate: boat().turnRate * (1 - presentOffshore.swell * .42), acceleration: boat().acceleration * (1 - presentOffshore.swell * .28) };
  const motion = advanceMotion(run, target, { x: dx, z: dz }, maxSpeed, dt, handling);
  const offshore = offshoreState(currentPlan, motion.x, motion.z);
  const buffeting = roughWaterPush(currentPlan, motion.x, motion.z, run.elapsed);
  const lateral = currentPush(currentPlan, motion.x, motion.z, run.elapsed) + weatherPush(currentPlan, run.elapsed) + offshore.push + buffeting.x;
  run.vx = (motion.vx + lateral * dt) * (1 - offshore.drag * dt); run.vz = motion.vz * (1 - offshore.drag * dt);
  run.vz += buffeting.z * dt;
  run.z = Math.max(-2, Math.min(ROUTE_END, motion.z + buffeting.z * dt * dt * .5));
  run.x = motion.x + lateral * dt * dt * .5;
  const newOffshore = offshoreState(currentPlan, run.x, run.z);
  run.offshoreTime = newOffshore.zone === 'danger' ? run.offshoreTime + dt : 0;
  if (run.offshoreTime > 1.7 && run.damageCooldown === 0) {
    const damage = newOffshore.distance > 42 ? 13 : 7;
    run.hull = Math.max(0, run.hull - damage); run.collisions++; run.damageCooldown = 1.5;
    showImpact(`−${damage} HULL`); beep(135, .22, 'sawtooth');
    notify('Breaking swell! Steer back toward the marked route.', 'danger');
  }
  run.speed = Math.hypot(run.vx, run.vz);
  if (run.speed > .25) {
    const desired = Math.atan2(run.vx, run.vz);
    run.heading += Math.atan2(Math.sin(desired - run.heading), Math.cos(desired - run.heading)) * Math.min(1, dt * 3.2);
  }
  const sight = sightProfile(currentPlan.night, run.lightsOn);
  let spotted = false; let heard = false; let contact = false;
  for (const patrol of world.patrols) {
    const distance = Math.hypot(run.x - patrol.x, run.z - patrol.z);
    if (patrol.sound) {
      if (heardBySoundPatrol(distance, run.engineOn, run.speed)) heard = true;
    } else if (inVisionCone(patrol, run.x, run.z, (11.5 + run.patrolHeat * .12 + (run.hotCargo ? 2 : 0)) * sight.rangeMultiplier, sight.halfAngle)) spotted = true;
    if (distance < 2.1) contact = true;
  }
  run.contact = contact ? run.contact + dt : Math.max(0, run.contact - dt * 1.5);
  run.soundExposure = heard ? run.soundExposure + dt : Math.max(0, run.soundExposure - dt * 1.8);
  run.heat = Math.max(run.hotCargo ? 12 : 0, Math.min(100, run.heat + (spotted ? sight.heatRate : heard ? 48 : run.hotCargo ? -2 : -8) * dt));
  const title = document.getElementById('run-instruction-title');
  const detail = document.getElementById('run-instruction-detail');
  if (title && detail && !run.ending) {
    title.textContent = heard ? 'SONAR HEARS YOU' : run.z > ROUTE_END - 22 ? 'PORT APPROACH' : newOffshore.zone === 'rough' || newOffshore.zone === 'danger' ? 'ROUGH WATER' : !run.engineOn && currentPlan.patrols.some(p => p.sound) ? 'SILENT GLIDE' : currentPlan.weather === 'storm' ? 'HEAVY WEATHER' : 'DRAG TO PILOT';
    detail.textContent = heard ? 'Release to cut the engine and coast' : run.z > ROUTE_END - 22 ? 'Follow the compass and line up with the pier' : newOffshore.zone === 'rough' || newOffshore.zone === 'danger' ? 'Waves buffet the hull · steering responds more slowly' : !run.engineOn && currentPlan.patrols.some(p => p.sound) ? 'Momentum carries you past listening patrols' : currentPlan.currents.some(c => Math.hypot(run!.x - c.x, run!.z - c.z) < c.radius) ? 'Strong current · steer against the flow' : currentPlan.night ? run.lightsOn ? 'Lights reveal hazards · patrols can spot you sooner · L to toggle' : 'Dark water hides hazards · L to switch lights on' : 'Tap a spot or drag · release to coast';
  }
  if (run.contact >= 1.5 || run.soundExposure >= 1.8 || run.heat >= 100) { run.ending = true; showImpact('CAUGHT!'); window.setTimeout(() => endRun(false, 'caught'), 650); return; }
  for (const hazard of world.hazards) {
    if (Math.hypot(run.x - hazard.x, run.z - hazard.z) < hazard.radius + .85 && run.damageCooldown === 0) {
      const damage = hazard.kind === 'rock' ? 24 : hazard.kind === 'iceberg' ? 27 : hazard.kind === 'sandbank' ? 17 : 12;
      run.hull = Math.max(0, run.hull - damage); run.collisions++; run.damageCooldown = 1.25;
      const awayX = run.x - hazard.x, awayZ = run.z - hazard.z;
      const awayLength = Math.hypot(awayX, awayZ) || 1;
      run.vx = awayX / awayLength * 2.8; run.vz = awayZ / awayLength * 2.8;
      run.speed = Math.hypot(run.vx, run.vz); run.tapTarget = null;
      showImpact(`−${damage} HULL`);
      beep(135, .22, 'sawtooth'); Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
      notify(hazard.kind === 'rock' ? 'Rock! Steer into open water.' : hazard.kind === 'iceberg' ? 'Iceberg! Watch the floating ice.' : hazard.kind === 'sandbank' ? 'Sandbank! The shallows scrape your hull.' : 'Buoy bump! Watch the channel.', 'danger');
      if (run.hull <= 0) { run.ending = true; window.setTimeout(() => endRun(false, 'sunk'), 650); return; }
    }
  }
  if (run.hull <= 0) { run.ending = true; window.setTimeout(() => endRun(false, 'sunk'), 650); return; }
  if (canDock(currentPlan, run.x, run.z)) { beginDeliveryDocking(); return; }
  if (performance.now() - lastHud > 90) { updateHud(); lastHud = performance.now(); }
}

function handleAction(action: string, id?: string, target?: HTMLElement): void {
  if (action === 'add-job' && id) addJob(id);
  else if (action === 'remove-job' && id) removeJob(id);
  else if (action === 'pack' && jobs.length) { phase = 'pack'; selected = pieces.find(piece => piece.x === null)?.id || null; render(); }
  else if (action === 'board') { phase = 'board'; render(); }
  else if (action === 'yard') { yardSelected = null; phase = 'yard'; render(); }
  else if (action === 'inspect-boat' && id) { const index = Number(id); if (!save.ownedBoats.includes(index)) return; yardSelected = index; world.focusShipyardBoat(index); renderYard(); }
  else if (action === 'yard-overview') { yardSelected = null; world.focusShipyardBoat(null); renderYard(); }
  else if (action === 'market') { phase = 'market'; render(); }
  else if (action === 'map') { phase = 'map'; render(); }
  else if (action === 'select-piece' && id) { selected = id; tick(); render(); }
  else if (action === 'rotate') { const piece = pieces.find(item => item.id === selected); if (piece && piece.x === null) { piece.rotation = (piece.rotation + 1) % 4; tick(); render(); } }
  else if (action === 'cell' && target) placeAt(Number(target.dataset.x), Number(target.dataset.y));
  else if (action === 'sail') beginRun();
  else if (action === 'dismiss-sound-tutorial' && run) { run.tutorialOpen = false; save.soundTutorialSeen = true; saveProgress(); renderRun(); notify('Build speed, release to coast, then steer again once clear.'); }
  else if (action === 'cut-engine' && run) { run.tapTarget = null; run.holding = false; run.pointer = null; heldKeys.clear(); sceneHost.classList.remove('steering'); run.engineOn = false; updateHud(); }
  else if (action === 'toggle-lights' && run && currentPlan.night && !run.ending) { run.lightsOn = !run.lightsOn; world.setNightLighting(true, run.lightsOn); updateHud(); beep(run.lightsOn ? 660 : 250, .09, 'triangle'); }
  else if (action === 'next') { jobs = []; pieces = []; selected = null; phase = 'board'; render(); }
  else if (action === 'share' && result?.won) {
    const text = `I delivered ${jobs.map(job => job.cargo).join(', ')} in Crate Escape and earned ${money(result.payout)}. Pack it. Run it. Don't get caught!`;
    Share.share({ title: 'Crate Escape', text }).catch(async () => {
      try { await navigator.clipboard.writeText(text); notify('Run story copied to clipboard.', 'success'); }
      catch { notify('Sharing is unavailable on this device.', 'danger'); }
    });
  }
  else if (action === 'engine' || action === 'hull') {
    if (yardSelected === null || yardSelected === BACKUP_BOAT_INDEX) return;
    const upgrade = boatUpgrade(save, yardSelected); const level = upgrade[action];
    const cost = (action === 'engine' ? 90 : 85) + level * (action === 'engine' ? 75 : 70);
    if (level >= 3 || save.cash < cost) return;
    save.cash -= cost; upgrade[action]++; saveProgress(); tick(); render(); notify(`${action === 'engine' ? 'Engine' : 'Hull'} upgraded on ${BOATS[yardSelected].name}.`, 'success');
  }
  else if (action === 'repair') {
    if (yardSelected === null || yardSelected === BACKUP_BOAT_INDEX) return;
    const cost = repairCost(save, yardSelected); if (!cost || save.cash < cost) return;
    save.cash -= cost; save.boatCondition[yardSelected] = 100; saveProgress(); tick(); render(); notify(`${BOATS[yardSelected].name} is shipshape again.`, 'success');
  }
  else if (action === 'repair-bay' || action === 'broker-desk') {
    const key = action === 'repair-bay' ? 'repairBay' : 'brokerDesk';
    const level = save.yardUpgrades[key]; const cost = (key === 'repairBay' ? 160 : 220) + level * (key === 'repairBay' ? 190 : 260);
    if (level >= 3 || save.cash < cost) return;
    save.cash -= cost; save.yardUpgrades[key]++; saveProgress(); tick(); render(); notify(`${key === 'repairBay' ? 'Repair workshop' : "Broker's desk"} upgraded.`, 'success');
  }
  else if (action === 'buy-boat' && id) {
    const index = Number(id); const craft = BOATS[index];
    if (!craft || save.ownedBoats.includes(index) || save.cash < craft.price) return;
    save.cash -= craft.price; save.ownedBoats.push(index); save.ownedBoats.sort((a, b) => a - b);
    save.boatUpgrades[index] = { engine: 0, hull: 0 }; save.boatCondition[index] = 100;
    save.boat = index;
    const previouslyOpen = save.unlockedPorts.length;
    refreshHarborUnlocks(save);
    if (index === 1 && save.unlockedPorts.includes(1)) save.port = 1;
    jobs = []; pieces = []; selected = null; world.setBoat(craft); saveProgress(); tick(); render();
    notify(`${craft.name} is yours${save.unlockedPorts.length > previouslyOpen ? ` · ${PORTS[save.unlockedPorts.at(-1)!]} unlocked` : ''}!`, 'success');
  }
  else if (action === 'switch-boat' && id) {
    const index = Number(id); if (!save.ownedBoats.includes(index) || index === save.boat || (index !== BACKUP_BOAT_INDEX && (save.boatCondition[index] ?? 100) < MIN_SEAWORTHY_CONDITION)) return;
    save.boat = index; jobs = []; pieces = []; selected = null; world.setBoat(boat()); saveProgress(); tick(); render(); notify(`${boat().name} is ready to sail.`, 'success');
  }
  else if (action === 'select-port' && id) {
    const index = Number(id); if (!save.unlockedPorts.includes(index) || index === save.port) return;
    save.port = index; jobs = []; pieces = []; selected = null; phase = 'board';
    saveProgress(); tick(); render(); notify(`Now sailing from ${PORTS[index]}.`, 'success');
  }

}

view.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (target && !((target as HTMLButtonElement).disabled)) handleAction(target.dataset.action!, target.dataset.id, target);
});
sceneHost.addEventListener('click', event => {
  if (phase !== 'yard') return;
  const index = world.shipyardBoatAt(event.clientX, event.clientY);
  if (index !== null) handleAction('inspect-boat', String(index));
});

view.addEventListener('pointerdown', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action="select-piece"]');
  if (phase === 'pack' && target) { dragPiece = target.dataset.id!; dragMoved = false; }
});

window.addEventListener('pointerdown', event => {
  if (phase === 'run' && run && !run.ending && !run.tutorialOpen && run.pointer === null && event.isPrimary && event.button === 0
    && !(event.target as HTMLElement).closest('button, a, input, select, textarea')) {
    event.preventDefault();
    run.pointer = event.pointerId; run.holding = true; run.tapTarget = null;
    run.pointerX = event.clientX; run.pointerY = event.clientY;
    run.pointerStartX = event.clientX; run.pointerStartY = event.clientY;
    run.pointerDownAt = performance.now(); run.pointerMoved = false;
    run.dragOriginX = run.x; run.dragOriginZ = run.z;
    sceneHost.classList.add('steering');
  }
}, { capture: true });

window.addEventListener('pointermove', event => {
  if (phase === 'run' && run?.pointer === event.pointerId) {
    run.pointerX = event.clientX; run.pointerY = event.clientY;
    if (Math.hypot(event.clientX - run.pointerStartX, event.clientY - run.pointerStartY) > 9) run.pointerMoved = true;
    return;
  }
  if (phase !== 'pack') return;
  const el = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.hold-cell');
  if (dragPiece) { dragMoved = true; if (selected !== dragPiece) selected = dragPiece; }
  const next = el ? { x: Number(el.dataset.x), y: Number(el.dataset.y) } : null;
  if (next?.x !== hover?.x || next?.y !== hover?.y) { hover = next; renderPack(); }
});

window.addEventListener('pointerup', event => {
  if (phase === 'run' && run?.pointer === event.pointerId) {
    const tapped = !run.pointerMoved && performance.now() - run.pointerDownAt < 320;
    run.tapTarget = tapped ? steeringPoint(event.clientX, event.clientY) : null;
    run.holding = false; run.pointer = null; sceneHost.classList.remove('steering'); return;
  }
  if (phase === 'pack' && dragPiece) {
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('.hold-cell');
    if (cell && dragMoved) { selected = dragPiece; placeAt(Number(cell.dataset.x), Number(cell.dataset.y)); }
    dragPiece = null;
  }
});

window.addEventListener('pointercancel', event => {
  if (phase === 'run' && run?.pointer === event.pointerId) {
    run.holding = false; run.pointer = null; sceneHost.classList.remove('steering');
  }
});

window.addEventListener('keydown', event => {
  if (phase === 'pack' && (event.key === 'r' || event.key === 'R')) { event.preventDefault(); handleAction('rotate'); }
  if (phase === 'run' && run && !run.tutorialOpen) {
    const key = event.key.toLowerCase();
    if (key === 'l' && !event.repeat && currentPlan.night) { event.preventDefault(); handleAction('toggle-lights'); }
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(key)) {
      event.preventDefault(); heldKeys.add(key); run.tapTarget = null;
    }
  }
});
window.addEventListener('keyup', event => {
  heldKeys.delete(event.key.toLowerCase());
});
window.addEventListener('blur', () => { heldKeys.clear(); if (run) { run.holding = false; run.pointer = null; } sceneHost.classList.remove('steering'); });

soundEl.addEventListener('click', () => { save.sound = !save.sound; saveProgress(); if (save.sound) beep(620); });

let previous = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - previous) / 1000, 0.05); previous = now;
  if (phase === 'run') updateRun(dt);
  const target = run?.holding && run.pointer !== null ? dragPoint() : run?.tapTarget || null;
  world.update(dt, phase === 'run' && !run?.tutorialOpen, run?.x || 0, run?.z || 0, run?.heat || 0, run?.speed || 0, run?.vx || 0, run?.vz || 0, target);
  if (phase === 'run' && currentPlan.night) {
    const darkness = document.getElementById('night-visibility');
    if (darkness) { const point = world.boatScreenPosition(); darkness.style.setProperty('--light-x', `${point.x}%`); darkness.style.setProperty('--light-y', `${point.y}%`); }
  }
  requestAnimationFrame(frame);
}

render(); requestAnimationFrame(frame);
