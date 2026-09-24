import * as THREE from 'three';

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

function makeBoat(color: string, patrol = false): THREE.Group {
  const boat = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 2.45); shape.lineTo(-1.25, 1.25); shape.lineTo(-1.34, -1.65);
  shape.quadraticCurveTo(0, -2.12, 1.34, -1.65); shape.lineTo(1.25, 1.25); shape.closePath();
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.62, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1, curveSegments: 2 }), mat(color));
  hull.rotation.x = -Math.PI / 2; hull.position.y = 0.85; hull.castShadow = true; hull.receiveShadow = true; boat.add(hull);
  box(boat, '#fff8e2', 0, 1.49, -0.1, 2.08, 0.12, 2.8);
  box(boat, patrol ? '#d4e6eb' : '#9d6a46', 0, 1.6, -1.05, 1.65, 0.16, 0.65);
  box(boat, patrol ? '#466b82' : '#fff6db', 0, 1.85, -0.62, 1.22, 0.55, 0.85);
  box(boat, '#5eaeae', 0, 2.08, -0.22, 1.13, 0.31, 0.09);
  box(boat, '#fff5da', 0, 1.62, 1.37, 0.15, 0.1, 0.6);
  cylinder(boat, '#566976', 0, 1.63, -2.06, 0.26, 0.34);
  if (patrol) {
    cylinder(boat, '#ffe36b', 0, 2.25, -0.88, 0.18, 0.1);
    box(boat, '#fef3d9', 0, 2.38, -0.88, 0.55, 0.07, 0.08);
  } else {
    const crateColors = ['#ffd95d', '#f49d77', '#8ed6ad'];
    crateColors.forEach((c, i) => {
      box(boat, c, i % 2 ? 0.42 : -0.42, 1.91 + (i === 2 ? 0.3 : 0), i === 2 ? -1.55 : -1.52, 0.72, 0.58, 0.58);
      box(boat, '#9a764e', i % 2 ? 0.42 : -0.42, 1.93 + (i === 2 ? 0.3 : 0), i === 2 ? -1.52 : -1.49, 0.07, 0.6, 0.65);
    });
    cylinder(boat, '#f5f3d9', 0, 2.02, 0.57, 0.16, 0.18);
    cone(boat, '#ffce5c', 0, 2.35, 0.57, 0.27, 0.42, 5);
  }
  return boat;
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

