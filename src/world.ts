import * as THREE from 'three';
import { patrolPose } from './patrols';
import { BOATS, type BoatDefinition, type BoatStyle } from './model';

const mat = (color: string, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
const palette = {
  water: '#168ea0', paleWater: '#49b6bd', sand: '#f3cd83', grass: '#70bf85',
  rock: '#647b83', coral: '#ff8864', cream: '#fff4d1', navy: '#285575',
};

function box(parent: THREE.Object3D, color: string, x: number, y: number, z: number, w: number, h: number, d: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function cone(parent: THREE.Object3D, color: string, x: number, y: number, z: number, radius: number, height: number, sides = 6): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, sides), mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}

function cylinder(parent: THREE.Object3D, color: string, x: number, y: number, z: number, radius: number, height: number, sides = 8): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}

function makeBoat(color: string, style: BoatStyle | 'patrol' = 'dinghy'): THREE.Group {
  const craft = new THREE.Group();
  const broad = style === 'trawler' || style === 'freighter';
  const long = style === 'cruiser' || style === 'freighter';
  const half = style === 'dinghy' || style === 'patrol' ? 1.28 : style === 'speedboat' ? 1.12 : broad ? 1.65 : 1.4;
  const front = style === 'speedboat' ? 2.9 : long ? 3.15 : 2.35;
  const back = long ? -2.9 : -2.15;
  const outline = new THREE.Shape();
  outline.moveTo(0, front); outline.lineTo(-half * (style === 'speedboat' ? 0.94 : 0.72), front - 0.45);
  outline.lineTo(-half, front - (style === 'speedboat' ? 1.7 : 0.85));
  outline.lineTo(-half, back + 0.38); outline.quadraticCurveTo(-half * 0.86, back, 0, back);
  outline.quadraticCurveTo(half * 0.86, back, half, back + 0.38);
  outline.lineTo(half, front - (style === 'speedboat' ? 1.7 : 0.85));
  outline.lineTo(half * (style === 'speedboat' ? 0.94 : 0.72), front - 0.45); outline.closePath();
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: broad ? 0.92 : 0.72, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2, curveSegments: 5 }), mat(color));
  hull.rotation.x = -Math.PI / 2; hull.position.y = 0.83; hull.castShadow = true; craft.add(hull);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(outline), mat(style === 'freighter' ? '#d9e1c4' : '#fff5d6'));
  deck.rotation.x = -Math.PI / 2; deck.position.y = broad ? 1.82 : 1.61; deck.scale.set(0.83, 0.83, 1); craft.add(deck);
  const railPoints = [new THREE.Vector3(0, broad ? 1.9 : 1.68, front - 0.22), new THREE.Vector3(-half * .91, broad ? 1.9 : 1.68, front - 1.08), new THREE.Vector3(-half * .91, broad ? 1.9 : 1.68, back + .43), new THREE.Vector3(0, broad ? 1.9 : 1.68, back + .19), new THREE.Vector3(half * .91, broad ? 1.9 : 1.68, back + .43), new THREE.Vector3(half * .91, broad ? 1.9 : 1.68, front - 1.08)];
  craft.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints, true), 44, .06, 5, true), mat(style === 'patrol' ? '#dceef0' : '#ffe9ac')));
  const cabinZ = style === 'freighter' ? back + 0.85 : style === 'trawler' ? 0.15 : style === 'speedboat' ? -0.6 : -0.34;
  const cabinY = broad ? 2.08 : 1.95;
  const cabinW = style === 'freighter' ? 2.35 : style === 'trawler' ? 1.8 : style === 'cruiser' ? 1.9 : 1.18;
  const cabinD = style === 'cruiser' ? 1.95 : style === 'freighter' ? 1.35 : style === 'trawler' ? 1.35 : 1.08;
  box(craft, '#fff2d9', 0, cabinY, cabinZ, cabinW, style === 'freighter' ? 0.95 : 0.64, cabinD);
  box(craft, style === 'patrol' ? '#496e88' : style === 'cruiser' ? '#f9c8ae' : style === 'freighter' ? '#7f9db2' : '#e88470', 0, cabinY + (style === 'freighter' ? .57 : .39), cabinZ, cabinW + .18, .16, cabinD + .2);
  box(craft, '#83cbd0', 0, cabinY + .08, cabinZ + cabinD / 2 + .035, cabinW * .68, .28, .06);
  for (const side of [-1, 1]) {
    box(craft, '#8bd1d1', side * (cabinW / 2 + .025), cabinY + .06, cabinZ, .06, .25, cabinD * .45);
    for (const portholeZ of [back + .68, front - 1.15]) {
      const port = new THREE.Mesh(new THREE.CircleGeometry(.13, 9), new THREE.MeshBasicMaterial({ color: '#a5e1dc', side: THREE.DoubleSide }));
      port.rotation.y = Math.PI / 2; port.position.set(side * (half + .02), 1.26, portholeZ); craft.add(port);
    }
  }
  if (style === 'speedboat') {
    for (const side of [-1, 1]) box(craft, '#415c72', side * .46, 1.16, back - .13, .3, .35, .46);
    box(craft, '#e8f4ec', 0, 1.65, 1.38, 1.23, .12, .14).rotation.x = -.28;
  } else if (style === 'trawler') {
    cylinder(craft, '#8e7253', 0, 3.04, cabinZ, .08, 1.6);
    cone(craft, '#fff0c8', .44, 3.42, cabinZ, .42, .7, 3).rotation.z = -.28;
    for (const side of [-1, 1]) box(craft, '#d9ab6b', side * 1.39, 1.92, .45, .2, .15, 1.55);
  } else if (style === 'cruiser') {
    box(craft, '#fff7db', 0, 2.54, cabinZ - .35, 1.35, .13, .8);
    for (const side of [-1, 1]) box(craft, '#f9deb2', side * 1.1, 1.76, 1.6, .23, .16, 1.4);
  } else if (style === 'freighter') {
    for (const side of [-1, 1]) for (let i = 0; i < 2; i++) box(craft, ['#ecab76', '#8dcaaf', '#e7cf82', '#a8b1de'][(side + 1) + i], side * .72, 2.05 + i * .35, 1.3, 1.25, .33, 1.23);
    cylinder(craft, '#eef3dc', 0, 3.17, cabinZ, .085, 1.1);
  } else {
    cylinder(craft, '#f5f3d9', 0, 1.8, 1.38, .15, .22);
    cone(craft, '#ffce5c', 0, 2.1, 1.38, .25, .35, 5);
  }
  if (style === 'patrol') cylinder(craft, '#ffe36b', 0, 2.62, cabinZ, .19, .15);
  const cargo = new THREE.Group(); cargo.name = 'deck-cargo'; craft.add(cargo);
  ['#ffd95d', '#f49d77', '#8ed6ad'].forEach((c, i) => {
    const parcel = new THREE.Group(); parcel.position.set(i % 2 ? .38 : -.38, broad ? 2.1 + (i === 2 ? .22 : 0) : 1.92 + (i === 2 ? .22 : 0), style === 'freighter' ? .05 : back + .62);
    box(parcel, c, 0, 0, 0, .59, .42, .52); box(parcel, '#9a764e', 0, .01, 0, .05, .43, .54); cargo.add(parcel);
  });
  return craft;
}

