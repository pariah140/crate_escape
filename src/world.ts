import * as THREE from 'three';
import { patrolPose } from './patrols';
import { channelCenter, channelHalfWidth, destinationX, destinationZ, harborCourseSlope, levelPlan, offshoreState, offshoreWaveStrength, type HazardKind, type LevelPlan } from './levels';
import { screenBearing } from './navigation';
import { HARBORS, type Biome } from './harbors';
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

function tube(parent: THREE.Object3D, color: string, points: THREE.Vector3[], radius = .045): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(8, points.length * 5), radius, 5, false), mat(color));
  mesh.castShadow = true; parent.add(mesh); return mesh;
}

function shapedHull(parent: THREE.Object3D, color: string, half: number, front: number, back: number, kind: 'pointed' | 'round' | 'square' = 'round', offsetX = 0): void {
  const bow = kind === 'square' ? .72 : kind === 'pointed' ? .09 : .38;
  const stern = kind === 'square' ? .9 : .56;
  const edge: Array<[number, number]> = [
    [0, front], [-half * bow, front - .16], [-half * .88, front - (kind === 'pointed' ? .9 : .48)],
    [-half, front - (kind === 'pointed' ? 1.45 : .85)], [-half, back + .48], [-half * stern, back],
    [half * stern, back], [half, back + .48], [half, front - (kind === 'pointed' ? 1.45 : .85)],
    [half * .88, front - (kind === 'pointed' ? .9 : .48)], [half * bow, front - .16],
  ];
  const shape = new THREE.Shape();
  edge.forEach(([x, z], index) => index ? shape.lineTo(x + offsetX, -z) : shape.moveTo(x + offsetX, -z));
  shape.closePath();
  const top = kind === 'square' ? 1.72 : 1.56;
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: '#e8d9b7', roughness: .93, side: THREE.DoubleSide, flatShading: true }));
  deck.rotation.x = -Math.PI / 2; deck.position.y = top + .035; deck.receiveShadow = true; parent.add(deck);
  const ringGeometry = (upper: boolean): THREE.BufferGeometry => {
    const positions: number[] = []; const indices: number[] = [];
    for (const [x, z] of edge) {
      const inset = upper ? .83 : .83;
      positions.push(x + offsetX, upper ? top : .96, z, x * inset + offsetX, upper ? .96 : .47, z * (upper ? .94 : .85));
    }
    for (let i = 0; i < edge.length; i++) {
      const next = (i + 1) % edge.length;
      indices.push(i * 2, next * 2, i * 2 + 1, next * 2, next * 2 + 1, i * 2 + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  };
  const upper = new THREE.Mesh(ringGeometry(true), new THREE.MeshStandardMaterial({ color, roughness: .74, flatShading: true, side: THREE.DoubleSide }));
  const lower = new THREE.Mesh(ringGeometry(false), new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(.65), roughness: .8, flatShading: true, side: THREE.DoubleSide }));
  upper.castShadow = true; lower.castShadow = true; parent.add(upper, lower);
  const rail = edge.map(([x, z]) => new THREE.Vector3(x + offsetX, top + .075, z)); rail.push(rail[0].clone());
  tube(parent, '#fff3d2', rail, .085);
  for (const side of [-1, 1]) for (const z of [back + .85, front - 1.3]) {
    const port = new THREE.Mesh(new THREE.CircleGeometry(.115, 10), new THREE.MeshStandardMaterial({ color: '#b6e4db', side: THREE.DoubleSide }));
    port.rotation.y = side * Math.PI / 2; port.position.set(offsetX + side * (half * .94), 1.18, z); parent.add(port);
  }
}

function fabricSail(parent: THREE.Object3D, color: string, name: string, corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3], billow = .24): void {
  const [head, tack, clew] = corners;
  const center = new THREE.Vector3().add(head).add(tack).add(clew).multiplyScalar(1 / 3); center.x += billow;
  const vertices = [head, tack, center, tack, clew, center, clew, head, center].flatMap(point => [point.x, point.y, point.z]);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
  const cloth = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .35, side: THREE.DoubleSide, roughness: 1, flatShading: true }));
  cloth.name = name; cloth.castShadow = true; parent.add(cloth);
  tube(parent, '#cfb28a', [head, tack], .025); tube(parent, '#cfb28a', [head, clew], .025);
}

function disposeModels(group: THREE.Object3D): void {
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}

