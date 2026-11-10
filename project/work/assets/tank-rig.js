/** Measured V5 derivative rig. Raw asset metres are scaled exactly once by gameScale.
 * Provenance and binary validation live beside this file; no external asset/decoder.
 */
export const TANK_ASSET = Object.freeze({
  file: 'tank_v5_articulated.glb',
  gameScale: 0.455,
  forward: '-Z', up: '+Y',
  linksPerSide: 56,
  trackLoopRaw: 13.137229394046273,
  trackLoopMeters: 13.137229394046273 * 0.455,
  trackPitchRaw: 13.137229394046273 / 56,
  trackSideRaw: 1.68,
  trackHeightCorrectionRaw: -0.0775,
  wheelRadiusRaw: 0.37,
  wheelRadius: 0.37 * 0.455,
  guideRadiusRaw: 0.34,
  turretPivotRaw: Object.freeze([0, 1.6725492477416992, -0.11995315551757812]),
  elevationPivotRaw: Object.freeze([0, 0.4000358581542969, -1.2879886627197266]),
  muzzleLocalRaw: Object.freeze([0, 0.0201416015625, -5.109442710876465]),
  turretPivot: Object.freeze({x: 0, y: 1.6725492477416992 * .455, z: -.11995315551757812 * .455}),
  barrelPivot: Object.freeze({x: 0, y: .4000358581542969 * .455, z: -1.2879886627197266 * .455}),
  muzzleLocal: Object.freeze({x: 0, y: .0091644287109375, z: -2.3247964334487916}),
});

// Port of the preserved source improve_running_gear.py, not an approximate ellipse.
export const TRACK_PATH = Object.freeze({
  roadY: 1.90, roadZ: .60, roadPathRadius: .43,
  guideY: 2.60, guideZ: .98, guidePathRadius: .40,
  bottomZ: .17, topZ: 1.38,
  alpha: .5350167748020606,
  s1: 2.130057213164886, s2: 2.9259843455080423,
  s3: 3.9686146970231357, halfLength: 6.568614697023136,
});