function makeRock(parent: THREE.Object3D, x: number, z: number, size: number): THREE.Group {
  const group = new THREE.Group(); group.position.set(x, 0, z);
  const shape = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), mat(palette.rock));
  shape.scale.set(1, 0.62, 0.8); shape.position.y = size * 0.35; shape.rotation.set(0.15, z, 0.1); shape.castShadow = true; group.add(shape);
  const foam = new THREE.Mesh(new THREE.RingGeometry(size * 0.9, size * 1.25, 9), new THREE.MeshBasicMaterial({ color: '#a6e2d6', transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
  foam.rotation.x = -Math.PI / 2; foam.position.y = 0.04; group.add(foam); parent.add(group); return group;
}

function makeBuoy(parent: THREE.Object3D, x: number, z: number): THREE.Group {
  const buoy = new THREE.Group(); buoy.position.set(x, 0, z);
  cylinder(buoy, '#fff2d2', 0, 0.35, 0, 0.36, 0.28, 8);
  cone(buoy, '#ff7354', 0, 0.72, 0, 0.39, 0.55, 8);
  cylinder(buoy, '#344e60', 0, 1.05, 0, 0.07, 0.28, 8);
  parent.add(buoy); return buoy;
}

function makeIsland(parent: THREE.Object3D, x: number, z: number, scale = 1): void {
  const island = new THREE.Group(); island.position.set(x, 0, z); island.scale.setScalar(scale);
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 6.4, 0.7, 9), mat(palette.sand));
  sand.scale.z = 0.7; sand.position.y = 0.24; sand.receiveShadow = true; island.add(sand);
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.33, 9), mat(palette.grass));
  grass.scale.z = 0.67; grass.position.set(-0.25, 0.64, -0.1); grass.receiveShadow = true; island.add(grass);
  for (const [tx, tz] of [[-2.5, -0.1], [1.5, 0.8]] as const) {
    cylinder(island, '#ae8154', tx, 1.65, tz, 0.15, 2.1, 6);
    for (let i = 0; i < 5; i++) {
      const leaf = cone(island, i % 2 ? '#54a875' : '#3e976e', tx + Math.cos(i * 1.256) * 0.65, 2.83, tz + Math.sin(i * 1.256) * 0.65, 0.75, 1.5, 5);
      leaf.rotation.z = Math.cos(i * 1.256) * -0.42; leaf.rotation.x = Math.sin(i * 1.256) * 0.42;
    }
  }
  parent.add(island);
}

function makeHarbour(parent: THREE.Object3D, z: number, destination = false): void {
  const harbour = new THREE.Group(); harbour.position.z = z;
  makeIsland(harbour, -12, 0, 1.1); makeIsland(harbour, 12, 2, 0.92);
  box(harbour, '#aa764d', -7.5, 0.5, 0, 7, 0.68, 3.2);
  for (let i = 0; i < 5; i++) box(harbour, '#775a46', -10.6 + i * 1.5, 0.13, 0, 0.3, 0.7, 0.3);
  box(harbour, destination ? '#f5a2a2' : '#ffd780', -11.8, 2.4, -1.3, 4.25, 3.1, 3.4);
  const roof = box(harbour, destination ? '#be6183' : '#e7735a', -11.8, 4.22, -1.3, 5, 0.55, 4);
  roof.rotation.z = -0.08;
  box(harbour, '#fff4d2', -9.55, 2.52, -1.3, 0.12, 1.3, 1.3);
  for (let i = 0; i < 3; i++) box(harbour, ['#f89069', '#9cd8ad', '#b59cdd'][i], -7.1 + i * 0.9, 1.2, 1.4, 0.8, 0.8, 0.8);
  cylinder(harbour, '#fff7d8', 12.6, 3.05, 1.3, 0.95, 5.3, 8);
  cylinder(harbour, '#f26b60', 12.6, 5.83, 1.3, 1.15, 0.42, 8);
  cone(harbour, '#395b74', 12.6, 6.25, 1.3, 1.32, 0.7, 8);
  cylinder(harbour, '#f5cb69', 12.6, 5.44, 1.3, 0.57, 0.34, 8);
  parent.add(harbour);
}