function makeBoat(color: string, style: BoatStyle | 'patrol' = 'dinghy'): THREE.Group {
  const craft = new THREE.Group();
  if (style === 'sailboat') craft.scale.setScalar(.78);
  const broad = ['trawler', 'freighter', 'catamaran', 'houseboat', 'barge'].includes(style);
  const long = ['cruiser', 'freighter', 'clipper', 'barge'].includes(style);
  const half = style === 'skiff' ? 0.92 : style === 'dinghy' || style === 'patrol' || style === 'sailboat' ? 1.28 : style === 'speedboat' ? 1.12 : style === 'barge' ? 1.92 : broad ? 1.65 : 1.4;
  const front = style === 'speedboat' || style === 'skiff' ? 2.9 : long ? 3.15 : 2.35;
  const back = long ? -2.9 : -2.15;
  if (style === 'catamaran') {
    shapedHull(craft, color, .55, 2.65, -2.35, 'pointed', -1.13);
    shapedHull(craft, color, .55, 2.65, -2.35, 'pointed', 1.13);
    box(craft, '#f3e8cc', 0, 1.61, -.05, 2.6, .18, 3.55);
  } else shapedHull(craft, color, half, front, back, style === 'speedboat' || style === 'skiff' || style === 'clipper' || style === 'sailboat' ? 'pointed' : style === 'freighter' || style === 'barge' || style === 'houseboat' ? 'square' : 'round');
  const deckY = style === 'barge' || style === 'freighter' || style === 'houseboat' ? 1.74 : 1.61;
  for (const side of [-1, 1]) {
    cylinder(craft, '#fff1d0', side * half * .7, deckY + .16, back + .53, .1, .28);
    const fender = cylinder(craft, style === 'patrol' ? '#d8edf0' : '#fff2db', side * (half + .06), 1.1, -.35, .16, .48, 8); fender.rotation.z = side * .17;
  }
  const cabinZ = style === 'freighter' || style === 'barge' ? back + 0.85 : style === 'trawler' || style === 'houseboat' ? 0.15 : style === 'speedboat' ? -0.6 : -0.34;
  const cabinY = broad ? 2.08 : 1.95;
  const cabinW = style === 'freighter' || style === 'barge' ? 2.35 : style === 'trawler' || style === 'houseboat' ? 1.8 : style === 'cruiser' ? 1.9 : style === 'skiff' ? .75 : 1.18;
  const cabinD = style === 'houseboat' ? 2.2 : style === 'cruiser' ? 1.95 : style === 'freighter' || style === 'barge' ? 1.35 : style === 'trawler' ? 1.35 : 1.08;
  if (!['dinghy', 'skiff', 'sailboat', 'catamaran'].includes(style)) {
    box(craft, '#fff2d9', 0, cabinY, cabinZ, cabinW, style === 'freighter' ? 0.95 : 0.64, cabinD);
    box(craft, style === 'patrol' ? '#496e88' : style === 'cruiser' ? '#f9c8ae' : style === 'freighter' ? '#7f9db2' : '#e88470', 0, cabinY + (style === 'freighter' ? .57 : .39), cabinZ, cabinW + .18, .16, cabinD + .2);
    box(craft, '#83cbd0', 0, cabinY + .08, cabinZ + cabinD / 2 + .035, cabinW * .68, .28, .06);
    for (const side of [-1, 1]) box(craft, '#8bd1d1', side * (cabinW / 2 + .025), cabinY + .06, cabinZ, .06, .25, cabinD * .45);
  }
  if (style === 'dinghy') {
    box(craft, '#9a7655', 0, 1.68, -.85, 1.8, .12, .34);
    box(craft, '#9a7655', 0, 1.68, .7, 1.55, .12, .34);
    box(craft, '#436778', 0, 1.74, back + .22, .75, .23, .4);
    for (const side of [-1, 1]) {
      const oar = box(craft, '#c39459', side * 1.1, 1.77, -.1, .07, .07, 2.15); oar.rotation.y = side * .52;
      box(craft, '#ebc889', side * 1.65, 1.77, 1.0, .26, .06, .72).rotation.y = side * .52;
    }
    cylinder(craft, '#f7d370', -.55, 1.83, 1.68, .16, .15);
    for (const side of [-1, 1]) box(craft, '#e9c681', side * 1.22, .82, .2, .1, .17, 2.9);
  } else if (style === 'speedboat') {
    for (const side of [-1, 1]) box(craft, '#415c72', side * .44, 1.38, back - .08, .3, .46, .5);
    const windscreen = box(craft, '#9ad7dc', 0, 2.1, .52, 1.42, .5, .09); windscreen.rotation.x = -.4;
    box(craft, '#fff6d3', 0, 1.68, 1.75, .23, .04, 1.55);
    for (const side of [-1, 1]) box(craft, '#4b7482', side * .43, 1.73, -.85, .48, .19, .58);
  } else if (style === 'trawler') {
    cylinder(craft, '#8e7253', 0, 3.2, cabinZ, .075, 1.25);
    for (const side of [-1, 1]) {
      box(craft, '#b6895a', side * 1.23, 1.88, -.35, .14, .18, 2.0);
      tube(craft, '#8c755e', [new THREE.Vector3(0,3.67,cabinZ),new THREE.Vector3(side*1.38,1.9,-1.25)], .025);
      cylinder(craft, '#e2b86d', side * 1.25, 1.79, -1.1, .38, .38);
    }
    box(craft, '#f4c87e', 0, 1.8, 1.52, 1.28, .13, .85);
    cylinder(craft, '#f0dfbd', .43, 3.05, cabinZ-.2, .12, .5);
    for (const side of [-1, 1]) for (const z of [-1.65, 1.45]) cylinder(craft, '#f5e5c5', side * 1.65, 1.42, z, .27, .28, 8);
  } else if (style === 'cruiser') {
    box(craft, '#fff7db', 0, 2.55, cabinZ - .35, 1.5, .15, 1.1);
    for (const side of [-1, 1]) {
      box(craft, '#f9deb2', side * 1.07, 1.76, 1.72, .22, .15, 1.4);
      tube(craft, '#f9e8bc', [new THREE.Vector3(side*1.24,1.7,-2.0),new THREE.Vector3(side*1.24,2.18,-2.0),new THREE.Vector3(side*1.24,2.18,1.8)], .025);
    }
    box(craft, '#f1bc95', 0, 2.72, -1.3, 1.0, .08, .6);
    cylinder(craft, '#ffdc88', 0, 2.86, -.4, .11, .34);
    for (const side of [-1, 1]) {
      cylinder(craft, '#f8f0d5', side * 1.37, 1.72, -.8, .31, .12, 10).rotation.z = Math.PI / 2;
      cylinder(craft, '#ec9174', side * 1.42, 1.72, -.8, .17, .13, 10).rotation.z = Math.PI / 2;
    }
  } else if (style === 'freighter') {
    for (const side of [-1, 1]) for (let i = 0; i < 2; i++) box(craft, ['#ecab76', '#8dcaaf', '#e7cf82', '#a8b1de'][(side + 1) + i], side * .72, 2.05 + i * .35, 1.3, 1.25, .33, 1.23);
    cylinder(craft, '#eef3dc', 0, 3.17, cabinZ, .085, 1.1);
    tube(craft, '#566e78', [new THREE.Vector3(-1.25,1.83,2.45),new THREE.Vector3(-1.25,2.35,2.45),new THREE.Vector3(1.25,2.35,2.45)], .04);
    cylinder(craft, '#f3c77b', 1.3, 2.08, 2.27, .18, .55);
    box(craft, '#d3ac70', 0, 1.81, -.65, 2.6, .12, .38);
    cylinder(craft, '#d5ad70', -1.15, 3.25, -1.35, .08, 1.65);
    tube(craft, '#d5ad70', [new THREE.Vector3(-1.15,4,-1.35),new THREE.Vector3(.75,4, .3)], .06);
    tube(craft, '#7a776e', [new THREE.Vector3(.75,4,.3),new THREE.Vector3(.75,2.7,.3)], .025);
  } else if (style === 'skiff') {
    box(craft, '#4c7389', 0, 1.54, back - .12, .55, .46, .38);
    box(craft, '#f6d6a5', 0, 1.72, -.64, 1.42, .13, .3);
    box(craft, '#f6d6a5', 0, 1.72, 1.05, 1.14, .13, .25);
    for (const side of [-1, 1]) {
      box(craft, '#fff5d2', side * .65, 1.67, .2, .12, .11, 2.0);
      cylinder(craft, '#e4b76d', side * .58, 1.81, -1.35, .23, .18);
    }
    box(craft, '#4f8796', 0, 1.83, .65, .85, .12, .5);
  } else if (style === 'catamaran') {
    box(craft, '#fff3d9', 0, 1.92, -.7, 1.8, .55, 1.3);
    box(craft, '#f0b878', 0, 2.27, -.7, 2.0, .16, 1.52);
    box(craft, '#a6dce0', 0, 1.99, -.02, 1.26, .27, .08);
    for (const side of [-1, 1]) {
      box(craft, '#f4ba7d', side * 1.12, 1.86, 1.25, .3, .17, 1.4);
      tube(craft, '#fff0ca', [new THREE.Vector3(side*1.45,1.7,-1.5),new THREE.Vector3(side*1.45,2.1,-1.5),new THREE.Vector3(side*1.45,2.1,1.55)], .025);
      box(craft, '#437d88', side * 1.12, .72, -.1, .13, .53, 2.25);
    }
  } else if (style === 'houseboat') {
    const roof = box(craft, '#e9846f', 0, 2.57, cabinZ, 2.35, .19, 2.75);
    roof.rotation.z = -.07;
    cylinder(craft, '#b57859', .65, 2.88, cabinZ - .55, .13, .68);
    for (const side of [-1, 1]) {
      box(craft, '#a4d6ae', side * .95, 1.85, 1.22, .27, .3, .55);
      box(craft, '#a5cbd1', side * 1.18, 2.12, cabinZ, .08, .42, .67);
    }
    box(craft, '#9e7656', 0, 2.01, cabinZ + 1.13, .44, .63, .08);
    cylinder(craft, '#d6ac73', -1.0, 1.85, 1.72, .25, .38);
    cone(craft, '#6cb885', -1.0, 2.16, 1.72, .31, .43, 6);
    for (const side of [-1, 1]) {
      box(craft, '#d7a86f', side * .76, 1.78, -1.42, .48, .18, .4);
      cone(craft, '#efaa73', side * .76, 2.06, -1.42, .2, .3, 5);
    }
  } else if (style === 'clipper') {
    for (const z of [-1.4,1.0]) cylinder(craft, '#aa805b', 0, 3.28, z, .075, 3.2);
    fabricSail(craft, '#fff0d2', 'clipper-main', [new THREE.Vector3(0,4.84,-1.4),new THREE.Vector3(0,2.1,-1.4),new THREE.Vector3(.12,2.15,-2.85)], .17);
    fabricSail(craft, '#f6dba4', 'clipper-fore', [new THREE.Vector3(0,4.83,1),new THREE.Vector3(0,2.1,1),new THREE.Vector3(-.1,2.08,2.62)], -.16);
    box(craft, '#e6c28c', 0, 1.71, 1.67, 1.05, .12, 1.5);
    cone(craft, '#f3a77e', 0, 5.13, -1.4, .24, .46, 3).rotation.z = Math.PI / 2;
    cone(craft, '#80c9bc', 0, 5.11, 1.0, .2, .4, 3).rotation.z = Math.PI / 2;
  } else if (style === 'barge') {
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) box(craft, ['#91bea7', '#e8b785', '#a5a8d1'][i], side * .83, 2.06, -.2 + i * .92, 1.37, .55, .79);
    box(craft, '#6b895d', 0, 2.79, cabinZ, 2.44, .14, 1.58);
    for (const side of [-1, 1]) for (const z of [-1.8, 1.5]) cylinder(craft, '#526a6e', side * 1.94, 1.12, z, .27, .2);
    box(craft, '#eec67a', 0, 1.79, 2.3, 2.0, .14, .36);
    cylinder(craft, '#d6b37c', 1.1, 3.21, -2.06, .09, 1.85);
    tube(craft, '#d6b37c', [new THREE.Vector3(1.1,4.1,-2.06),new THREE.Vector3(-.5,4.1,-1.1)], .07);
    tube(craft, '#6b6865', [new THREE.Vector3(-.5,4.1,-1.1),new THREE.Vector3(-.5,2.66,-1.1)], .025);
  } else if (style === 'sailboat') {
    box(craft, '#4b7280', 0, 1.58, -1.12, 1.08, .09, 1.05);
    box(craft, '#e8be86', 0, 1.68, -1.53, .92, .11, .22);
    for (const side of [-1, 1]) box(craft, '#e8be86', side * .52, 1.69, -1.06, .19, .12, .85);
    cylinder(craft, '#9a714d', 0, 3.47, .22, .074, 3.86);
    const rig = new THREE.Group(); rig.rotation.y = -.55; rig.position.z = .2; craft.add(rig);
    box(rig, '#aa8053', 0, 2.03, -.96, .075, .075, 1.94);
    fabricSail(rig, '#fff6de', 'sailboat-main', [new THREE.Vector3(0,5.35,0),new THREE.Vector3(0,2.1,0),new THREE.Vector3(.03,2.1,-1.99)], .42);
    fabricSail(rig, '#eaa777', 'sailboat-patch', [new THREE.Vector3(.015,3.08,-.04),new THREE.Vector3(.02,2.12,-.03),new THREE.Vector3(.05,2.12,-1.85)], .46);
    fabricSail(craft, '#f9d9a0', 'sailboat-jib', [new THREE.Vector3(.02,4.63,.27),new THREE.Vector3(.01,1.92,2.14),new THREE.Vector3(.02,2.1,.74)], -.24);
    tube(craft, '#faf0d7', [new THREE.Vector3(0,5.35,.2),new THREE.Vector3(0,1.87,2.17)], .025);
    box(craft, '#efd3a0', 0, 1.73, 1.82, .6, .07, .33);
    cone(craft, '#f1b476', 0, 5.5, .22, .17, .29, 3).rotation.z = Math.PI / 2;
  } else {
    cylinder(craft, '#f5f3d9', 0, 1.8, 1.38, .15, .22);
    cone(craft, '#ffce5c', 0, 2.1, 1.38, .25, .35, 5);
  }
  const cargo = new THREE.Group(); cargo.name = 'deck-cargo'; craft.add(cargo);
  if (style !== 'patrol') ['#ffd95d', '#f49d77', '#8ed6ad'].forEach((c, i) => {
    const parcel = new THREE.Group(); parcel.position.set(i % 2 ? .38 : -.38, broad ? 2.1 + (i === 2 ? .22 : 0) : 1.92 + (i === 2 ? .22 : 0), style === 'freighter' ? .05 : back + .62);
    box(parcel, c, 0, 0, 0, .59, .42, .52); box(parcel, '#9a764e', 0, .01, 0, .05, .43, .54); cargo.add(parcel);
  });
  return craft;
}

