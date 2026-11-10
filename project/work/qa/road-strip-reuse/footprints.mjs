// CPU-only scene evidence. Both versions use the same installed Three instance.
import crypto from 'node:crypto';
import * as THREE from 'three';

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const isRoad = node => node.isMesh && node.geometry.type === 'BoxGeometry'
  && node.geometry.parameters.height === .025 && node.material.color.getHex() === 0x303d43;

function materialState(material) {
  const { uuid, metadata, ...state } = material.toJSON();
  return state;
}

// This oracle never reads route endpoints or the production duplicate key.
// Keep vertex order and attributes: equality is stricter than visual similarity.
export function sceneFootprints(scene) {
  scene.updateMatrixWorld(true);
  const road = [], other = [], resources = { geometries: new Set(), materials: new Set() };
  let meshes = 0, triangles = 0, lines = 0, roadTriangles = 0;
  scene.traverse(node => {
    if (!node.geometry) return;
    // This historical oracle owns static world/road geometry, not the combat
    // adapter deliberately replaced later. Keep both old/new warning lines out.
    for (let parent = node; parent; parent = parent.parent) if (parent.name === 'combat-fx') return;
    if (node.isLine && node.geometry.attributes.position?.count === 2
      && [0xf27853, 0xe9b552].includes(node.material.color?.getHex())) return;
    const geometry = node.geometry, position = geometry.getAttribute('position');
    resources.geometries.add(geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) resources.materials.add(material);
    const worldVertices = [], vertex = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
      worldVertices.push(...vertex.toArray());
    }
    const state = {
      type: node.type, name: node.name, visible: node.visible,
      castShadow: node.castShadow, receiveShadow: node.receiveShadow,
      renderOrder: node.renderOrder, frustumCulled: node.frustumCulled, layers: node.layers.mask,
      matrixWorld: node.matrixWorld.toArray(), worldVertices,
      attributes: Object.fromEntries(Object.entries(geometry.attributes).sort().map(([name, attribute]) => [name, {
        itemSize: attribute.itemSize, normalized: attribute.normalized, array: [...attribute.array]
      }])),
      index: geometry.index ? [...geometry.index.array] : null,
      groups: geometry.groups, drawRange: geometry.drawRange,
      material: Array.isArray(node.material) ? node.material.map(materialState) : materialState(node.material)
    };
    // Preserve non-finite values and signed zeros in synthetic edge cases.
    const key = sha256(JSON.stringify(state, (_, value) => typeof value === 'number'
      ? Object.is(value, -0) ? '-0' : Number.isFinite(value) ? value : String(value) : value));
    (isRoad(node) ? road : other).push(key);
    if (node.isLine) lines++;
    if (node.isMesh) {
      meshes++;
      const count = (geometry.index?.count ?? position.count) / 3;
      triangles += count;
      if (isRoad(node)) roadTriangles += count;
    }
  });
  return {
    road: road.sort(), uniqueRoad: [...new Set(road)].sort(), other: other.sort(),
    meshes, triangles, lines, roadTriangles,
    geometries: resources.geometries.size, materials: resources.materials.size
  };
}

export function inspectView(createView, spec) {
  const scene = new THREE.Scene(), view = createView(scene, spec);
  try { return sceneFootprints(scene); } finally { view.dispose(); }
}
