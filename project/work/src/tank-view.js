import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TANK_ASSET, TRACK_PATH as P } from '../assets/tank-rig.js';
export { TANK_ASSET } from '../assets/tank-rig.js';

const finite = (value) => Number.isFinite(value) ? value : 0;
const wrap = (value, period) => ((value % period) + period) % period;
const AXIS_X = new THREE.Vector3(1, 0, 0);
const SCALE_ONE = new THREE.Vector3(1, 1, 1);

/** Exact unit-speed closed shoe centerline in the source's local Y/Z plane. */
export function beltPath(distanceRaw) {
  const t = wrap(finite(distanceRaw), TANK_ASSET.trackLoopRaw);
  const u = wrap(t - P.roadY, TANK_ASSET.trackLoopRaw);
  const side = u < P.halfLength ? 1 : -1;
  const q = P.halfLength - Math.abs(u - P.halfLength);
  let y, z, a;
  if (q < P.roadY) { y = q; z = P.bottomZ; a = 0; }
  else if (q < P.s1) {
    a = (q - P.roadY) / P.roadPathRadius;
    y = P.roadY + P.roadPathRadius * Math.sin(a);
    z = P.roadZ - P.roadPathRadius * Math.cos(a);
  } else if (q < P.s2) {
    a = P.alpha; const d = q - P.s1;
    y = P.roadY + P.roadPathRadius * Math.sin(a) + d * Math.cos(a);
    z = P.roadZ - P.roadPathRadius * Math.cos(a) + d * Math.sin(a);
  } else if (q < P.s3) {
    a = P.alpha + (q - P.s2) / P.guidePathRadius;
    y = P.guideY + P.guidePathRadius * Math.sin(a);
    z = P.guideZ - P.guidePathRadius * Math.cos(a);
  } else { y = P.halfLength - q; z = P.topZ; a = Math.PI; }
  return { y: side * y, z, angle: t < 2 * P.roadY ? 0 : side > 0 ? a : 2 * Math.PI - a };
}

/** Signed accepted game metres -> raw local link pose; negative side X is left. */
export function sampleTrackTransform(side, index, acceptedMeters) {
  const path = beltPath(index * TANK_ASSET.trackPitchRaw - finite(acceptedMeters) / TANK_ASSET.gameScale);
  return { x: (side === 'L' ? -1 : 1) * TANK_ASSET.trackSideRaw,
    y: path.z + TANK_ASSET.trackHeightCorrectionRaw, z: -path.y, angle: path.angle };
}

/** Load embedded binary bytes (offline bundles) or the local derivative URL. */
export async function loadTank(scene, options = {}) {
  const loader = new GLTFLoader(options.manager);
  let gltf;
  if (options.data !== undefined) {
    const d = options.data;
    const bytes = ArrayBuffer.isView(d) ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d;
    if (!(bytes instanceof ArrayBuffer)) throw new TypeError('Tank data must be an ArrayBuffer or typed array');
    gltf = await loader.parseAsync(bytes, '');
  } else {
    const url = options.url ?? new URL('../assets/tank_v5_articulated.glb', import.meta.url).href;
    gltf = await loader.loadAsync(url);
  }
  return createTankView(scene, gltf);
}