function makePatrolBoat(sound: boolean): THREE.Group {
  const craft = makeBoat(sound ? '#7669a1' : '#3d7893', 'patrol');
  // Distinctive working hull: strong sheer stripe, rescue fenders, twin engines and a watch mast.
  for (const side of [-1, 1]) {
    box(craft, sound ? '#d9c7ee' : '#f5d999', side * 1.16, 1.19, .14, .11, .16, 3.55);
    const rescueRing = new THREE.Mesh(new THREE.TorusGeometry(.29, .085, 5, 12), mat(sound ? '#f4c878' : '#f18769'));
    rescueRing.rotation.y = Math.PI / 2; rescueRing.position.set(side * 1.34, 1.72, -.72); craft.add(rescueRing);
    for (const z of [-1.35, 1.15]) {
      const fender = cylinder(craft, '#f0f1dc', side * 1.37, 1.22, z, .2, .67, 8);
      fender.rotation.z = side * .14;
    }
    box(craft, '#33485b', side * .5, 1.36, -2.34, .35, .55, .5);
    box(craft, '#e8ecdb', side * .48, 1.73, 1.45, .2, .17, .82);
  }
  tube(craft, '#fff4d4', [new THREE.Vector3(-1.05,1.72,-1.8), new THREE.Vector3(-1.08,2.05,-1.8), new THREE.Vector3(-1.08,2.05,.9), new THREE.Vector3(-.56,2.02,1.92)], .045);
  tube(craft, '#fff4d4', [new THREE.Vector3(1.05,1.72,-1.8), new THREE.Vector3(1.08,2.05,-1.8), new THREE.Vector3(1.08,2.05,.9), new THREE.Vector3(.56,2.02,1.92)], .045);
  box(craft, sound ? '#7e6aa2' : '#426d84', 0, 1.7, 1.31, 1.33, .09, 1.13);
  cylinder(craft, '#f6e9c8', 0, 3.15, -.38, .075, 1.42, 8);
  box(craft, '#f6e9c8', 0, 3.71, -.38, .82, .07, .07);
  box(craft, '#a7d9d7', 0, 2.06, 1.42, .8, .26, .18);
  cylinder(craft, '#f4e9c9', 0, 2.03, 1.36, .27, .25, 8);
  if (sound) {
    const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(.46, 1), mat('#cfb9ef'));
    dome.scale.y = .62; dome.position.set(0, 2.75, -.38); craft.add(dome);
    for (const side of [-1, 1]) {
      box(craft, '#cbb2ed', side * .74, 2.43, -.25, .43, .27, .13);
      cylinder(craft, '#e3d5f6', side * .42, 3.66, -.38, .07, .19, 8);
    }
    cylinder(craft, '#e9cafa', 0, 3.85, -.38, .25, .18, 8);
  } else {
    cylinder(craft, '#ffd76c', 0, 2.79, -.38, .29, .27, 8);
    cylinder(craft, '#40617a', 0, 2.95, -.38, .32, .09, 8);
    for (const side of [-1, 1]) cylinder(craft, '#fff2c9', side * .4, 3.68, -.38, .09, .16, 8);
  }
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

function makeSandbank(parent: THREE.Object3D, x: number, z: number, radius: number): THREE.Group {
  const group = new THREE.Group(); group.position.set(x, 0, z);
  const shoal = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.16, .18, 12), mat('#e8c77d'));
  shoal.scale.z = .65; shoal.position.y = -.04; group.add(shoal);
  const lip = new THREE.Mesh(new THREE.RingGeometry(radius * .79, radius * 1.16, 24), new THREE.MeshBasicMaterial({ color: '#d9f2d5', transparent: true, opacity: .48, side: THREE.DoubleSide, depthWrite: false }));
  lip.rotation.x = -Math.PI / 2; lip.scale.y = .68; lip.position.y = .035; group.add(lip);
  parent.add(group); return group;
}