function makeFish(color: string): { group: THREE.Group; tail: THREE.Group } {
  const fish = new THREE.Group();
  const silhouette = new THREE.Shape();
  silhouette.moveTo(0, 0.69);
  silhouette.bezierCurveTo(0.35, 0.5, 0.44, 0.09, 0.31, -0.22);
  silhouette.lineTo(0.17, -0.53); silhouette.lineTo(-0.17, -0.53);
  silhouette.lineTo(-0.31, -0.22);
  silhouette.bezierCurveTo(-0.44, 0.09, -0.35, 0.5, 0, 0.69);
  const body = new THREE.Mesh(new THREE.ShapeGeometry(silhouette, 6), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  body.rotation.x = Math.PI / 2; fish.add(body);
  const tail = new THREE.Group(); tail.position.z = -0.51; fish.add(tail);
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0.05); tailShape.lineTo(0.32, -0.39);
  tailShape.lineTo(0, -0.22); tailShape.lineTo(-0.32, -0.39); tailShape.closePath();
  const fin = new THREE.Mesh(new THREE.ShapeGeometry(tailShape), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  fin.rotation.x = Math.PI / 2; tail.add(fin);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.045, 6), new THREE.MeshBasicMaterial({ color: '#a9d7d5', side: THREE.DoubleSide }));
    eye.rotation.x = Math.PI / 2; eye.position.set(side * 0.13, 0.018, 0.43); fish.add(eye);
  }
  return { group: fish, tail };
}

function makeTurtle(): { group: THREE.Group; flippers: THREE.Mesh[] } {
  const turtle = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.88, 0), mat('#327f78'));
  shell.scale.set(0.9, 0.42, 1.15); shell.position.y = 0.36; turtle.add(shell);
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.56, 0), mat('#236a70'));
  top.scale.set(0.88, 0.3, 1.1); top.position.y = 0.61; turtle.add(top);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.31, 0), mat('#56a695'));
  head.position.set(0, 0.29, 0.95); turtle.add(head);
  const flippers: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const flipper = box(turtle, '#4d9d8d', side * 0.8, 0.14, 0.1, 0.6, 0.14, 0.3);
    flipper.rotation.y = side * 0.35;
    flippers.push(flipper);
  }
  return { group: turtle, flippers };
}

function makeGull(): { group: THREE.Group; wings: THREE.Mesh[] } {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), mat('#fff9e9'));
  body.scale.set(0.75, 0.42, 1.3); group.add(body);
  const wings: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const wing = box(group, '#fff9e9', side * 0.55, 0, 0, 1.05, 0.09, 0.26);
    wing.rotation.z = side * 0.18; wings.push(wing);
  }
  cone(group, '#f2bd61', 0, -0.04, 0.3, 0.1, 0.27, 3).rotation.x = Math.PI / 2;
  return { group, wings };
}

