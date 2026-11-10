import {VEHICLE_PLATES} from '../assets/ui/vehicle-plates.js';
export function getVehiclePlate(id) {
  return typeof id === 'string' && Object.hasOwn(VEHICLE_PLATES, id) ? VEHICLE_PLATES[id] : null;
}
const fields = [
  ['armor', 'HP', vehicle => vehicle?.hp],
  ['damage', 'HP', vehicle => vehicle?.weapon?.damage],
  ['reload', 's', vehicle => vehicle?.weapon?.reload],
  ['travel', 'm/s', vehicle => vehicle?.controller?.governorCaps?.travel],
];
const valid = value => Number.isFinite(value) && value >= 0 ? value : null;
export function createVehicleDossier(vehicle, roster) {
  if (!vehicle || typeof vehicle !== 'object' || Array.isArray(vehicle) || typeof vehicle.id !== 'string' || !vehicle.id.trim()) return null;
  const candidates = Array.isArray(roster) ? roster : [];
  const metrics = Object.fromEntries(fields.map(([key, unit, read]) => {
    const value = valid(read(vehicle));
    const max = candidates.reduce((largest, item) => Math.max(largest, valid(read(item)) ?? 0), 0);
    return [key, {key, value, unit, max, fraction: value === null || max === 0 ? 0 : Math.max(0, Math.min(1, value / max))}];
  }));
  return {id: vehicle.id, title: vehicle.title, role: vehicle.role, tradeoff: vehicle.tradeoff, plate: getVehiclePlate(vehicle.id), metrics};
}