function makeIceberg(parent: THREE.Object3D, x: number, z: number, radius: number): THREE.Group {
  const group = new THREE.Group(); group.position.set(x, 0, z);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.07, radius * 1.3, .5, 7), mat('#73b9ca'));
  skirt.position.y = -.18; group.add(skirt);
  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * .83, 0), mat('#d8f2f1'));
  body.scale.set(1.08, 1.35, .95); body.position.y = .6; body.rotation.set(.2, .3, -.14); group.add(body);
  cone(group, '#f8fffa', -.18 * radius, radius * 1.15, -.1 * radius, radius * .48, radius * 1.15, 5).rotation.z = -.25;
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.04, radius * 1.3, 24), new THREE.MeshBasicMaterial({ color: '#e5fffb', transparent: true, opacity: .64, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .08; group.add(ring);
  parent.add(group); return group;
}

function makeReef(parent: THREE.Object3D, x: number, z: number, radius: number): THREE.Group {
  const group = new THREE.Group(); group.position.set(x, 0, z);
  const shelf = cylinder(group, '#b7b494', 0, -.2, 0, radius, .35, 9); shelf.scale.z = .68;
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4, distance = radius * (.25 + (i % 3) * .17);
    const coral = cone(group, ['#f19582', '#f0c878', '#a692c4', '#86cbaa'][i % 4], Math.cos(angle) * distance, .18, Math.sin(angle) * distance * .65, .24 + i % 3 * .09, .65 + i % 3 * .18, 5);
    coral.rotation.z = Math.sin(angle) * .3;
  }
  for (let i = 0; i < 3; i++) {
    const breaker = new THREE.Mesh(new THREE.TorusGeometry(radius * (.88 + i * .14), .07, 4, 28, Math.PI * 1.35), new THREE.MeshBasicMaterial({ color: '#e5fff3', transparent: true, opacity: .6 - i * .12, depthWrite: false }));
    breaker.rotation.x = -Math.PI / 2; breaker.rotation.z = i * 1.65; breaker.position.y = .045 + i * .008; group.add(breaker);
  }
  parent.add(group); return group;
}