function makeHullFoam(width: number, length: number): THREE.Mesh {
  const foam = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1, 28),
    new THREE.MeshBasicMaterial({ color: '#d8f8e7', side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.scale.set(width, length, 1);
  return foam;
}

export interface Hazard { x: number; z: number; radius: number; kind: 'rock' | 'buoy'; mesh: THREE.Group; }
export interface Patrol { x: number; z: number; baseX: number; baseZ: number; phase: number; heading: number; chase: number; mesh: THREE.Group; light: THREE.Mesh; foam: THREE.Mesh; wake: THREE.Mesh; }
interface DockParcel { mesh: THREE.Object3D; start: THREE.Vector3; end: THREE.Vector3; launch: number }
interface Docking { fromX: number; fromZ: number; time: number; approach: number; parcels: Array<DockParcel | null> }

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-12, 12, 19, -19, 0.1, 200);
  boat = makeBoat(palette.coral);
  private readonly yard = new THREE.Group();
  private inYard = false;
  private yardCount = 0;
  readonly hazards: Hazard[] = [];
  readonly patrols: Patrol[] = [];
  private readonly route = new THREE.Group();
  private readonly ocean: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();
  private readonly waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly targetMarker = new THREE.Group();
  private readonly boatFoam: THREE.Mesh;
  private readonly bowWash = new THREE.Group();
  private readonly impactRing: THREE.Mesh;
  private readonly splashDrops: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number }> = [];
  private readonly wakes: Array<{ mesh: THREE.Mesh; age: number }> = [];
  private wakeTimer = 0;
  private nextWake = 0;
  private readonly waterMarks: THREE.Group[] = [];
  private readonly fishSchools: Array<{ group: THREE.Group; baseX: number; baseZ: number; phase: number; swimmers: Array<{ fish: THREE.Group; tail: THREE.Group; phase: number }> }> = [];
  private readonly turtles: Array<{ group: THREE.Group; flippers: THREE.Mesh[]; baseX: number; baseZ: number; phase: number }> = [];
  private readonly gulls: Array<{ group: THREE.Group; wings: THREE.Mesh[]; baseX: number; baseZ: number; phase: number }> = [];
  private readonly dockSparkles: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number }> = [];
  private readonly mooringLine: THREE.Line;
  private docking: Docking | null = null;
  private heading = 0;
  private damageTime = 0;
  private elapsed = 0;
  private width = 1;
  private height = 1;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(palette.water);
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(palette.water);
    this.scene.fog = new THREE.Fog(palette.water, 75, 150);
    this.scene.add(new THREE.HemisphereLight('#e0faff', '#478695', 2.6));
    const sun = new THREE.DirectionalLight('#fff4d6', 2.8);
    sun.position.set(-10, 22, -16); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -28; sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28; sun.shadow.bias = -0.0006;
    this.scene.add(sun); this.scene.add(sun.target);
    const water = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uDeep: { value: new THREE.Color('#087f94') },
        uLight: { value: new THREE.Color('#2ba9b1') }, uFoam: { value: new THREE.Color('#a1e6dc') },
      },
      vertexShader: `uniform float uTime; varying vec3 vWater;
        void main() {
          vec3 p = position;
          p.z = sin(p.x * 0.42 + uTime * 1.1) * 0.08 + sin(p.y * 0.25 - uTime * 0.85) * 0.06
            + sin(p.x * 0.9 + p.y * 0.47 + uTime * 1.55) * 0.035;
          vWater = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uTime; uniform vec3 uDeep; uniform vec3 uLight; uniform vec3 uFoam; varying vec3 vWater;
        float hash21(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float localRipple(vec2 p, float size, float speed, float offset) {
          vec2 cell = floor(p / size);
          vec2 local = fract(p / size);
          float seed = hash21(cell + offset);
          vec2 center = vec2(0.22 + hash21(cell + offset + 2.7) * 0.56,
                             0.22 + hash21(cell + offset + 7.3) * 0.56);
          float age = fract(uTime * speed + seed);
          float radius = mix(0.1, 0.31, age);
          vec2 delta = (local - center) * vec2(1.0, 0.73);
          float distanceToRing = abs(length(delta) - radius);
          float arc = smoothstep(0.72, 0.94, cos(atan(delta.y, delta.x) - seed * 6.283));
          return (1.0 - smoothstep(0.006, 0.021, distanceToRing)) * arc
            * (1.0 - age) * step(0.43, seed);
        }
        void main() {
          vec2 p = vWater.xz;
          vec2 folded = p + vec2(sin(p.y * 0.19 + uTime * 0.38) * 2.1,
            sin(p.x * 0.17 - uTime * 0.3) * 1.8);
          float swell = sin(folded.x * 0.27 + folded.y * 0.15 - uTime * 0.74);
          float crossing = sin(folded.y * 0.31 - folded.x * 0.24 + uTime * 0.98);
          float shade = clamp(0.49 + swell * crossing * 0.22 + swell * 0.065
            + sin(folded.x * 0.58 + cos(folded.y * 0.41 - uTime) * 1.4) * 0.035, 0.0, 1.0);
          float ripples = localRipple(p, 13.0, 0.13, 0.0)
            + localRipple(p + vec2(4.1, 6.7), 21.0, 0.09, 19.0);
          float glint = smoothstep(0.72, 0.97, swell * crossing) * 0.06;
          vec3 color = mix(uDeep, uLight, shade);
          color = mix(color, uFoam, min(0.26, ripples * 0.24 + glint));
          gl_FragColor = vec4(color, 0.82);
          #include <colorspace_fragment>
        }`,
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(220, 4000, 44, 500), water);
    this.ocean.rotation.x = -Math.PI / 2; this.ocean.position.set(0, -0.04, 260);
    this.ocean.renderOrder = -1; this.scene.add(this.ocean);
    this.scene.add(this.route); this.scene.add(this.boat); this.scene.add(this.yard);
    this.boatFoam = makeHullFoam(1.68, 2.55);
    this.scene.add(this.boatFoam);
    for (const side of [-1, 1]) {
      const wash = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.012, 1.25),
        new THREE.MeshBasicMaterial({ color: '#e0f9ed', transparent: true, opacity: 0.62, depthWrite: false }),
      );
      wash.position.set(side * 1.2, 0, 1.25);
      wash.rotation.y = side * 0.42;
      this.bowWash.add(wash);
    }
    this.scene.add(this.bowWash);
    const markerRing = new THREE.Mesh(new THREE.RingGeometry(0.47, 0.62, 18), new THREE.MeshBasicMaterial({ color: '#ffe27d', side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
    markerRing.rotation.x = -Math.PI / 2; markerRing.position.y = 0.08; this.targetMarker.add(markerRing);
    const markerDot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), new THREE.MeshBasicMaterial({ color: '#fff5da', side: THREE.DoubleSide }));
    markerDot.rotation.x = -Math.PI / 2; markerDot.position.y = 0.09; this.targetMarker.add(markerDot);
    this.targetMarker.visible = false; this.scene.add(this.targetMarker);
    this.impactRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.98, 20), new THREE.MeshBasicMaterial({ color: '#fff4d5', side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false }));
    this.impactRing.rotation.x = -Math.PI / 2; this.impactRing.visible = false; this.scene.add(this.impactRing);
    for (let i = 0; i < 10; i++) {
      const drop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 + (i % 3) * 0.035, 0), new THREE.MeshBasicMaterial({ color: i % 3 ? '#a5e9df' : '#fff4db', transparent: true, opacity: 0 }));
      drop.visible = false; this.scene.add(drop);
      this.splashDrops.push({ mesh: drop, vx: Math.cos(i * Math.PI / 5) * (2.6 + (i % 3)), vy: 2.7 + (i % 4) * 0.6, vz: Math.sin(i * Math.PI / 5) * (2.6 + (i % 3)) });
    }
    for (let i = 0; i < 18; i++) {
      const sparkle = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.19 + (i % 3) * 0.045),
        new THREE.MeshBasicMaterial({ color: ['#ffe27d', '#ff9b79', '#9ae2bf', '#fff5da'][i % 4], transparent: true, opacity: 0, depthWrite: false }),
      );
      sparkle.visible = false; this.scene.add(sparkle);
      const angle = i * Math.PI * 2 / 18;
      this.dockSparkles.push({ mesh: sparkle, vx: Math.cos(angle) * (1.5 + i % 3), vy: 2.8 + i % 4 * 0.35, vz: Math.sin(angle) * (1.5 + i % 4) });
    }
    this.mooringLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: '#fff1bd', transparent: true, opacity: 0.9 }),
    );
    this.mooringLine.visible = false; this.scene.add(this.mooringLine);
    for (let i = 0; i < 24; i++) {
      const wake = new THREE.Mesh(
        new THREE.RingGeometry(0.86, 1, 28, 1, 0.1, Math.PI - 0.2),
        new THREE.MeshBasicMaterial({ color: '#d5f8ed', side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false }),
      );
      wake.rotation.x = -Math.PI / 2; wake.visible = false; wake.renderOrder = 2; this.scene.add(wake);
      this.wakes.push({ mesh: wake, age: 2 });
    }
    this.buildRoute();
    this.resize(); window.addEventListener('resize', () => this.resize());
  }

  setBoat(craft: BoatDefinition): void {
    this.scene.remove(this.boat);
    this.boat = makeBoat(craft.color, craft.style);
    this.scene.add(this.boat);
    const size = craft.style === 'freighter' ? 1.42 : craft.style === 'cruiser' || craft.style === 'trawler' ? 1.22 : 1;
    this.boatFoam.scale.set(1.68 * size, 2.55 * size, 1);
  }

  showShipyard(owned: number[], active: number): void {
    this.inYard = true; this.yardCount = owned.length; this.yard.clear(); this.yard.visible = true; this.route.visible = false;
    this.boat.visible = false; this.boatFoam.visible = false; this.bowWash.visible = false;
    // A long timber quay with one moored, individual model for every owned craft.
    box(this.yard, '#886448', 0, .48, -8.8, 68, .95, 5.2);
    box(this.yard, '#c18b5b', 0, 1.02, -8.8, 68, .16, 5.2);
    for (let i = 0; i < 17; i++) box(this.yard, '#805c43', -32 + i * 4, 1.13, -8.8, .1, .03, 5.2);
    for (let i = 0; i < 6; i++) {
      const x = -31 + i * 12;
      cylinder(this.yard, '#6e5243', x, .82, -5.7, .21, 1.55);
      cylinder(this.yard, '#e9d4a0', x, 1.59, -5.7, .23, .1);
    }
    box(this.yard, '#f9dda7', -18, 2.25, -13.3, 7.6, 2.9, 3.7);
    const roof = box(this.yard, '#e37564', -18, 3.93, -13.3, 8.25, .36, 4.2); roof.rotation.z = -.05;
    box(this.yard, '#95c9bb', -18, 2.1, -11.4, 2.7, 1.45, .12);
    box(this.yard, '#f5d7a0', 13, 1.25, -10.2, 4.5, .5, 3.2);
    for (const [slot, index] of owned.entries()) {
      const def = BOATS[index]; const x = -23 + (slot - (owned.length - 1) / 2) * 7;
      const model = makeBoat(def.color, def.style); model.position.set(x, -.35, -4.5); model.rotation.y = -.15; this.yard.add(model);
      const foam = makeHullFoam(index >= 3 ? 2.4 : 1.8, index >= 3 ? 3.3 : 2.5); foam.position.set(x, .05, -4.5); this.yard.add(foam);
      if (index === active) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(3.25, 3.38, 32), new THREE.MeshBasicMaterial({ color: '#ffe888', side: THREE.DoubleSide, transparent: true, opacity: .75 }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(x, .07, -4.5); this.yard.add(ring);
      }
    }
  }

  hideShipyard(): void {
    if (!this.inYard) return;
    this.inYard = false; this.yard.visible = false; this.route.visible = true;
    this.boat.visible = true; this.boatFoam.visible = true;
  }

  resetVoyage(): void {
    this.docking?.parcels.forEach(parcel => { if (parcel) this.scene.remove(parcel.mesh); });
    this.docking = null;
    this.heading = 0;
    this.boat.getObjectByName('deck-cargo')?.children.forEach(parcel => { parcel.visible = true; });
    this.dockSparkles.forEach(({ mesh }) => { mesh.visible = false; });
    this.mooringLine.visible = false;
  }

  beginDocking(x: number, z: number): number {
    const approach = Math.max(2.2, Math.hypot(x + 1.8, z - 532) / 10.5);
    this.docking = { fromX: x, fromZ: z, time: 0, approach, parcels: [null, null, null] };
    return approach;
  }

  screenToWater(clientX: number, clientY: number): { x: number; z: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.waterPlane, new THREE.Vector3());
    return hit ? { x: hit.x, z: hit.z } : { x: this.boat.position.x, z: this.boat.position.z };
  }

  triggerDamage(): void {
    this.damageTime = 0.7;
    this.impactRing.visible = true;
    this.impactRing.position.set(this.boat.position.x, 0.08, this.boat.position.z);
    this.splashDrops.forEach((drop, i) => {
      drop.mesh.visible = true;
      drop.mesh.position.set(this.boat.position.x, 0.4, this.boat.position.z);
      drop.vy = 2.7 + (i % 4) * 0.6;
    });
  }

  private buildRoute(): void {
    this.route.clear(); this.hazards.length = 0; this.patrols.length = 0;
    makeHarbour(this.route, -13); makeHarbour(this.route, 535, true);
    for (let z = 20; z < 535; z += 36) {
      makeIsland(this.route, z % 72 === 20 ? -17 : 17, z, 0.55 + (z % 4) * 0.08);
    }
    const rocks = [[-4.5, 34, 1.5], [3.8, 69, 1.8], [-2.5, 113, 1.55], [5.1, 154, 1.65], [-5.4, 203, 1.6], [1.6, 248, 1.6], [5, 290, 1.5], [-3.7, 338, 1.7], [2.7, 383, 1.75], [-5, 430, 1.55], [4.5, 473, 1.65]];
    for (const [x, z, radius] of rocks) this.hazards.push({ x, z, radius, kind: 'rock', mesh: makeRock(this.route, x, z, radius) });
    for (let i = 0; i < 15; i++) {
      const z = 17 + i * 33;
      const x = (i % 2 ? -1 : 1) * (7.2 + (i % 3) * 0.3);
      this.hazards.push({ x, z, radius: 0.6, kind: 'buoy', mesh: makeBuoy(this.route, x, z) });
    }
    for (let i = 0; i < 6; i++) {
      const z = 55 + i * 78;
      const x = i % 2 ? -4 : 4;
      const initial = patrolPose(i, 0, x, z, i * 1.8);
      const mesh = makeBoat('#527798', 'patrol'); mesh.scale.setScalar(0.72); mesh.position.set(initial.x, -0.68, initial.z); mesh.rotation.y = initial.heading; this.route.add(mesh);
      const foam = makeHullFoam(1.22, 1.86); foam.position.set(x, 0.04, z); this.route.add(foam);
      const wake = new THREE.Mesh(
        new THREE.TorusGeometry(0.58, 0.045, 3, 10, Math.PI),
        new THREE.MeshBasicMaterial({ color: '#d8f8e7', transparent: true, opacity: 0.32, depthWrite: false }),
      );
      wake.rotation.x = -Math.PI / 2; wake.position.set(x, 0.05, z + 2); this.route.add(wake);
      const light = new THREE.Mesh(new THREE.ConeGeometry(3.6, 9, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#fff1a0', transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
      light.rotation.x = Math.PI / 2; light.position.set(0, 1.2, -5); mesh.add(light);
      this.patrols.push({ x: initial.x, z: initial.z, baseX: x, baseZ: z, phase: i * 1.8, heading: initial.heading, chase: 0, mesh, light, foam, wake });
    }
    // Small moving glints add texture without a remote water asset.
    this.waterMarks.forEach(mark => this.scene.remove(mark)); this.waterMarks.length = 0;
    for (let i = 0; i < 100; i++) {
      const mark = new THREE.Group();
      const line = box(mark, i % 3 ? '#55bec5' : '#8bd4cf', 0, 0.015, 0, 0.24 + (i % 4) * 0.18, 0.015, 0.04);
      line.castShadow = false; mark.position.set(((i * 37) % 25) - 12.5, 0, ((i * 73) % 560) - 20);
      this.scene.add(mark); this.waterMarks.push(mark);
    }
    const colors = ['#205a6d', '#286477', '#2f6d7d', '#315e70'];
    for (let i = 0; i < 10; i++) {
      const baseZ = 18 + i * 52;
      const baseX = i % 2 ? -6.3 : 6.2;
      const school = new THREE.Group();
      const swimmers: Array<{ fish: THREE.Group; tail: THREE.Group; phase: number }> = [];
      for (let j = 0; j < 4; j++) {
        const { group: fish, tail } = makeFish(colors[(i + j) % colors.length]);
        fish.position.set(j % 2 ? 0.58 : -0.58, 0, (Math.floor(j / 2) - 0.5) * 1.35);
        fish.scale.setScalar(1.08 + (j % 2) * 0.14); school.add(fish);
        swimmers.push({ fish, tail, phase: j * 1.4 + i * 0.3 });
      }
      this.route.add(school); this.fishSchools.push({ group: school, baseX, baseZ, phase: i * 1.47, swimmers });
    }
    for (let i = 0; i < 6; i++) {
      const turtle = makeTurtle(); this.route.add(turtle.group);
      this.turtles.push({ ...turtle, baseX: i % 2 ? -9 : 9, baseZ: 42 + i * 84, phase: i * 1.9 });
    }
    for (let i = 0; i < 8; i++) {
      const gull = makeGull(); this.route.add(gull.group);
      this.gulls.push({ ...gull, baseX: i % 2 ? -5 : 5, baseZ: 29 + i * 67, phase: i * 1.62 });
    }
  }

  resize(): void {
    const rect = this.renderer.domElement.parentElement!.getBoundingClientRect();
    this.width = Math.max(rect.width, 1); this.height = Math.max(rect.height, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.width < 720 ? 1.25 : 1.75));
    this.renderer.shadowMap.enabled = this.width >= 720;
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    const span = this.width < 720 ? 54 : 52;
    this.camera.left = -span * aspect / 2; this.camera.right = span * aspect / 2;
    this.camera.top = span / 2; this.camera.bottom = -span / 2; this.camera.updateProjectionMatrix();
  }

  private waterHeight(x: number, z: number): number {
    // Keep the hull and foam in phase with the ocean vertex shader.
    const localX = x - this.ocean.position.x;
    return -0.04 + Math.sin(localX * 0.42 + this.elapsed * 1.1) * 0.08
      + Math.sin((260 - z) * 0.25 - this.elapsed * 0.85) * 0.06
      + Math.sin(localX * 0.9 + (260 - z) * 0.47 + this.elapsed * 1.55) * 0.035;
  }

  update(dt: number, running: boolean, x: number, z: number, heat: number, boatSpeed: number, vx = 0, vz = 0, target: { x: number; z: number } | null = null): void {
    this.elapsed += dt;
    (this.ocean.material as THREE.ShaderMaterial).uniforms.uTime.value = this.elapsed;
    if (this.docking) {
      this.docking.time += dt;
      const progress = Math.min(1, this.docking.time / this.docking.approach);
      const eased = progress * progress * (3 - 2 * progress);
      const rate = 6 * progress * (1 - progress) / this.docking.approach;
      x = this.docking.fromX + (-1.8 - this.docking.fromX) * eased;
      z = this.docking.fromZ + (532 - this.docking.fromZ) * eased;
      vx = (-1.8 - this.docking.fromX) * rate;
      vz = (532 - this.docking.fromZ) * rate;
      boatSpeed = Math.hypot(vx, vz);
      target = null;
      running = true;
    }
    this.ocean.position.x = this.inYard ? 0 : x;
    if (running && boatSpeed > 0.3) {
      const targetHeading = Math.atan2(vx, vz);
      const difference = Math.atan2(Math.sin(targetHeading - this.heading), Math.cos(targetHeading - this.heading));
      this.heading += difference * Math.min(1, dt * 3.2);
    }
    const surface = this.waterHeight(x, z);
    const bob = Math.sin(this.elapsed * 2.15 + z * 0.15) * 0.04;
    this.boat.position.set(x, surface - 0.94 + bob, z);
    this.boat.rotation.set(
      Math.sin(this.elapsed * 1.75 + z * 0.08) * 0.038 + vz * 0.003,
      this.heading,
      Math.sin(this.elapsed * 2.1 + x * 0.3) * 0.045 - vx * 0.007 + (this.damageTime > 0 ? Math.sin(this.elapsed * 46) * this.damageTime * 0.17 : 0),
    );
    if (this.docking) {
      this.boat.updateMatrixWorld(true);
      const cargo = this.boat.getObjectByName('deck-cargo') as THREE.Group;
      cargo.children.forEach((parcel, i) => {
        const launch = this.docking!.approach + 0.18 + i * 0.54;
        if (this.docking!.time >= launch && !this.docking!.parcels[i]) {
          const start = parcel.getWorldPosition(new THREE.Vector3());
          const clone = parcel.clone(true);
          clone.position.copy(start);
          clone.rotation.y = this.heading;
          this.scene.add(clone);
          parcel.visible = false;
          this.docking!.parcels[i] = {
            mesh: clone, start, launch,
            end: new THREE.Vector3(-7.2 + (i % 2) * 0.8, i === 2 ? 1.54 : 1.08, 535 + (i === 1 ? 0.55 : 0)),
          };
        }
      });
      this.docking.parcels.forEach(parcel => {
        if (!parcel) return;
        const t = Math.min(1, (this.docking!.time - parcel.launch) / 0.84);
        const eased = t * t * (3 - 2 * t);
        parcel.mesh.position.copy(parcel.start).lerp(parcel.end, eased);
        parcel.mesh.position.y += Math.sin(Math.PI * t) * 1.8;
        parcel.mesh.rotation.z = Math.sin(Math.PI * t) * 0.2;
        parcel.mesh.scale.setScalar(1.42 + Math.sin(Math.PI * Math.max(0, t - 0.74) / 0.26) * 0.09);
      });
      this.mooringLine.visible = this.docking.time > this.docking.approach + 0.15;
      if (this.mooringLine.visible) {
        const line = this.mooringLine.geometry.getAttribute('position') as THREE.BufferAttribute;
        line.setXYZ(0, x - 1.15, surface + 0.85, z + 0.65);
        line.setXYZ(1, -4.3, 0.95, 534.3);
        line.needsUpdate = true;
      }
      const burstAge = this.docking.time - (this.docking.approach + 2.0);
      this.dockSparkles.forEach(({ mesh, vx: sparkleVx, vy, vz: sparkleVz }) => {
        mesh.visible = burstAge >= 0 && burstAge < 1.25;
        if (!mesh.visible) return;
        mesh.position.set(-7.0 + sparkleVx * burstAge, 1.5 + vy * burstAge - 3.5 * burstAge * burstAge, 535 + sparkleVz * burstAge);
        mesh.rotation.set(burstAge * 6, burstAge * 5, burstAge * 4);
        (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - burstAge / 1.25);
      });
    }
    this.boatFoam.position.set(x, surface + 0.06, z);
    this.boatFoam.rotation.z = -this.heading;
    (this.boatFoam.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.min(boatSpeed / 9.2, 1) * 0.25 + Math.sin(this.elapsed * 4) * 0.04;
    this.bowWash.position.set(x, surface + 0.075, z);
    this.bowWash.rotation.y = this.heading;
    this.bowWash.visible = running && boatSpeed > 0.8;
    this.bowWash.children.forEach((child, index) => {
      (child as THREE.Mesh).scale.z = 0.85 + Math.sin(this.elapsed * 8 + index * 1.3) * 0.15;
    });
    this.targetMarker.visible = Boolean(running && target);
    if (target) {
      this.targetMarker.position.set(target.x, 0, target.z);
      const pulse = 1 + Math.sin(this.elapsed * 6) * 0.1;
      this.targetMarker.scale.setScalar(pulse);
    }
    if (running && boatSpeed > 0.8) {
      this.wakeTimer += dt;
      const interval = Math.max(0.11, 0.24 - boatSpeed * 0.012);
      if (this.wakeTimer >= interval) {
        this.wakeTimer = 0;
        const ripple = this.wakes[this.nextWake];
        this.nextWake = (this.nextWake + 1) % this.wakes.length;
        const wakeX = x - Math.sin(this.heading) * 2.25;
        const wakeZ = z - Math.cos(this.heading) * 2.25;
        ripple.mesh.position.set(wakeX, this.waterHeight(wakeX, wakeZ) + 0.075, wakeZ);
        ripple.mesh.rotation.order = 'YXZ';
        ripple.mesh.rotation.set(-Math.PI / 2, -this.heading, 0);
        ripple.age = 0;
        ripple.mesh.visible = true;
      }
    } else this.wakeTimer = 0;
    for (const ripple of this.wakes) {
      if (!ripple.mesh.visible) continue;
      ripple.age += dt;
      const life = 1.8;
      const progress = Math.min(1, ripple.age / life);
      ripple.mesh.scale.set(0.85 + progress * 2.25, 0.85 + progress * 1.35, 1);
      ripple.mesh.position.y = this.waterHeight(ripple.mesh.position.x, ripple.mesh.position.z) + 0.075;
      (ripple.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) ** 1.5 * 0.72;
      if (progress >= 1) ripple.mesh.visible = false;
    }
    this.waterMarks.forEach((mark, i) => {
      mark.position.z += dt * (0.3 + (i % 4) * 0.15);
      if (mark.position.z > 540) mark.position.z = -20;
      mark.position.x += Math.sin(this.elapsed * 0.7 + i) * dt * 0.035;
    });
    this.fishSchools.forEach(({ group, baseX, baseZ, phase, swimmers }) => {
      const swimTime = this.elapsed * 0.62 + phase;
      const swimX = baseX + Math.sin(swimTime) * 2.2;
      const swimZ = baseZ + Math.cos(swimTime) * 3.2;
      group.position.set(swimX, -0.48 + Math.sin(this.elapsed * 1.8 + phase) * 0.02, swimZ);
      group.rotation.y = Math.atan2(Math.cos(swimTime) * 2.2, -Math.sin(swimTime) * 3.2);
      swimmers.forEach(({ fish, tail, phase: fishPhase }) => {
        tail.rotation.y = Math.sin(this.elapsed * 9 + fishPhase) * 0.52;
        fish.position.y = Math.sin(this.elapsed * 3.4 + fishPhase) * 0.02;
        fish.rotation.y = Math.sin(this.elapsed * 9 + fishPhase) * 0.06;
      });
    });
    this.turtles.forEach(({ group, flippers, baseX, baseZ, phase }) => {
      const swimTime = this.elapsed * 0.4 + phase;
      group.position.set(baseX + Math.sin(swimTime) * 1.3, -1.12 + Math.sin(this.elapsed * 1.1 + phase) * 0.07, baseZ + Math.cos(swimTime) * 2.5);
      group.rotation.y = Math.atan2(Math.cos(swimTime) * 1.3, -Math.sin(swimTime) * 2.5);
      flippers.forEach((flipper, side) => {
        flipper.rotation.z = (side ? -1 : 1) * (0.14 + Math.sin(this.elapsed * 4 + phase) * 0.26);
      });
    });
    this.gulls.forEach(({ group, wings, baseX, baseZ, phase }) => {
      group.position.set(baseX + Math.sin(this.elapsed * 0.42 + phase) * 4.2, 4.8 + Math.sin(this.elapsed * 1.7 + phase) * 0.5, baseZ + Math.cos(this.elapsed * 0.42 + phase) * 5);
      group.rotation.y = this.elapsed * 0.26 + phase;
      wings.forEach((wing, index) => { wing.rotation.z = (index ? 1 : -1) * (0.16 + Math.sin(this.elapsed * 7 + phase) * 0.38); });
    });
    if (this.damageTime > 0) {
      this.damageTime = Math.max(0, this.damageTime - dt);
      const progress = 1 - this.damageTime / 0.7;
      this.impactRing.scale.setScalar(1 + progress * 2.4);
      (this.impactRing.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.75;
      this.splashDrops.forEach(drop => {
        drop.mesh.position.x += drop.vx * dt;
        drop.mesh.position.z += drop.vz * dt;
        drop.mesh.position.y += drop.vy * dt;
        drop.vy -= 8.5 * dt;
        (drop.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.95;
      });
      const hull = this.boat.children[0] as THREE.Mesh;
      (hull.material as THREE.MeshStandardMaterial).emissive.set(progress < 0.6 && Math.floor(progress * 12) % 2 === 0 ? '#b62e23' : '#000000');
    } else {
      this.impactRing.visible = false;
      this.splashDrops.forEach(drop => { drop.mesh.visible = false; });
      ((this.boat.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.set('#000000');
    }
    this.patrols.forEach((patrol, i) => {
      const pose = patrolPose(i, this.elapsed, patrol.baseX, patrol.baseZ, patrol.phase);
      const chasing = running && heat > 65 && z > patrol.baseZ - 15 && z < patrol.baseZ + 19
        && Math.abs(x - pose.x) < 16;
      patrol.chase += ((chasing ? 1 : 0) - patrol.chase) * Math.min(1, dt * 1.4);
      const nextX = pose.x + (x - pose.x) * patrol.chase * 0.65;
      const nextZ = pose.z + (z + 2 - pose.z) * patrol.chase * 0.65;
      const travelX = nextX - patrol.x;
      const travelZ = nextZ - patrol.z;
      const targetHeading = Math.hypot(travelX, travelZ) > 0.002 ? Math.atan2(travelX, travelZ) : pose.heading;
      const turn = Math.atan2(Math.sin(targetHeading - patrol.heading), Math.cos(targetHeading - patrol.heading));
      patrol.heading += turn * Math.min(1, dt * 4);
      patrol.x = nextX; patrol.z = nextZ;
      patrol.mesh.position.x = nextX;
      patrol.mesh.position.z = nextZ;
      const patrolSurface = this.waterHeight(patrol.mesh.position.x, patrol.mesh.position.z);
      patrol.mesh.position.y = patrolSurface - 0.68 + Math.sin(this.elapsed * 2 + patrol.phase) * 0.02;
      patrol.mesh.rotation.x = Math.sin(this.elapsed * 1.7 + patrol.phase) * 0.024;
      patrol.mesh.rotation.y = patrol.heading;
      patrol.mesh.rotation.z = Math.sin(this.elapsed * 2.1 + patrol.phase) * 0.035;
      patrol.foam.position.set(patrol.mesh.position.x, patrolSurface + 0.055, patrol.mesh.position.z);
      patrol.foam.rotation.z = -patrol.heading;
      (patrol.foam.material as THREE.MeshBasicMaterial).opacity = 0.38 + Math.sin(this.elapsed * 3.3 + patrol.phase) * 0.06;
      const wakeX = patrol.x - Math.sin(patrol.heading) * 2;
      const wakeZ = patrol.z - Math.cos(patrol.heading) * 2;
      patrol.wake.position.set(wakeX, this.waterHeight(wakeX, wakeZ) + 0.06, wakeZ);
      patrol.wake.rotation.z = Math.PI - patrol.heading;
      (patrol.light.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(this.elapsed * 2 + i) * 0.03;
    });
    const narrow = this.width < 720;
    const targetZ = this.inYard ? -14 : this.docking ? z + (narrow ? 3 : 5) : running ? z + (narrow ? 8 : 14) : -7;
    const targetX = this.inYard ? 0 : this.docking ? x - 2.8 : running ? x : 0;
    const factor = Math.min(1, dt * 2.5);
    this.camera.zoom += ((this.inYard ? (narrow ? .8 : Math.max(.7, 1.08 - (this.yardCount - 1) * .09)) : this.docking ? 1.42 : 1) - this.camera.zoom) * factor;
    this.camera.updateProjectionMatrix();
    this.camera.position.lerp(new THREE.Vector3(targetX + (narrow ? 6 : 16), 31, targetZ - (narrow ? 25 : 28)), factor);
    this.camera.lookAt(targetX, 0, targetZ + (narrow ? 2 : 5));
    if (this.damageTime > 0) this.camera.position.x += Math.sin(this.elapsed * 63) * this.damageTime * 0.08;
    this.renderer.render(this.scene, this.camera);
  }
}
