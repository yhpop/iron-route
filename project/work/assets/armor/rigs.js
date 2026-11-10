/** Measured game-scale Newc42 derivatives. Not historical dimensions. */
const deepFreeze=o=>{Object.values(o).forEach(v=>{if(v&&typeof v==="object")deepFreeze(v)});return Object.freeze(o)};
export const ARMOR_RIGS=deepFreeze({
  "newc-tiger": {
    "id": "newc-tiger",
    "version": 1,
    "file": "armor/newc-tiger.glb",
    "gameScale": 1,
    "forward": "-Z",
    "up": "+Y",
    "sourceScale": 0.587407625307345,
    "rig": {
      "hullProxy": {
        "width": 2.25,
        "height": 1.111356496810913,
        "depth": 3.6921541690826416,
        "offset": {
          "x": 0.0,
          "y": 0.5556782484054565,
          "z": 0.0
        }
      },
      "turretProxy": {
        "width": 1.3808040022850037,
        "height": 0.7564262611958839,
        "depth": 1.8789193034172058,
        "offset": {
          "x": -8.940696716308594e-08,
          "y": 0.3782025873661041,
          "z": -0.01723739504814148
        }
      },
      "turretPivot": {
        "x": -0.025352900847792625,
        "y": 0.9165346622467041,
        "z": -0.0020023665856570005
      },
      "barrelPivot": {
        "x": 1.30385160446167e-08,
        "y": 0.33619630336761475,
        "z": -0.7879533171653748
      },
      "barrelCapsule": {
        "radius": 0.1022220119292308,
        "start": {
          "x": -0.0018250755965709686,
          "y": 0.002507448196411133,
          "z": -0.06796509027481079
        },
        "end": {
          "x": -0.0018250960856676102,
          "y": 0.002506256103515625,
          "z": -2.333319902420044
        }
      },
      "muzzleLocal": {
        "x": -0.0018250960856676102,
        "y": 0.002506256103515625,
        "z": -2.333319902420044
      }
    },
    "wheelNodes": [
      "Wheel_0",
      "Wheel_1",
      "Wheel_2",
      "Wheel_3",
      "Wheel_4",
      "Wheel_5",
      "Wheel_6",
      "Wheel_7",
      "Wheel_8",
      "Wheel_9",
      "Wheel_10",
      "Wheel_12",
      "Wheel_13",
      "Wheel_14",
      "Wheel_15",
      "Wheel_16",
      "Wheel_17",
      "Wheel_18",
      "Wheel_19",
      "Wheel_20",
      "Wheel_21"
    ],
    "wheelRadii": {
      "Wheel_0": 0.2101994752883911,
      "Wheel_1": 0.23509660363197327,
      "Wheel_2": 0.2350965142250061,
      "Wheel_3": 0.23509664833545685,
      "Wheel_4": 0.2350965249352157,
      "Wheel_5": 0.2350964993238449,
      "Wheel_6": 0.23509655892848969,
      "Wheel_7": 0.23509660363197327,
      "Wheel_8": 0.23509648442268372,
      "Wheel_9": 0.2101995348930359,
      "Wheel_10": 0.0440436452627182,
      "Wheel_12": 0.2101995348930359,
      "Wheel_13": 0.23509648442268372,
      "Wheel_14": 0.23509658873081207,
      "Wheel_15": 0.23509655892848969,
      "Wheel_16": 0.2350964993238449,
      "Wheel_17": 0.2350965249352157,
      "Wheel_18": 0.23509664833545685,
      "Wheel_19": 0.2350965142250061,
      "Wheel_20": 0.23509660363197327,
      "Wheel_21": 0.2101995348930359
    },
    "capabilities": {
      "turretYaw": true,
      "gunElevation": true,
      "recoil": true,
      "wheelRotation": true,
      "trackAnimation": false
    },
    "license": "CC0-1.0",
    "visualStatus": "offline-reviewed-low-poly-not-photoreal",
    "validatedMotion": {
      "elevationDegrees": [
        -10,
        30
      ],
      "recoil": [
        0,
        0.15
      ]
    },
    "neutralizedMarkingFaces": [
      [
        "Pz-VI-Tiger",
        760
      ],
      [
        "Pz-VI-Tiger",
        761
      ],
      [
        "Pz-VI-Tiger",
        762
      ],
      [
        "Pz-VI-Tiger",
        763
      ],
      [
        "Pz-VI-Tiger",
        764
      ],
      [
        "Pz-VI-Tiger",
        766
      ],
      [
        "Pz-VI-Tiger",
        767
      ],
      [
        "Pz-VI-Tiger",
        768
      ],
      [
        "Pz-VI-Tiger",
        769
      ],
      [
        "Pz-VI-Tiger",
        770
      ]
    ],
    "shaftSourceVertexCount": 144
  },
  "newc-pz3": {
    "id": "newc-pz3",
    "version": 1,
    "file": "armor/newc-pz3.glb",
    "gameScale": 1,
    "forward": "-Z",
    "up": "+Y",
    "sourceScale": 0.692908666504383,
    "rig": {
      "hullProxy": {
        "width": 1.9999998807907104,
        "height": 1.1953450441360474,
        "depth": 3.717334747314453,
        "offset": {
          "x": 0.0,
          "y": 0.5976725220680237,
          "z": 0.0
        }
      },
      "turretProxy": {
        "width": 1.2646771669387817,
        "height": 0.6260304315183021,
        "depth": 1.902065634727478,
        "offset": {
          "x": -7.152557373046875e-07,
          "y": 0.3129916191101074,
          "z": 0.10223346948623657
        }
      },
      "turretPivot": {
        "x": 6.266071181926236e-07,
        "y": 1.1376949548721313,
        "z": -0.1730201691389084
      },
      "barrelPivot": {
        "x": 0.004374070558696985,
        "y": 0.1983736753463745,
        "z": -0.5312958359718323
      },
      "barrelCapsule": {
        "radius": 0.0643146359225559,
        "start": {
          "x": -0.048682648688554764,
          "y": 0.02124243974685669,
          "z": -0.2658884525299072
        },
        "end": {
          "x": -0.04868285357952118,
          "y": 0.021242260932922363,
          "z": -1.6508952379226685
        }
      },
      "muzzleLocal": {
        "x": -0.04868285357952118,
        "y": 0.021242260932922363,
        "z": -1.6508952379226685
      }
    },
    "wheelNodes": [
      "Wheel_0",
      "Wheel_1",
      "Wheel_2",
      "Wheel_3",
      "Wheel_4",
      "Wheel_5",
      "Wheel_6",
      "Wheel_7",
      "Wheel_8",
      "Wheel_9",
      "Wheel_10",
      "Wheel_12",
      "Wheel_13",
      "Wheel_14",
      "Wheel_15",
      "Wheel_16",
      "Wheel_17",
      "Wheel_18",
      "Wheel_19",
      "Wheel_20",
      "Wheel_21",
      "Wheel_22"
    ],
    "wheelRadii": {
      "Wheel_0": 0.1811261773109436,
      "Wheel_1": 0.10883642360568047,
      "Wheel_2": 0.10883644223213196,
      "Wheel_3": 0.27241548895835876,
      "Wheel_4": 0.10883644223213196,
      "Wheel_5": 0.2724154442548752,
      "Wheel_6": 0.1811261773109436,
      "Wheel_7": 0.18112619034945965,
      "Wheel_8": 0.18112619500607252,
      "Wheel_9": 0.1811261773109436,
      "Wheel_10": 0.181126207113266,
      "Wheel_12": 0.10883644223213196,
      "Wheel_13": 0.18112623691558838,
      "Wheel_14": 0.2724154442548752,
      "Wheel_15": 0.1811261922121048,
      "Wheel_16": 0.1811261922121048,
      "Wheel_17": 0.18112618662416935,
      "Wheel_18": 0.1811261922121048,
      "Wheel_19": 0.181126207113266,
      "Wheel_20": 0.27241549640893936,
      "Wheel_21": 0.10883644223213196,
      "Wheel_22": 0.10883647203445435
    },
    "capabilities": {
      "turretYaw": true,
      "gunElevation": true,
      "recoil": true,
      "wheelRotation": true,
      "trackAnimation": false
    },
    "license": "CC0-1.0",
    "visualStatus": "offline-reviewed-low-poly-not-photoreal",
    "validatedMotion": {
      "elevationDegrees": [
        -10,
        30
      ],
      "recoil": [
        0,
        0.15
      ]
    },
    "neutralizedMarkingFaces": [
      [
        "Pz-III-J",
        1187
      ],
      [
        "Pz-III-J",
        1188
      ],
      [
        "Pz-III-J",
        1189
      ],
      [
        "Pz-III-J",
        1190
      ],
      [
        "Pz-III-J",
        1191
      ],
      [
        "Pz-III-J",
        1192
      ],
      [
        "Pz-III-J",
        1193
      ],
      [
        "Pz-III-J",
        1194
      ],
      [
        "Pz-III-J",
        1195
      ],
      [
        "Pz-III-J",
        1198
      ],
      [
        "Pz-III-J",
        1200
      ],
      [
        "Pz-III-J",
        1201
      ],
      [
        "Pz-III-J",
        1202
      ],
      [
        "Pz-III-J",
        1203
      ],
      [
        "Pz-III-J",
        1204
      ],
      [
        "Pz-III-J",
        1205
      ],
      [
        "Pz-III-J",
        1206
      ]
    ],
    "shaftSourceVertexCount": 40
  },
  "newc-leichttraktor": {
    "id": "newc-leichttraktor",
    "version": 1,
    "file": "armor/newc-leichttraktor.glb",
    "gameScale": 1,
    "forward": "-Z",
    "up": "+Y",
    "sourceScale": 0.8393880756094954,
    "rig": {
      "hullProxy": {
        "width": 1.7999999523162842,
        "height": 1.40194571018219,
        "depth": 3.5706684589385986,
        "offset": {
          "x": 0.0,
          "y": 0.700972855091095,
          "z": 0.0
        }
      },
      "turretProxy": {
        "width": 1.2620789408683777,
        "height": 0.7253886461257935,
        "depth": 1.5263304114341736,
        "offset": {
          "x": 8.940696716308594e-08,
          "y": 0.622735321521759,
          "z": -0.03619697690010071
        }
      },
      "turretPivot": {
        "x": 0.00026341548073105514,
        "y": 0.9574058055877686,
        "z": 0.591526210308075
      },
      "barrelPivot": {
        "x": 0.08703523129224777,
        "y": 0.6098736524581909,
        "z": -0.4678414762020111
      },
      "barrelCapsule": {
        "radius": 0.04856280163658706,
        "start": {
          "x": -0.20178139209747314,
          "y": 0.06630092859268188,
          "z": -0.10946055501699448
        },
        "end": {
          "x": -0.20178140699863434,
          "y": 0.07000958919525146,
          "z": -1.0775575637817383
        }
      },
      "muzzleLocal": {
        "x": -0.20178140699863434,
        "y": 0.07000958919525146,
        "z": -1.0775575637817383
      }
    },
    "wheelNodes": [
      "Wheel_2",
      "Wheel_3",
      "Wheel_4",
      "Wheel_5",
      "Wheel_6",
      "Wheel_7",
      "Wheel_8",
      "Wheel_9",
      "Wheel_10",
      "Wheel_11",
      "Wheel_12",
      "Wheel_13",
      "Wheel_14",
      "Wheel_15",
      "Wheel_16",
      "Wheel_18",
      "Wheel_19",
      "Wheel_20",
      "Wheel_21",
      "Wheel_22",
      "Wheel_23",
      "Wheel_24",
      "Wheel_25",
      "Wheel_26",
      "Wheel_27",
      "Wheel_28",
      "Wheel_29",
      "Wheel_30",
      "Wheel_31",
      "Wheel_32"
    ],
    "wheelRadii": {
      "Wheel_2": 0.2592231184244156,
      "Wheel_3": 0.0678299069404602,
      "Wheel_4": 0.08879786729812622,
      "Wheel_5": 0.08879786729812622,
      "Wheel_6": 0.08879789710044861,
      "Wheel_7": 0.08879782259464264,
      "Wheel_8": 0.088797926902771,
      "Wheel_9": 0.08879783004522324,
      "Wheel_10": 0.08879787847399712,
      "Wheel_11": 0.08879781514406204,
      "Wheel_12": 0.0887979120016098,
      "Wheel_13": 0.08879783749580383,
      "Wheel_14": 0.08879789710044861,
      "Wheel_15": 0.08879783749580383,
      "Wheel_16": 0.2592231035232544,
      "Wheel_18": 0.2592231184244156,
      "Wheel_19": 0.0678299069404602,
      "Wheel_20": 0.088797926902771,
      "Wheel_21": 0.08879789710044861,
      "Wheel_22": 0.08879795670509338,
      "Wheel_23": 0.08879782259464264,
      "Wheel_24": 0.088797926902771,
      "Wheel_25": 0.08879780769348145,
      "Wheel_26": 0.08879788219928741,
      "Wheel_27": 0.08879781141877174,
      "Wheel_28": 0.0887979120016098,
      "Wheel_29": 0.08879783749580383,
      "Wheel_30": 0.08879786729812622,
      "Wheel_31": 0.08879780769348145,
      "Wheel_32": 0.25922316312789917
    },
    "capabilities": {
      "turretYaw": true,
      "gunElevation": true,
      "recoil": true,
      "wheelRotation": true,
      "trackAnimation": false
    },
    "license": "CC0-1.0",
    "visualStatus": "offline-reviewed-low-poly-not-photoreal",
    "validatedMotion": {
      "elevationDegrees": [
        -10,
        30
      ],
      "recoil": [
        0,
        0.15
      ]
    },
    "neutralizedMarkingFaces": [
      [
        "Turret",
        200
      ],
      [
        "Turret",
        201
      ],
      [
        "Turret",
        202
      ],
      [
        "Turret",
        203
      ],
      [
        "Turret",
        204
      ],
      [
        "Turret",
        205
      ],
      [
        "Turret",
        206
      ],
      [
        "Turret",
        207
      ],
      [
        "Turret",
        208
      ],
      [
        "Turret",
        209
      ],
      [
        "Turret",
        210
      ],
      [
        "Turret",
        211
      ]
    ],
    "shaftSourceVertexCount": 40
  }
});