function makeDriftwood(parent: THREE.Object3D, x: number, z: number, radius: number): THREE.Group {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = z * .7;
  const log = cylinder(group, '#84664d', 0, .13, 0, .29, radius * 1.8, 7); log.rotation.x = Math.PI / 2;
  for (const [xx, zz, angle] of [[-.42, -.35, -.5], [.35, .3, .55]] as const) {
    const limb = cylinder(group, '#9f7955', xx, .17, zz, .11, .9, 5); limb.rotation.z = angle;
  }
  for (const side of [-1, 1]) {
    const foam = new THREE.Mesh(new THREE.TorusGeometry(radius * .73, .04, 3, 18, Math.PI * .8), new THREE.MeshBasicMaterial({ color: '#d1f4e8', transparent: true, opacity: .55, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2; foam.rotation.z = side * 1.4; foam.position.y = .055; group.add(foam);
  }
  parent.add(group); return group;
}

function makeCoastalLandmark(parent: THREE.Object3D, x: number, z: number, biome: Biome, accent: string, seed: number): void {
  const group = new THREE.Group(); group.position.set(x, 0, z);
  const base = cylinder(group, biome === 'volcanic' ? '#615e67' : biome === 'ice' ? '#e5eee5' : '#eed294', 0, .24, 0, 2.3, .45, 7);
  base.scale.z = .78;
  if (biome === 'reef') {
    for (let i = 0; i < 4; i++) { const branch = cone(group, i % 2 ? '#f49b80' : accent, Math.sin(i * 2.1) * .9, 1.1, Math.cos(i * 2.1) * .7, .3, 1.6 + i * .17, 5); branch.rotation.z = (i - 1.5) * .22; }
  } else if (biome === 'marsh' || biome === 'mist') {
    for (let i = 0; i < 7; i++) { const xx = Math.sin(i * 2.3) * 1.3, zz = Math.cos(i * 2.3) * .9; cylinder(group, '#648a62', xx, .95 + i * .07, zz, .045, 1.5 + i * .14, 5); cone(group, biome === 'mist' ? '#b6c4cf' : '#8ba868', xx, 1.75 + i * .14, zz, .16, .42, 5); }
  } else if (biome === 'pine') {
    for (let i = 0; i < 3; i++) { const xx = (i - 1) * .9; cylinder(group, '#896f58', xx, 1.25, i % 2 ? .5 : -.4, .13, 2.2, 6); cone(group, i % 2 ? '#4f947c' : '#387d70', xx, 2.5, i % 2 ? .5 : -.4, .8, 2.4, 6); }
  } else if (biome === 'ice' || biome === 'star') {
    for (let i = 0; i < 3; i++) { const crystal = cone(group, i % 2 ? '#d6eaf0' : accent, (i - 1) * .68, 1.2 + i * .25, i % 2 ? .4 : -.3, .52, 2.2 + i * .45, 5); crystal.rotation.z = (i - 1) * .17; }
  } else if (biome === 'volcanic' || biome === 'cliff') {
    for (let i = 0; i < 3; i++) { const stack = cylinder(group, biome === 'volcanic' ? '#735b5d' : '#8a9a9d', (i - 1) * .72, .85 + i * .23, i % 2 ? .45 : -.3, .58 - i * .08, 1.5 + i * .3, 6); stack.rotation.z = (i - 1) * .07; }
    if (biome === 'volcanic') cone(group, '#e89067', .1, 2.25, 0, .35, .8, 5);
  } else if (biome === 'lantern') {
    cylinder(group, '#8b694e', 0, 1.5, 0, .12, 2.8, 6);
    box(group, '#f3c67e', 0, 2.9, 0, .8, .85, .8); cone(group, accent, 0, 3.5, 0, .65, .55, 4);
  } else makeIsland(group, 0, 0, .35);
  group.rotation.y = seed * .73; parent.add(group);
}

function makeChannelBanks(parent: THREE.Object3D, plan: LevelPlan): void {
  const harbor = HARBORS[plan.port];
  for (const side of [-1, 1]) {
    for (let z = 46; z < plan.routeEnd - 15; z += 76) {
      const x = channelCenter(plan, z) + side * (channelHalfWidth(plan, z) + 27 + (z % 3) * 5);
      if (harbor.biome === 'ice') makeIceberg(parent, x, z + side * 7, 1.8 + (z % 4) * .25);
      else if (harbor.biome === 'cove' && z % 3 === 1) makeIsland(parent, x, z, .45);
      else makeCoastalLandmark(parent, x, z, harbor.biome, harbor.color, z + plan.port);
    }
  }
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

function makeHarbour(parent: THREE.Object3D, z: number, destination = false, x = 0, biome: Biome = 'cove', accent = '#e7735a'): void {
  const harbour = new THREE.Group(); harbour.position.set(x, 0, z);
  const shoreColor = biome === 'ice' ? '#d8eeec' : biome === 'volcanic' ? '#806d6c' : biome === 'cliff' ? '#a8ada4' : biome === 'reef' ? '#f4dcaa' : '#edcf98';
  const topColor = biome === 'ice' ? '#eefaf5' : biome === 'volcanic' ? '#857d76' : biome === 'cliff' ? '#a7bea8' : biome === 'reef' ? '#a6dcb2' : biome === 'marsh' ? '#93ba8b' : '#8fc79a';
  const land = (lx: number, lz: number, radius: number, seed: number): void => {
    const shore = cylinder(harbour, shoreColor, lx, .28, lz, radius, .62, 11);
    shore.scale.z = .72 + seed * .04; shore.rotation.y = seed * .38;
    const plateau = cylinder(harbour, topColor, lx - .35, .68, lz - .25, radius * .82, .3, 10);
    plateau.scale.z = .68 + seed * .035; plateau.rotation.y = seed * .36;
    for (let i = 0; i < 4; i++) {
      const angle = i * 1.73 + seed;
      const rx = lx + Math.cos(angle) * radius * .76;
      const rz = lz + Math.sin(angle) * radius * .53;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(.7 + i * .13, 0), mat(biome === 'ice' ? '#c8e6eb' : biome === 'volcanic' ? '#675f66' : '#bba990'));
      stone.position.set(rx, .42, rz); stone.scale.y = .65; harbour.add(stone);
    }
  };
  land(destination ? -18 : -13, -1, destination ? 13 : 11, 1);
  land(destination ? 21 : 13.2, 2, destination ? 10.5 : 9.4, 2);
  if (destination) { land(-25, 7, 8.7, 3); land(24, 9, 7.5, 4); }
  // Keep the lighthouse headland clear. Low trees and rocks frame the sheltered cove.
  for (const [tx, tz, size] of [[-20, 3, 1], [-25, 8, .72], [20, 7, .78]] as const) {
    if (!destination && tx === -25) continue;
    if (tx > 0 && biome !== 'ice' && biome !== 'volcanic' && biome !== 'cliff') {
      const shrub = new THREE.Mesh(new THREE.DodecahedronGeometry(.85 * size, 0), mat(biome === 'reef' ? '#7fbda1' : '#65a77c'));
      shrub.position.set(tx, .98, tz); shrub.scale.y = .52; harbour.add(shrub);
    } else if (biome === 'ice') {
      const crystal = cone(harbour, '#f2fffa', tx, 1.75, tz, .8 * size, 2.3 * size, 5); crystal.rotation.z = .12;
    } else if (biome === 'volcanic' || biome === 'cliff') {
      const crag = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 * size, 0), mat(biome === 'volcanic' ? '#625c62' : '#9da8a5'));
      crag.position.set(tx, 1.35, tz); crag.scale.set(.9, 1.2, .8); harbour.add(crag);
    } else if (biome === 'reef') {
      for (let i = 0; i < 3; i++) cone(harbour, i % 2 ? '#f5a183' : '#f0d693', tx + i * .48, 1.3 + i * .17, tz + (i % 2) * .4, .37, 1.2, 5);
    } else {
      cylinder(harbour, '#8b7058', tx, 1.35, tz, .16 * size, 1.35 * size, 6);
      cone(harbour, biome === 'pine' ? '#3e806e' : '#65a77c', tx, 2.45 * size, tz, .9 * size, 2.2 * size, 6);
    }
  }
  const pierCenter = destination ? -1.2 : -7.1;
  const pierLength = destination ? 14.4 : 8.3;
  box(harbour, '#aa764d', pierCenter, .8, 0, pierLength, .32, 2.8);
  for (let i = 0; i < (destination ? 11 : 6); i++) {
    const plankX = pierCenter - pierLength / 2 + .65 + i * 1.25;
    box(harbour, i % 2 ? '#bf9167' : '#c69b6d', plankX, 1, 0, 1.17, .09, 2.86);
  }
  for (const px of (destination ? [-5, -1, 3, 5.2] : [-10, -6, -3])) for (const pz of [-1.15, 1.15]) {
    cylinder(harbour, '#775a46', px, .36, pz, .19, .95, 7);
  }
  if (destination) {
    for (const px of [-3.4, 2.8, 5.4]) {
      cylinder(harbour, '#52717a', px, 1.2, -1.18, .14, .45, 8);
      cylinder(harbour, '#f2cb79', px, 1.46, -1.18, .19, .12, 8);
    }
  }
  box(harbour, destination ? '#f5a2a2' : '#ffd780', -11.8, 2.4, -1.3, 4.25, 3.1, 3.4);
  const roof = box(harbour, destination ? '#be6183' : accent, -11.8, 4.22, -1.3, 5, .55, 4);
  roof.rotation.z = -0.08;
  box(harbour, '#fff4d2', -9.55, 2.52, -1.3, .12, 1.3, 1.3);
  for (let i = 0; i < 3; i++) box(harbour, '#8dc9d2', -13.3 + i * 1.5, 2.7, -3.06, .8, .86, .09);
  for (let i = 0; i < 3; i++) box(harbour, ['#f89069', '#9cd8ad', '#b59cdd'][i], (destination ? -2.8 : -7.1) + i * 0.9, 1.4, 0, 0.8, 0.8, 0.8);
  if (destination) {
    box(harbour, '#eee0b8', -21, 2.1, 5, 4.7, 2.7, 4);
    const warehouseRoof = box(harbour, accent, -21, 3.68, 5, 5.3, .43, 4.7); warehouseRoof.rotation.z = .06;
    for (let i = 0; i < 2; i++) box(harbour, '#75afba', -22.2 + i * 2.3, 2.15, 2.93, 1.1, 1.1, .12);
    box(harbour, '#f6e2b4', -17.7, .92, -5.4, 7.5, .2, 1.8);
    for (let i = 0; i < 3; i++) {
      cylinder(harbour, '#577281', -19.8 + i * 2.1, 1.15, -5.4, .15, .65, 6);
      box(harbour, ['#ef9d7b', '#e8c779', '#9fd0c0'][i], -17.5 + i * .82, 1.2, 1.5, .72, .72, .72);
    }
    for (let i = 0; i < 4; i++) {
      const bx = i < 2 ? -24 - i * 2.1 : 22 + (i - 2) * 2.2;
      const breakwater = new THREE.Mesh(new THREE.DodecahedronGeometry(1.25 + i * .12, 0), mat(shoreColor));
      breakwater.position.set(bx, .32, 2 + i * 2.5); breakwater.scale.y = .58; harbour.add(breakwater);
    }
  }
  cylinder(harbour, '#fff7d8', 12.6, 3.05, 1.3, 0.95, 5.3, 8);
  cylinder(harbour, '#eb786d', 12.6, 2.15, 1.3, .97, .24, 8);
  cylinder(harbour, '#eb786d', 12.6, 4.23, 1.3, .97, .24, 8);
  box(harbour, '#507b88', 12.6, 3.13, 2.26, .4, .7, .08);
  box(harbour, '#507b88', 13.55, 3.52, 1.3, .08, .7, .4);
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

const routeWaterShader = `uniform vec4 uRoute; uniform vec2 uRouteWidth;
  float offshoreWater(vec2 position) {
    float z = position.y;
    float mainBend = sin(z * uRoute.y + uRoute.z) - sin(uRoute.z);
    float detailBend = sin(z * uRoute.y * 1.9 + uRoute.z * 1.7) - sin(uRoute.z * 1.7);
    float center = uRoute.w * z + uRoute.x * (mainBend * 0.8 + detailBend * 0.18);
    float halfWidth = uRouteWidth.x + sin(z * 0.026 + uRouteWidth.y * 0.43) * 1.05 + sin(z * 0.073 + uRouteWidth.y) * 0.45;
    float distance = max(0.0, abs(position.x - center) - halfWidth);
    return smoothstep(0.0, 42.0, distance);
  }`;

export interface Hazard { x: number; z: number; radius: number; kind: HazardKind; mesh: THREE.Group; }
export interface Patrol { x: number; z: number; baseX: number; baseZ: number; phase: number; heading: number; chase: number; sound: boolean; mesh: THREE.Group; light: THREE.Mesh; ring: THREE.Mesh | null; foam: THREE.Mesh; wake: THREE.Mesh; }
interface DockParcel { mesh: THREE.Object3D; start: THREE.Vector3; end: THREE.Vector3; launch: number }
interface Docking { fromX: number; fromZ: number; time: number; approach: number; parcels: Array<DockParcel | null> }

export class World {
  private plan: LevelPlan = levelPlan(1, 0);
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-12, 12, 19, -19, 0.1, 200);
  boat = makeBoat(palette.coral);
  private boatLamp: THREE.SpotLight | null = null;
  private boatLampBulb: THREE.Mesh | null = null;
  private readonly yard = new THREE.Group();
  private inYard = false;
  private yardCount = 0;
  private yardFocused: number | null = null;
  private readonly yardBerths = new Map<number, THREE.Vector3>();
  private readonly yardBoats = new Map<number, THREE.Group>();
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
  private seaRoughness = 0;
  private boatDraftOffset = .94;
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
        uTime: { value: 0 }, uRoute: { value: new THREE.Vector4() }, uRouteWidth: { value: new THREE.Vector2() }, uDeep: { value: new THREE.Color('#087f94') },
        uLight: { value: new THREE.Color('#2ba9b1') }, uFoam: { value: new THREE.Color('#a1e6dc') },
      },
      vertexShader: `uniform float uTime; varying vec3 vWater; varying float vRoughness; ${routeWaterShader}
        void main() {
          vec3 p = position;
          vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
          vRoughness = offshoreWater(world.xz);
          p.z = (sin(p.x * 0.42 + uTime * 1.1) * 0.08 + sin(p.y * 0.25 - uTime * 0.85) * 0.06
            + sin(p.x * 0.9 + p.y * 0.47 + uTime * 1.55) * 0.035) * (1.0 + vRoughness * 5.5)
            + vRoughness * sin(p.x * .18 + p.y * .11 - uTime * 1.05) * .22;
          vWater = world;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uTime; uniform vec3 uDeep; uniform vec3 uLight; uniform vec3 uFoam; varying vec3 vWater; varying float vRoughness;
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
          float shade = clamp(0.49 + swell * crossing * (0.22 + vRoughness * 0.14) + swell * 0.065
            + sin(folded.x * 0.58 + cos(folded.y * 0.41 - uTime) * 1.4) * 0.035, 0.0, 1.0);
          float ripples = localRipple(p, 13.0, 0.13, 0.0)
            + localRipple(p + vec2(4.1, 6.7), 21.0, 0.09, 19.0);
          float glint = smoothstep(0.72, 0.97, swell * crossing) * 0.06;
          vec3 color = mix(uDeep, uLight, shade);
          color = mix(color, uDeep, vRoughness * 0.24);
          float rolling = sin(folded.x * .19 + folded.y * .12 - uTime * 1.1 + sin(p.y * .08) * .7);
          float crest = smoothstep(.57, .86, rolling) * (.52 + .48 * crossing * crossing);
          float breakOne = smoothstep(0.39, 0.8, sin(p.x * 0.39 + p.y * 0.23 - uTime * 1.5) * crossing);
          float breakTwo = smoothstep(0.55, 0.9, sin(p.y * 0.37 - p.x * 0.21 + uTime * 1.15) * swell);
          color = mix(color, uFoam, min(0.72, ripples * 0.24 + glint + vRoughness * (crest * .45 + breakOne * 0.25 + breakTwo * 0.18)));
          gl_FragColor = vec4(color, 0.82);
          #include <colorspace_fragment>
        }`,
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(220, 4000, 88, 500), water);
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
    disposeModels(this.boat);
    this.boat = makeBoat(craft.color, craft.style);
    this.boatDraftOffset = craft.style === 'sailboat' ? .73 : .94;
    const lamp = new THREE.SpotLight('#ffe5a6', 25, 32, .55, .68, 1.3);
    lamp.position.set(0, 2.9, 1.7);
    lamp.target.position.set(0, -.55, 12);
    this.boat.add(lamp, lamp.target);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe8a8' }));
    bulb.position.set(0, 2.5, 2.15); this.boat.add(bulb);
    this.boatLamp = lamp; this.boatLampBulb = bulb;
    this.scene.add(this.boat);
    const size = craft.width >= 9 ? 1.55 : craft.width >= 8 ? 1.42 : craft.width >= 6 ? 1.22 : 1;
    const visualScale = craft.style === 'sailboat' ? .78 : 1;
    this.boatFoam.scale.set(1.68 * size * visualScale, 2.55 * size * visualScale, 1);
    this.setNightLighting(this.plan.night, false);
  }

  setNightLighting(night: boolean, lightsOn: boolean): void {
    if (this.boatLamp) this.boatLamp.visible = night && lightsOn;
    if (this.boatLampBulb) this.boatLampBulb.visible = night && lightsOn;
  }

  boatScreenPosition(): { x: number; y: number } {
    const projected = this.boat.getWorldPosition(new THREE.Vector3()).project(this.camera);
    return { x: (projected.x + 1) * 50, y: (1 - projected.y) * 50 };
  }

  configureLevel(plan: LevelPlan): void {
    this.plan = plan;
    this.setNightLighting(plan.night, false);
    this.buildRoute();
    const sea: Record<Biome, [string, string]> = {
      cove: ['#087f94', '#2ba9b1'], mist: ['#5b8f9b', '#9dc5c8'], reef: ['#138ca2', '#51c7bb'], lantern: ['#216d86', '#4ba7aa'], star: ['#266b93', '#6bafcc'],
      marsh: ['#247e7f', '#6cb5a4'], cliff: ['#26778f', '#67b1c2'], pine: ['#207d83', '#65aea3'], ice: ['#4b9cac', '#a3d5d8'], volcanic: ['#496f7e', '#9caeaa'],
    };
    const [deep, light] = sea[HARBORS[plan.port].biome];
    const color = plan.night ? '#0c3f63' : plan.weather === 'storm' ? '#477387' : plan.weather === 'fog' ? '#83b5b9' : deep;
    this.scene.background = new THREE.Color(color);
    this.scene.fog = new THREE.Fog(color, plan.weather === 'fog' ? 35 : 75, plan.weather === 'fog' ? 105 : 150);
    this.renderer.setClearColor(color);
    const water = this.ocean.material as THREE.ShaderMaterial;
    const harbor = HARBORS[plan.port];
    water.uniforms.uRoute.value.set(harbor.bend, harbor.frequency, harbor.phase, harborCourseSlope(plan.port));
    water.uniforms.uRouteWidth.value.set(plan.channelWidth, plan.port);
    water.uniforms.uDeep.value.set(plan.night ? '#073e64' : plan.weather === 'storm' ? '#426c7e' : deep);
    water.uniforms.uLight.value.set(plan.night ? '#246f91' : plan.weather === 'storm' ? '#779ea8' : light);
  }

  showShipyard(owned: number[], active: number): void {
    disposeModels(this.yard);
    this.inYard = true; this.yardCount = owned.length; this.yard.clear(); this.yardBerths.clear(); this.yardBoats.clear(); this.yardFocused = null; this.yard.visible = true; this.route.visible = false;
    this.boat.visible = false; this.boatFoam.visible = false; this.bowWash.visible = false;
    // Poured concrete apron, marked service bays, workshops, gantry and stored freight.
    box(this.yard, '#9ca9a9', 0, .35, -16, 72, .7, 13);
    box(this.yard, '#c7d0c7', 0, .76, -16, 72, .13, 13);
    box(this.yard, '#6e8990', 0, .72, -9.35, 72, .32, .48);
    for (let i = -3; i <= 3; i++) {
      const x = i * 10;
      box(this.yard, '#e7eadb', x, .84, -12.1, .13, .025, 4.7);
      cylinder(this.yard, '#3c5c66', x + 4.3, 1.16, -9.1, .3, .85);
      cylinder(this.yard, '#e9c468', x + 4.3, 1.61, -9.1, .33, .1);
    }
    // Workshop, glazing and loading doors.
    box(this.yard, '#d8d8c8', -19, 2.95, -23.4, 18, 4.8, 6.6);
    box(this.yard, '#dc826b', -19, 5.5, -23.4, 19, .55, 7.4);
    for (let i = 0; i < 3; i++) {
      box(this.yard, '#4b8190', -25 + i * 6, 2.2, -20.02, 3.7, 2.8, .12);
      box(this.yard, '#f3d797', -25 + i * 6, 3.74, -19.92, 3.9, .14, .18);
    }
    box(this.yard, '#eee2bb', 20, 2.1, -23.7, 10, 3.1, 5.3);
    box(this.yard, '#83aa99', 20, 3.76, -23.7, 10.6, .36, 5.8);
    for (let i = 0; i < 4; i++) box(this.yard, '#628ca0', 16.6 + i * 2.2, 2, -20.98, 1.5, 1.35, .1);
    // Yellow gantry crane and hanging hoist.
    for (const x of [6, 27]) box(this.yard, '#e9b74f', x, 5.8, -15.2, .62, 9.8, .62);
    box(this.yard, '#f1c661', 16.5, 10.75, -15.2, 23, .72, .85);
    box(this.yard, '#dc9851', 18.5, 10.25, -15.2, 1.4, .6, 1.3);
    cylinder(this.yard, '#454f54', 18.5, 7.6, -15.2, .055, 4.8);
    box(this.yard, '#596d6d', 18.5, 5.12, -15.2, .55, .45, .55);
    // Stacked containers, pallets, drums and working lights make the yard feel occupied.
    for (const [i, x, z, color] of [[0,-31,-15,'#e29a6f'],[1,-30,-23,'#76aeb0'],[2,30,-22,'#d7b37b'],[3,32,-16,'#98b4a2']] as const) {
      box(this.yard, color, x, 1.7 + (i % 2) * 1.25, z, 3.5, 1.7, 2.1);
      for (let stripe = -1; stripe <= 1; stripe++) box(this.yard, '#5d777b', x + stripe * .8, 1.7 + (i % 2) * 1.25, z + 1.07, .06, 1.48, .05);
    }
    for (const x of [-33, -8, 32]) {
      for (let i = 0; i < 3; i++) cylinder(this.yard, ['#c97762','#debf78','#77a5a4'][i], x + i * .8, 1.15, -10.8, .28, .72);
      box(this.yard, '#9a7959', x + 1.7, .98, -11, 1.4, .42, 1.2);
    }
    for (const [slot, index] of owned.entries()) {
      const def = BOATS[index];
      const row = Math.floor(slot / 5), column = slot % 5;
      const columns = Math.min(owned.length - row * 5, 5);
      const x = (column - (columns - 1) / 2) * 11;
      const z = -4 + row * 11;
      const model = makeBoat(def.color, def.style); model.position.set(x, -.35, z); model.rotation.y = -.15; model.userData.boatIndex = index; model.getObjectByName('deck-cargo')!.visible = false; this.yard.add(model);
      this.yardBoats.set(index, model); this.yardBerths.set(index, new THREE.Vector3(x, 0, z));
      const foam = makeHullFoam(def.style === 'sailboat' ? 1.35 : index >= 3 ? 2.4 : 1.8, def.style === 'sailboat' ? 1.95 : index >= 3 ? 3.3 : 2.5); foam.position.set(x, .05, z); this.yard.add(foam);
      // A floating pontoon and repair gantry beside every berth.
      box(this.yard, '#aebcb7', x + 4, .17, z, 1.15, .4, 7.1);
      box(this.yard, '#f0cf77', x + 4, .4, z - 2.8, 1.15, .08, .25);
      if (index === active) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(3.25, 3.38, 32), new THREE.MeshBasicMaterial({ color: '#ffe888', side: THREE.DoubleSide, transparent: true, opacity: .75 }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(x, .07, z); this.yard.add(ring);
      }
    }
  }

  focusShipyardBoat(index: number | null): void { this.yardFocused = index !== null && this.yardBerths.has(index) ? index : null; }

  shipyardBoatAt(clientX: number, clientY: number): number | null {
    if (!this.inYard) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    for (const hit of this.raycaster.intersectObjects([...this.yardBoats.values()], true)) {
      let object: THREE.Object3D | null = hit.object;
      while (object) { if (typeof object.userData.boatIndex === 'number') return object.userData.boatIndex; object = object.parent; }
    }
    return null;
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
    const approach = Math.max(2.2, Math.hypot(x - destinationX(this.plan), z - destinationZ(this.plan)) / 10.5);
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

  screenBearing(dx: number, dz: number): number {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    return screenBearing(dx, dz, right.x, right.z, up.x, up.z);
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
    this.route.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    });
    this.route.clear(); this.hazards.length = 0; this.patrols.length = 0;
    this.fishSchools.length = 0; this.turtles.length = 0; this.gulls.length = 0;
    makeChannelBanks(this.route, this.plan);
    const harbor = HARBORS[this.plan.port];
    makeHarbour(this.route, -13, false, channelCenter(this.plan, -13), harbor.biome, harbor.color);
    makeHarbour(this.route, destinationZ(this.plan) + 3, true, channelCenter(this.plan, destinationZ(this.plan) + 3), harbor.biome, harbor.color);
    for (const hazard of this.plan.hazards) {
      const mesh = hazard.kind === 'rock' ? makeRock(this.route, hazard.x, hazard.z, hazard.radius)
        : hazard.kind === 'sandbank' ? makeSandbank(this.route, hazard.x, hazard.z, hazard.radius)
          : hazard.kind === 'reef' ? makeReef(this.route, hazard.x, hazard.z, hazard.radius)
            : hazard.kind === 'driftwood' ? makeDriftwood(this.route, hazard.x, hazard.z, hazard.radius)
          : hazard.kind === 'iceberg' ? makeIceberg(this.route, hazard.x, hazard.z, hazard.radius)
            : makeBuoy(this.route, hazard.x, hazard.z);
      this.hazards.push({ ...hazard, mesh });
    }
    for (const current of this.plan.currents) {
      const swirl = new THREE.Group(); swirl.position.set(current.x, .025, current.z);
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2 + i * .7, .045, 3, 18, Math.PI * 1.3), new THREE.MeshBasicMaterial({ color: i === 1 ? '#b2efdd' : '#6bcfc6', transparent: true, opacity: .65, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.rotation.z = i * 1.8; ring.position.y = i * .006; swirl.add(ring);
      }
      this.route.add(swirl);
    }
    for (let i = 0; i < this.plan.patrols.length; i++) {
      const slot = this.plan.patrols[i]; const x = slot.x; const z = slot.z;
      const initial = patrolPose(i, 0, x, z, i * 1.8);
      const patrolScale = slot.sound ? 1.13 : 1.04;
      const mesh = makePatrolBoat(slot.sound); mesh.scale.setScalar(patrolScale); mesh.position.set(initial.x, -patrolScale * .94, initial.z); mesh.rotation.y = initial.heading; this.route.add(mesh);
      const foam = makeHullFoam(1.35 * patrolScale, 2.05 * patrolScale); foam.position.set(x, .04, z); this.route.add(foam);
      const wake = new THREE.Mesh(new THREE.TorusGeometry(.58, .045, 3, 10, Math.PI), new THREE.MeshBasicMaterial({ color: '#d8f8e7', transparent: true, opacity: .32, depthWrite: false }));
      wake.rotation.x = -Math.PI / 2; wake.position.set(x, .05, z + 2); this.route.add(wake);
      const light = new THREE.Mesh(new THREE.ConeGeometry(3.6, 9, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#fff1a0', transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide }));
      light.rotation.x = -Math.PI / 2; light.position.set(0, 1.35, 4.8); light.visible = !slot.sound; mesh.add(light);
      const ring = slot.sound ? new THREE.Mesh(new THREE.RingGeometry(11.5, 11.85, 48), new THREE.MeshBasicMaterial({ color: '#d6b6fa', transparent: true, opacity: .27, side: THREE.DoubleSide, depthWrite: false })) : null;
      if (ring) { ring.rotation.x = -Math.PI / 2; this.route.add(ring); }
      this.patrols.push({ x: initial.x, z: initial.z, baseX: x, baseZ: z, phase: i * 1.8, heading: initial.heading, chase: 0, sound: slot.sound, mesh, light, ring, foam, wake });
    }
    // Small moving glints add texture without a remote water asset.
    this.waterMarks.forEach(mark => {
      this.scene.remove(mark);
      mark.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } });
    });
    this.waterMarks.length = 0;
    for (let i = 0; i < 100; i++) {
      const mark = new THREE.Group();
      const line = box(mark, i % 3 ? '#55bec5' : '#8bd4cf', 0, 0.015, 0, 0.24 + (i % 4) * 0.18, 0.015, 0.04);
      line.castShadow = false; const markZ = ((i * 73) % (this.plan.routeEnd + 40)) - 20;
      mark.position.set(channelCenter(this.plan, markZ) + ((i * 37) % 25) - 12.5, 0, markZ);
      this.scene.add(mark); this.waterMarks.push(mark);
    }
    const colors = ['#205a6d', '#286477', '#2f6d7d', '#315e70'];
    for (let i = 0; i < 10; i++) {
      const baseZ = 18 + i * (this.plan.routeEnd - 36) / 10;
      const baseX = channelCenter(this.plan, baseZ) + (i % 2 ? -6.3 : 6.2);
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
      const baseZ = 32 + i * (this.plan.routeEnd - 50) / 6;
      this.turtles.push({ ...turtle, baseX: channelCenter(this.plan, baseZ) + (i % 2 ? -9 : 9), baseZ, phase: i * 1.9 });
    }
    for (let i = 0; i < 8; i++) {
      const gull = makeGull(); this.route.add(gull.group);
      const baseZ = 29 + i * (this.plan.routeEnd - 48) / 8;
      this.gulls.push({ ...gull, baseX: channelCenter(this.plan, baseZ) + (i % 2 ? -5 : 5), baseZ, phase: i * 1.62 });
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
    return -0.04 + (Math.sin(localX * 0.42 + this.elapsed * 1.1) * 0.08
      + Math.sin((260 - z) * 0.25 - this.elapsed * 0.85) * 0.06
      + Math.sin(localX * 0.9 + (260 - z) * 0.47 + this.elapsed * 1.55) * 0.035) * (1 + offshoreWaveStrength(this.plan, x, z) * 5.5)
      + offshoreWaveStrength(this.plan, x, z) * Math.sin(localX * .18 + (260 - z) * .11 - this.elapsed * 1.05) * .22;
  }

  update(dt: number, running: boolean, x: number, z: number, heat: number, boatSpeed: number, vx = 0, vz = 0, target: { x: number; z: number } | null = null): void {
    this.elapsed += dt;
    (this.ocean.material as THREE.ShaderMaterial).uniforms.uTime.value = this.elapsed;
    const roughnessTarget = running && !this.inYard ? offshoreState(this.plan, x, z).swell : 0;
    this.seaRoughness += (roughnessTarget - this.seaRoughness) * Math.min(1, dt * 2.2);
    if (this.docking) {
      this.docking.time += dt;
      const progress = Math.min(1, this.docking.time / this.docking.approach);
      const eased = progress * progress * (3 - 2 * progress);
      const rate = 6 * progress * (1 - progress) / this.docking.approach;
      x = this.docking.fromX + (destinationX(this.plan) - this.docking.fromX) * eased;
      z = this.docking.fromZ + (destinationZ(this.plan) - this.docking.fromZ) * eased;
      vx = (destinationX(this.plan) - this.docking.fromX) * rate;
      vz = (destinationZ(this.plan) - this.docking.fromZ) * rate;
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
    const bob = Math.sin(this.elapsed * (2.15 + this.seaRoughness * .65) + z * 0.15) * (0.04 + this.seaRoughness * .19);
    this.boat.position.set(x, surface - this.boatDraftOffset + bob, z);
    this.boat.rotation.set(
      Math.sin(this.elapsed * 1.75 + z * 0.08) * (0.038 + this.seaRoughness * .2) + vz * 0.003,
      this.heading + Math.sin(this.elapsed * 1.9 + z * .11) * this.seaRoughness * .075,
      Math.sin(this.elapsed * 2.1 + x * 0.3) * (0.045 + this.seaRoughness * .22) - vx * 0.007 + (this.damageTime > 0 ? Math.sin(this.elapsed * 46) * this.damageTime * 0.17 : 0),
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
            end: new THREE.Vector3(channelCenter(this.plan, destinationZ(this.plan) + 3) + 2.8 + (i % 2) * .9, i === 2 ? 1.54 : 1.32, destinationZ(this.plan) + 3 + (i === 1 ? .55 : 0)),
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
        line.setXYZ(1, channelCenter(this.plan, destinationZ(this.plan) + 3) + 5.4, 1.17, destinationZ(this.plan) + 1.9);
        line.needsUpdate = true;
      }
      const burstAge = this.docking.time - (this.docking.approach + 2.0);
      this.dockSparkles.forEach(({ mesh, vx: sparkleVx, vy, vz: sparkleVz }) => {
        mesh.visible = burstAge >= 0 && burstAge < 1.25;
        if (!mesh.visible) return;
        mesh.position.set(channelCenter(this.plan, destinationZ(this.plan) + 3) + 3 + sparkleVx * burstAge, 1.5 + vy * burstAge - 3.5 * burstAge * burstAge, destinationZ(this.plan) + 3 + sparkleVz * burstAge);
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
      if (mark.position.z > this.plan.routeEnd + 20) mark.position.z = -20;
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
      patrol.mesh.position.y = patrolSurface - patrol.mesh.scale.x * .94 + Math.sin(this.elapsed * 2 + patrol.phase) * 0.035;
      patrol.mesh.rotation.x = Math.sin(this.elapsed * 1.7 + patrol.phase) * 0.024;
      patrol.mesh.rotation.y = patrol.heading;
      patrol.mesh.rotation.z = Math.sin(this.elapsed * 2.1 + patrol.phase) * 0.035;
      patrol.foam.position.set(patrol.mesh.position.x, patrolSurface + 0.055, patrol.mesh.position.z);
      patrol.foam.rotation.z = -patrol.heading;
      (patrol.foam.material as THREE.MeshBasicMaterial).opacity = 0.38 + Math.sin(this.elapsed * 3.3 + patrol.phase) * 0.06;
      const wakeX = patrol.x - Math.sin(patrol.heading) * 2.8;
      const wakeZ = patrol.z - Math.cos(patrol.heading) * 2.8;
      patrol.wake.position.set(wakeX, this.waterHeight(wakeX, wakeZ) + 0.06, wakeZ);
      patrol.wake.rotation.z = Math.PI - patrol.heading;
      (patrol.light.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(this.elapsed * 2 + i) * 0.03;
      if (patrol.ring) {
        patrol.ring.position.set(nextX, patrolSurface + .045, nextZ);
        const pulse = 1 + (this.elapsed * .55 + i * .3) % 1 * .25;
        patrol.ring.scale.setScalar(pulse);
        (patrol.ring.material as THREE.MeshBasicMaterial).opacity = .32 - (pulse - 1) * .7;
      }
    });
    const narrow = this.width < 720;
    const focus = this.inYard && this.yardFocused !== null ? this.yardBerths.get(this.yardFocused) : null;
    const targetZ = this.inYard ? (focus ? focus.z - (narrow ? 6 : 1) : -8) : this.docking ? z + (narrow ? 3 : 5) : running ? z + (narrow ? 8 : 14) : -7;
    const targetX = this.inYard ? (focus ? focus.x : 0) : this.docking ? x - 2.8 : running ? x : 0;
    const yardFrameX = focus && !narrow ? 3.5 : 0;
    const factor = Math.min(1, dt * 2.5);
    this.camera.zoom += ((this.inYard ? (focus ? (narrow ? 1.65 : 2.45) : narrow ? .58 : Math.max(.58, .82 - (this.yardCount - 2) * .035)) : this.docking ? 1.42 : 1) - this.camera.zoom) * factor;
    this.camera.updateProjectionMatrix();
    this.camera.position.lerp(new THREE.Vector3(targetX + yardFrameX + (narrow ? 6 : 16), 31, targetZ + (this.inYard ? (narrow ? 25 : 28) : -(narrow ? 25 : 28))), factor);
    this.camera.lookAt(targetX + yardFrameX, 0, targetZ + (this.inYard ? (narrow ? -2 : -5) : (narrow ? 2 : 5)));
    if (this.damageTime > 0) this.camera.position.x += Math.sin(this.elapsed * 63) * this.damageTime * 0.08;
    this.renderer.render(this.scene, this.camera);
  }
}
