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

function makeFish(color: string): THREE.Group {
  const fish = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 0), mat(color));
  body.scale.set(0.72, 0.4, 1.2); body.position.y = 0.18; fish.add(body);
  const tail = cone(fish, color, 0, 0.18, -0.67, 0.3, 0.48, 3); tail.rotation.x = -Math.PI / 2;
  cone(fish, '#f8df98', 0, 0.47, 0.03, 0.15, 0.32, 3);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 4), mat('#183f4e'));
    eye.position.set(side * 0.28, 0.27, 0.31); fish.add(eye);
  }
  return fish;
}

function makeTurtle(): THREE.Group {
  const turtle = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.88, 0), mat('#68b879'));
  shell.scale.set(0.9, 0.48, 1.15); shell.position.y = 0.36; shell.castShadow = true; turtle.add(shell);
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.56, 0), mat('#3e956f'));
  top.scale.set(0.88, 0.34, 1.1); top.position.y = 0.69; turtle.add(top);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.31, 0), mat('#8bd090'));
  head.position.set(0, 0.29, 0.95); turtle.add(head);
  for (const side of [-1, 1]) {
    const flipper = box(turtle, '#7cc987', side * 0.8, 0.14, 0.1, 0.6, 0.14, 0.3);
    flipper.rotation.y = side * 0.35;
  }
  return turtle;
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
  private readonly raycaster = new THREE.Raycaster();
  private readonly waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly targetMarker = new THREE.Group();
  private readonly shadowBlob: THREE.Mesh;
  private readonly impactRing: THREE.Mesh;
  private readonly splashDrops: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number }> = [];
  private readonly wakes: THREE.Mesh[] = [];
  private readonly waterMarks: THREE.Group[] = [];
  private readonly fishSchools: Array<{ group: THREE.Group; baseX: number; baseZ: number; phase: number }> = [];
  private readonly turtles: Array<{ group: THREE.Group; baseX: number; baseZ: number; phase: number }> = [];
  private readonly gulls: Array<{ group: THREE.Group; wings: THREE.Mesh[]; baseX: number; baseZ: number; phase: number }> = [];
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
      uniforms: {
        uTime: { value: 0 }, uDeep: { value: new THREE.Color('#087f94') },
        uLight: { value: new THREE.Color('#2ba9b1') }, uFoam: { value: new THREE.Color('#a1e6dc') },
      },
      vertexShader: `uniform float uTime; varying vec3 vWater;
        void main() {
          vec3 p = position;
          p.z = sin(p.x * 0.42 + uTime * 1.1) * 0.08 + sin(p.y * 0.25 - uTime * 0.85) * 0.06;
          vWater = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uTime; uniform vec3 uDeep; uniform vec3 uLight; uniform vec3 uFoam; varying vec3 vWater;
        void main() {
          float broad = sin(vWater.x * 0.53 + vWater.z * 0.19 - uTime * 0.9);
          float cross = sin(vWater.z * 0.42 - vWater.x * 0.24 + uTime * 1.05);
          float chop = sin(vWater.z * 1.35 + vWater.x * 0.66 - uTime * 1.9);
          float shade = clamp(0.48 + broad * 0.16 + cross * 0.11 + chop * 0.035, 0.0, 1.0);
          float glint = smoothstep(0.79, 0.98, 0.5 + broad * 0.23 + cross * 0.24);
          vec3 color = mix(uDeep, uLight, shade) + uFoam * glint * 0.055;
          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(130, 1150, 30, 170), water);
    this.ocean.rotation.x = -Math.PI / 2; this.ocean.position.set(0, -0.04, 260); this.scene.add(this.ocean);
    this.scene.add(this.route); this.scene.add(this.boat);
    this.shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(2.05, 16), new THREE.MeshBasicMaterial({ color: '#075466', transparent: true, opacity: 0.3, depthWrite: false }));
    this.shadowBlob.rotation.x = -Math.PI / 2; this.shadowBlob.position.y = 0.015; this.scene.add(this.shadowBlob);
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
    const colors = ['#ffe288', '#ff9d77', '#a7dcff', '#f5a5b6'];
    for (let i = 0; i < 10; i++) {
      const baseZ = 18 + i * 52;
      const baseX = i % 2 ? -6.3 : 6.2;
      const school = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const fish = makeFish(colors[(i + j) % colors.length]);
        fish.position.set((j % 2) * 0.8, 0, Math.floor(j / 2) * 1.15);
        fish.scale.setScalar(0.8 + (j % 2) * 0.18); school.add(fish);
      }
      this.route.add(school); this.fishSchools.push({ group: school, baseX, baseZ, phase: i * 1.47 });
    }
    for (let i = 0; i < 6; i++) {
      const turtle = makeTurtle(); this.route.add(turtle);
      this.turtles.push({ group: turtle, baseX: i % 2 ? -9 : 9, baseZ: 42 + i * 84, phase: i * 1.9 });
    }
    for (let i = 0; i < 8; i++) {
      const gull = makeGull(); this.route.add(gull.group);
      this.gulls.push({ ...gull, baseX: i % 2 ? -5 : 5, baseZ: 29 + i * 67, phase: i * 1.62 });
    }
  }

  resize(): void {
    const rect = this.renderer.domElement.parentElement!.getBoundingClientRect();
    this.width = Math.max(rect.width, 1); this.height = Math.max(rect.height, 1);
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    const span = this.width < 720 ? 38 : 43;
    this.camera.left = -span * aspect / 2; this.camera.right = span * aspect / 2;
    this.camera.top = span / 2; this.camera.bottom = -span / 2; this.camera.updateProjectionMatrix();
  }

  update(dt: number, running: boolean, x: number, z: number, heat: number, boatSpeed: number, vx = 0, vz = 0, target: { x: number; z: number } | null = null): void {
    this.elapsed += dt;
    (this.ocean.material as THREE.ShaderMaterial).uniforms.uTime.value = this.elapsed;
    if (running && boatSpeed > 0.3) {
      const targetHeading = Math.atan2(vx, vz);
      const difference = Math.atan2(Math.sin(targetHeading - this.heading), Math.cos(targetHeading - this.heading));
      this.heading += difference * Math.min(1, dt * 3.2);
    }
    this.boat.position.set(x, Math.sin(this.elapsed * 3.4) * 0.055, z);
    this.boat.rotation.set(0, this.heading, Math.sin(this.elapsed * 2.4) * 0.035 + (this.damageTime > 0 ? Math.sin(this.elapsed * 46) * this.damageTime * 0.17 : 0));
    this.shadowBlob.position.set(x + 0.25, 0.015, z - 0.2);
    this.shadowBlob.rotation.z = -this.heading;
    this.targetMarker.visible = Boolean(running && target);
    if (target) {
      this.targetMarker.position.set(target.x, 0, target.z);
      const pulse = 1 + Math.sin(this.elapsed * 6) * 0.1;
      this.targetMarker.scale.setScalar(pulse);
    }
    for (let i = 0; i < this.wakes.length; i++) {
      const wake = this.wakes[i];
      const distance = 2.9 + i * 0.75;
      wake.position.set(x - Math.sin(this.heading) * distance, 0.03, z - Math.cos(this.heading) * distance);
      wake.rotation.z = Math.PI - this.heading;
      wake.visible = running && boatSpeed > 0.8;
    }
    this.waterMarks.forEach((mark, i) => {
      mark.position.z += dt * (0.3 + (i % 4) * 0.15);
      if (mark.position.z > 540) mark.position.z = -20;
      mark.position.x += Math.sin(this.elapsed * 0.7 + i) * dt * 0.035;
    });
    this.fishSchools.forEach(({ group, baseX, baseZ, phase }) => {
      group.position.set(baseX + Math.sin(this.elapsed * 0.68 + phase) * 1.75, Math.sin(this.elapsed * 2 + phase) * 0.09, baseZ + Math.cos(this.elapsed * 0.45 + phase) * 3.6);
      group.rotation.y = Math.sin(this.elapsed * 0.62 + phase) * 0.55;
    });
    this.turtles.forEach(({ group, baseX, baseZ, phase }) => {
      group.position.set(baseX + Math.sin(this.elapsed * 0.35 + phase) * 1.1, Math.sin(this.elapsed * 1.1 + phase) * 0.05, baseZ + Math.cos(this.elapsed * 0.3 + phase) * 2.3);
      group.rotation.y = Math.sin(this.elapsed * 0.35 + phase) * 0.45;
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
      patrol.x = patrol.baseX + Math.sin(this.elapsed * (0.6 + i * 0.05) + patrol.phase) * 2.2;
      const chasing = running && heat > 65 && z > patrol.z - 15 && z < patrol.z + 19;
      if (chasing) patrol.x += (x - patrol.x) * 0.55;
      patrol.mesh.position.x = patrol.x;
      patrol.mesh.position.z = chasing ? Math.max(patrol.z, z + 1.15) : patrol.z + Math.sin(this.elapsed * 0.8 + i) * 2;
      (patrol.light.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(this.elapsed * 2 + i) * 0.03;
    });
    const targetZ = running ? z + 10 : -7;
    const targetX = running ? x * 0.5 : 0;
    const factor = Math.min(1, dt * 2.5);
    this.camera.position.lerp(new THREE.Vector3(targetX + 16, 31, targetZ - 28), factor);
    this.camera.lookAt(targetX, 0, targetZ + 5);
    if (this.damageTime > 0) this.camera.position.x += Math.sin(this.elapsed * 63) * this.damageTime * 0.08;
    this.renderer.render(this.scene, this.camera);
  }
}