/** Pure Three scene adaptation; accepts a loaded derivative without DOM/WebGL. */
export function createTankView(scene, gltf) {
  const root = gltf.scene.getObjectByName('TankRoot');
  if (!root) throw new Error('Articulated tank missing TankRoot');
  const requireNode = name => {
    const node = root.getObjectByName(name);
    if (!node) throw new Error(`Articulated tank missing ${name}`);
    return node;
  };
  const joints = { turret: requireNode('TurretPivot'), elevation: requireNode('GunElevationPivot'), recoil: requireNode('RecoilPivot') };
  const geometries = new Set(), materials = new Set(), textures = new Set();
  gltf.scene.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of node.material ? [].concat(node.material) : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  root.updateWorldMatrix(true, true);
  function partsAtPivot(node) {
    const inverse = node.matrixWorld.clone().invert();
    const parts = [];
    node.traverse(child => {
      if (!child.isMesh) return;
      if (Array.isArray(child.material)) throw new Error('Unexpected multi-material primitive; re-export articulated GLB');
      const geometry = child.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(child.matrixWorld));
      geometries.add(geometry);
      parts.push({ geometry, material: child.material });
    });
    return parts;
  }
  const batches = [];
  function instantiate(name, template, count) {
    return partsAtPivot(template).map(({ geometry, material }, i) => {
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = `${name}_${i}`;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // All instances stay inside the fixed running-gear envelope. Recalculating
      // per-frame bounds is unnecessary for this one hero; root/world culling stays safe.
      mesh.frustumCulled = false;
      root.add(mesh); batches.push(mesh); return mesh;
    });
  }
  // The independent binary geometry check verifies every shoe/pad/pin matches
  // Track_L_00's canonical geometry before these two batches replace all 112 nodes.
  const trackBatches = instantiate('AnimatedTracks', requireNode('Track_L_00'), 112);
  const trackMatrices = { L: [], R: [] };
  for (const side of ['L', 'R']) for (let i = 0; i < 56; i++) {
    const node = requireNode(`Track_${side}_${String(i).padStart(2, '0')}`);
    trackMatrices[side].push(new THREE.Matrix4()); node.removeFromParent();
  }
  const wheelSets = [];
  for (const side of ['L', 'R']) {
    const wheelBatches = instantiate(`AnimatedWheels_${side}`, requireNode(`Wheel_${side}_0`), 6);
    const positions = [];
    for (let i = 0; i < 6; i++) { const n = requireNode(`Wheel_${side}_${i}`); positions.push(n.position.clone()); n.removeFromParent(); }
    wheelSets.push({ side, batches: wheelBatches, positions, radius: TANK_ASSET.wheelRadiusRaw });
  }
  const guideBatches = instantiate('AnimatedGuides', requireNode('Guide_L_0'), 4);
  const guideSets = [];
  for (const side of ['L', 'R']) for (let i = 0; i < 2; i++) {
    const n = requireNode(`Guide_${side}_${i}`); guideSets.push({ side, position: n.position.clone() }); n.removeFromParent();
  }
  root.scale.setScalar(TANK_ASSET.gameScale);
  scene.add(root);
  let disposed = false, previousL = NaN, previousR = NaN;
  const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), matrix = new THREE.Matrix4();
  const muzzleRaw = new THREE.Vector3(...TANK_ASSET.muzzleLocalRaw);
  function refreshTracks(side, meters) {
    const offset = side === 'L' ? 0 : 56;
    for (let i = 0; i < 56; i++) {
      const t = sampleTrackTransform(side, i, meters);
      position.set(t.x, t.y, t.z); rotation.setFromAxisAngle(AXIS_X, t.angle);
      const m = trackMatrices[side][i].compose(position, rotation, SCALE_ONE);
      for (const batch of trackBatches) batch.setMatrixAt(offset + i, m);
    }
    const rawTravel = meters / TANK_ASSET.gameScale;
    for (const set of wheelSets) if (set.side === side) {
      rotation.setFromAxisAngle(AXIS_X, -wrap(rawTravel / set.radius, Math.PI * 2));
      set.positions.forEach((p, i) => {
        matrix.compose(p, rotation, SCALE_ONE); for (const batch of set.batches) batch.setMatrixAt(i, matrix);
      });
      for (const batch of set.batches) batch.instanceMatrix.needsUpdate = true;
    }
    rotation.setFromAxisAngle(AXIS_X, -wrap(rawTravel / TANK_ASSET.guideRadiusRaw, Math.PI * 2));
    guideSets.forEach((set, i) => {
      if (set.side !== side) return;
      matrix.compose(set.position, rotation, SCALE_ONE); for (const batch of guideBatches) batch.setMatrixAt(i, matrix);
    });
    for (const batch of [...trackBatches, ...guideBatches]) batch.instanceMatrix.needsUpdate = true;
  }
  function update(tank, _dt) {
    if (disposed) return;
    const pose = tank?.pose ?? {}, turret = tank?.turret ?? {};
    root.position.set(finite(pose.x), finite(pose.y), finite(pose.z));
    root.rotation.set(0, finite(pose.yaw), 0);
    if(pose.basis){const b=pose.basis,m=new THREE.Matrix4().makeBasis(new THREE.Vector3(...b.right),new THREE.Vector3(...b.up),new THREE.Vector3(...b.forward));root.quaternion.multiply(new THREE.Quaternion().setFromRotationMatrix(m));}
    joints.turret.rotation.set(0, finite(turret.yawRel), 0);
    joints.elevation.rotation.set(finite(turret.elevation), 0, 0);
    joints.recoil.position.set(0, 0, Math.max(0, finite(turret.recoil)) / TANK_ASSET.gameScale);
    const left = finite(tank?.trackL), right = finite(tank?.trackR);
    if (left !== previousL) { refreshTracks('L', left); previousL = left; }
    if (right !== previousR) { refreshTracks('R', right); previousR = right; }
    root.updateWorldMatrix(true, true);
  }
  update({});
  return {
    root, joints, update,
    diagnostics: Object.freeze({ links: 112, wheels: 12, guides: 4, trackBatches: trackBatches.length, runningGearBatches: batches.length }),
    muzzleWorld(target = new THREE.Vector3()) { return target.copy(muzzleRaw).applyMatrix4(joints.recoil.matrixWorld); },
    dispose() {
      if (disposed) return; disposed = true; root.removeFromParent();
      for (const mesh of batches) mesh.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