export interface Hazard { x: number; z: number; radius: number; kind: 'rock' | 'buoy'; mesh: THREE.Group; }
export interface Patrol { x: number; z: number; baseX: number; phase: number; mesh: THREE.Group; light: THREE.Mesh; }

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-12, 12, 19, -19, 0.1, 200);
  readonly boat = makeBoat(palette.coral);
  readonly hazards: Hazard[] = [];
  readonly patrols: Patrol[] = [];
  private readonly route = new THREE.Group();
  private readonly ocean: THREE.Mesh;
  private readonly wakes: THREE.Mesh[] = [];
  private readonly waterMarks: THREE.Group[] = [];
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
    this.scene.fog = new THREE.Fog(palette.water, 55, 120);
    this.scene.add(new THREE.HemisphereLight('#e0faff', '#478695', 2.6));
    const sun = new THREE.DirectionalLight('#fff4d6', 2.8);
    sun.position.set(-10, 22, -16); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -28; sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28; sun.shadow.bias = -0.0006;
    this.scene.add(sun); this.scene.add(sun.target);
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(130, 1150), mat(palette.water));
    this.ocean.rotation.x = -Math.PI / 2; this.ocean.position.set(0, -0.04, 260); this.ocean.receiveShadow = true; this.scene.add(this.ocean);
    this.scene.add(this.route); this.scene.add(this.boat);
    for (let i = 0; i < 8; i++) {
      const wake = new THREE.Mesh(new THREE.TorusGeometry(0.48 + i * 0.08, 0.045, 3, 9, Math.PI), new THREE.MeshBasicMaterial({ color: '#b6ede3', transparent: true, opacity: 0.55 - i * 0.04 }));
      wake.rotation.x = -Math.PI / 2; wake.rotation.z = Math.PI; this.scene.add(wake); this.wakes.push(wake);
    }
    this.buildRoute();
    this.resize(); window.addEventListener('resize', () => this.resize());
  }

  setBoatColor(color: string): void {
    const hull = this.boat.children[0] as THREE.Mesh;
    (hull.material as THREE.MeshStandardMaterial).color.set(color);
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
      const mesh = makeBoat('#527798', true); mesh.scale.setScalar(0.72); mesh.position.set(x, 0, z); mesh.rotation.y = Math.PI; this.route.add(mesh);
      const light = new THREE.Mesh(new THREE.ConeGeometry(3.6, 9, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#fff1a0', transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
      light.rotation.x = Math.PI / 2; light.position.set(0, 1.2, -5); mesh.add(light);
      this.patrols.push({ x, z, baseX: x, phase: i * 1.8, mesh, light });
    }
    // Small moving glints add texture without a remote water asset.
    this.waterMarks.forEach(mark => this.scene.remove(mark)); this.waterMarks.length = 0;
    for (let i = 0; i < 100; i++) {
      const mark = new THREE.Group();
      const line = box(mark, i % 3 ? '#55bec5' : '#8bd4cf', 0, 0.015, 0, 0.24 + (i % 4) * 0.18, 0.015, 0.04);
      line.castShadow = false; mark.position.set(((i * 37) % 25) - 12.5, 0, ((i * 73) % 560) - 20);
      this.scene.add(mark); this.waterMarks.push(mark);
    }
  }

  resize(): void {
    const rect = this.renderer.domElement.parentElement!.getBoundingClientRect();
    this.width = Math.max(rect.width, 1); this.height = Math.max(rect.height, 1);
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    const span = this.width < 720 ? 26 : 31;
    this.camera.left = -span * aspect / 2; this.camera.right = span * aspect / 2;
    this.camera.top = span / 2; this.camera.bottom = -span / 2; this.camera.updateProjectionMatrix();
  }

  update(dt: number, running: boolean, x: number, z: number, heat: number, boatSpeed: number): void {
    this.elapsed += dt;
    this.boat.position.set(x, Math.sin(this.elapsed * 3.4) * 0.055, z);
    this.boat.rotation.set(0, -Math.sin(this.elapsed * 1.7) * 0.035, Math.sin(this.elapsed * 2.4) * 0.035);
    for (let i = 0; i < this.wakes.length; i++) {
      const wake = this.wakes[i]; wake.position.set(x + Math.sin(this.elapsed * 2 - i) * 0.07, 0.03, z - 2.9 - i * 0.75);
      wake.visible = running && boatSpeed > 3;
    }
    this.patrols.forEach((patrol, i) => {
      patrol.x = patrol.baseX + Math.sin(this.elapsed * (0.6 + i * 0.05) + patrol.phase) * 2.2;
      const chasing = running && heat > 65 && z > patrol.z - 15 && z < patrol.z + 19;
      if (chasing) patrol.x += (x - patrol.x) * 0.55;
      patrol.mesh.position.x = patrol.x;
      patrol.mesh.position.z = chasing ? Math.max(patrol.z, z + 1.15) : patrol.z + Math.sin(this.elapsed * 0.8 + i) * 2;
      (patrol.light.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(this.elapsed * 2 + i) * 0.03;
    });
    const targetZ = running ? z + 7.5 : -7;
    const targetX = running ? x * 0.34 : 0;
    const factor = Math.min(1, dt * 3.5);
    this.camera.position.lerp(new THREE.Vector3(targetX + 11.5, 22, targetZ - 19), factor);
    this.camera.lookAt(targetX, 0, targetZ + 4.2);
    this.renderer.render(this.scene, this.camera);
  }
}
