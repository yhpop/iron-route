/** CC0 Quaternius asset, measured game-scale derivatives; not historical dimensions. */
const deepFreeze=o=>{for(const v of Object.values(o))if(v&&typeof v==="object")deepFreeze(v);return Object.freeze(o);};
export const QUATERNIUS_SANDFALCON_RIG=deepFreeze({
  "id": "quaternius-tank-staging",
  "version": 2,
  "file": "../normalized/tank-normalized.glb",
  "gameScale": 1,
  "forward": "-Z",
  "up": "+Y",
  "sourceSHA256": "897fb714d05c47da9fbac2cf0b4121640b4cd721491ed2fbcd79818a97def725",
  "adapterSHA256": "705803c0ea4ac06aae3607b50f003e4d516bd2a9aa379d37ae5ef5e01b4da271",
  "restHullProxy": {
    "width": 2.2,
    "height": 0.8962049513293151,
    "depth": 3.214410447329242,
    "offset": {
      "x": -1.1102230246251565e-16,
      "y": 0.44810247566465744,
      "z": 9.30251605746335e-8
    }
  },
  "rig": {
    "hullProxy": {
      "width": 2.2200000000000006,
      "height": 0.9062049513293151,
      "depth": 3.264718596965171,
      "offset": {
        "x": 1.1102230246251565e-16,
        "y": 0.45310247566465756,
        "z": 0.00004885864115999894
      }
    },
    "turretProxy": {
      "width": 1.6386360562233788,
      "height": 0.35178746929750115,
      "depth": 1.9780551935177866,
      "offset": {
        "x": -3.45318734717992e-9,
        "y": 0.17588373464875046,
        "z": 1.1102230246251565e-16
      }
    },
    "turretPivot": {
      "x": -0.006426890614563158,
      "y": 0.655419265974557,
      "z": 0.0810293178961501
    },
    "barrelPivot": {
      "x": 0.006426877917323822,
      "y": 0.1977641866133042,
      "z": -0.688216534886114
    },
    "barrelCapsule": {
      "radius": 0.0748723770348739,
      "start": {
        "x": 3.1213259800433324e-7,
        "y": 4.4155329825823486e-7,
        "z": -0.2738581313952463
      },
      "end": {
        "x": -2.133944175530811e-8,
        "y": -2.6405532760342965e-8,
        "z": -1.6392513440829268
      }
    },
    "muzzleLocal": {
      "x": -2.133944175530811e-8,
      "y": -2.6405532760342965e-8,
      "z": -1.6392513440829268
    }
  },
  "validatedMotion": {
    "elevationRadians": [
      -0.12,
      0.3
    ],
    "recoil": [
      0,
      0.08
    ],
    "turretYawRadians": [
      -3.141592653589793,
      3.141592653589793
    ]
  },
  "motionEnvelope": {
    "min": [
      -1.1100000000000003,
      -0.016066503393178756,
      -1.6323104398414254
    ],
    "max": [
      1.1100000000000005,
      0.9062049513293151,
      1.6324081571237454
    ],
    "sampledBounds": {
      "min": [
        -1.1000000000000003,
        -0.006066503393178758,
        -1.6223104398414254
      ],
      "max": [
        1.1000000000000005,
        0.8962049513293151,
        1.6224081571237454
      ]
    },
    "samplesPerClip": 241,
    "clips": 4,
    "paddingGameUnits": 0.01,
    "scope": "all skinned hull and tracks, excludes articulated turret and gun",
    "method": "actual skinned vertices at uniform time samples; independent 162-phase test plus known counterexample",
    "continuousTimeGuarantee": false,
    "restProxyUnchanged": true
  },
  "hullPolicy": "Physics choice: runtime hull uses padded motionEnvelope XZ and positive Y upper bound, bottom fixed at Y=0. Original restHullProxy retained separately. Negative-Y animated belt excursion (~0.0061) is a cosmetic terrain-contact limitation, explicitly excluded from physical hull; no model stretch.",
  "status": "measured asset metadata and headless physics contract only; not integrated/playable",
  "limitations": [
    "No runtime animation mixer/model-view integration",
    "No actual terrain/contact gameplay acceptance",
    "Two source zero-area turret triangles retained",
    "Sampled hull motionEnvelope is not continuous-time proof",
    "Physical hull deliberately excludes negative-Y animated track excursion; terrain-ground interaction unvalidated"
  ]
});
