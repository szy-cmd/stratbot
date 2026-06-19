import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Html, useTexture } from '@react-three/drei';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Interactive 3D F1 Car visualizer / customizer (STRATBOT).
 * Uses unpacked glTF + separate textures from 3d models folder for live material/part tweaks.
 * Stats drive live updates (tyre wear/compound, wing angle from aero, engine glow from power, body color from team).
 * Clickable parts + sliders. Affects sim physics + ML LapDelta.
 */

const COMPOUNDS = ['soft', 'medium', 'hard'];
const COMPOUND_COLORS = { soft: '#ff3333', medium: '#ffcc00', hard: '#eeeeee' };

// Part highlight colors — tune these if you want stronger/weaker feedback
const HIGHLIGHT = {
  hover: { color: 0x00d4aa, intensity: 0.72 },    // f1-accent teal on hover
  selected: { color: 0xff8700, intensity: 0.95 },   // McLaren orange when selected
};

const PART_HINTS = {
  tyres: 'Tyre compound & wear — click wheels again to cycle compound.',
  aero: 'Wing downforce — adjusts front/rear wing angle in the viewer.',
  power: 'Engine output — affects straight-line pace and exhaust glow.',
  body: 'Main chassis / monocoque — team colour is applied here.',
  suspension: 'Suspension assembly — structural, no direct setup slider.',
  halo: 'Driver safety halo — fixed regulatory structure.',
  cockpit: 'Cockpit / headrest area.',
  mirrors: 'Side mirrors.',
};

// Team to model folder mapping (unpacked glTF + separate textures for live tweaks).
// All models copied to frontend/public/models/<key>/
const TEAM_MODEL_MAP = {
  'McLaren': 'f1_2025_mclaren_mcl39',
  'Red Bull': 'f1-2025_redbull_rb21',
  'Aston Martin': 'aston_martin_aramco_amr25',
  'Mercedes': 'f1_mercedes_w14_free',
  'Ferrari': 'ferrari_sf-25',
  'Alpine': '2025_alpine_a525',
};

function getModelUrlForTeam(team) {
  const key = TEAM_MODEL_MAP[team];
  if (!key) {
    console.warn(`[CarCustomizer] No dedicated 3D model for team "${team}". Falling back to McLaren.`);
    return '/models/f1_2025_mclaren_mcl39/scene.gltf';
  }
  return `/models/${key}/scene.gltf`;
}

const TEAM_ROTATIONS = {
  'McLaren': { x: 0, y: 0, z: 0 },
  'Red Bull': { x: 0, y: 0, z: 0 },
  'Aston Martin': { x: 0, y: 0, z: 0 },
  'Mercedes': { x: 0, y: 0, z: 0 },
  'Ferrari': { x: 0, y: 0, z: 0 },
  'Alpine': { x: 0, y: 0, z: 0 },
};

const TEAM_SCALE_MULT = {
  'McLaren': 1.0,
  'Red Bull': 4.0,
  'Aston Martin': 1.0,
  'Mercedes': 1.0,
  'Ferrari': 1.0,
  'Alpine': 1.0,
};

const TEAM_POSITION_OFFSETS = {
  'McLaren': { x: 0, y: 0, z: 0 },
  'Red Bull': { x: 0, y: 0, z: 0 },
  'Aston Martin': { x: 0, y: 0, z: 0 },
  'Mercedes': { x: 0, y: 0, z: 0 },
  'Ferrari': { x: 0, y: 0, z: 0 },
  'Alpine': { x: 0, y: 0, z: 0 },
};

const TEAM_TARGET_CENTER_OFFSETS = {
  'McLaren': { x: 0, y: 0, z: 0 },
  'Red Bull': { x: 0, y: 0, z: 0 },
  'Aston Martin': { x: 0, y: 0, z: 0 },
  'Mercedes': { x: 0, y: 0, z: 0 },
  'Ferrari': { x: 0, y: 0, z: 0 },
  'Alpine': { x: 0, y: 0, z: 0 },
};

const TEAM_FRONT_Z_SIGN = {
  'McLaren': -1,
  'Red Bull': 1,
  'Aston Martin': -1,
  'Mercedes': 1,
  'Ferrari': -1,
  'Alpine': -1,
};

const MODEL_INTEGRATION_SUMMARY = {
  'McLaren': { file: 'f1_2025_mclaren_mcl39/scene.gltf' },
  'Red Bull': { file: 'f1-2025_redbull_rb21/scene.gltf' },
  'Aston Martin': { file: 'aston_martin_aramco_amr25/scene.gltf' },
  'Mercedes': { file: 'f1_mercedes_w14_free/scene.gltf' },
  'Ferrari': { file: 'ferrari_sf-25/scene.gltf' },
  'Alpine': { file: '2025_alpine_a525/scene.gltf' },
};

// Weather-specific HDRI / panorama racetrack backgrounds (equirectangular or 360 panoramas).
// ALL backgrounds now come from the BACKGROUNDS/ folder (user-provided).
// Copy images from BACKGROUNDS/ into frontend/public/backgrounds/ (and dist/backgrounds/ for builds).
// Register exact paths below in USER_HDRI_OVERRIDES or the expected names in WEATHER_HDRI.
// Old generated racetrack-*.jpg and cyber-grid have been fully removed.
const WEATHER_HDRI = {
  clear: '/backgrounds/SUNNY.png',
  overcast: '/backgrounds/CLOUDY-GPT.png',
  rainy: '/backgrounds/RAINY-GPT.png',
};

// User's explicit overrides (for non-standard filenames).
// The viewer prefers these and shows (custom) badge.
const USER_HDRI_OVERRIDES = {
  overcast: '/backgrounds/CLOUDY-GPT.png',
  // If your sunny/rainy use different names, override here e.g.
  // clear: '/backgrounds/SUNNY.png',
};

// Per-weather lighting and fog settings so the F1 car stays clearly visible and realistically lit in every condition.
// Additional "car-only" lights (in practice only affect the lit PBR car meshes, since HDRI bg sphere is MeshBasicMaterial/unlit)
// are added in WeatherLights for extra shine, specular highlights, and glimmer on paint/chrome/glass.
const WEATHER_PRESETS = {
  clear: {
    name: 'Clear',
    ambient: { intensity: 0.8, color: '#ffffff' },
    sun: { intensity: 2.0, position: [12, 22, 4], color: '#fff5e0' },
    accent: { intensity: 0.3, color: '#bbddff' },
    fog: { color: '#c8d9eb', near: 95, far: 320 },
    bgTint: '#e8e8e8',  // lighter tint now - less darkening on the sunny pano for better balance
    envIntensity: 1.1,  // boost HDRI reflections/lighting on the car a bit
  },
  overcast: {
    name: 'Overcast',
    ambient: { intensity: 1.6, color: '#d0d8e0' },  // more boost for car visibility
    sun: { intensity: 1.3, position: [7, 20, -2], color: '#a8b8c8' },
    accent: { intensity: 0.4, color: '#8fa4b8' },
    fog: { color: '#95a3b3', near: 55, far: 240 },
    bgTint: '#c8c8c8',
    envIntensity: 1.3,
  },
  rainy: {
    name: 'Rainy',
    ambient: { intensity: 2.8, color: '#a8b4c4' },  // much brighter for car on rainy
    sun: { intensity: 1.8, position: [4, 16, 1], color: '#8a9ab0' },
    accent: { intensity: 1.2, color: '#6a9cc8' },
    fog: { color: '#5e6d7d', near: 32, far: 170 },
    bgTint: '#a8a8a8',
    envIntensity: 2.5,  // strong reflections from the rainy HDRI onto the car
    rainyBgColor: '#0f1a28',  // solid dark (but not pitch black) bg for rainy ONLY - do not use the HDRI image as visual background. Tunable here.
  },
};

function normalizeOrientationAndCenter(obj, team = 'McLaren') {
  if (!obj || !obj.isObject3D) return;
  const rot = TEAM_ROTATIONS[team] || { x: 0, y: 0, z: 0 };
  obj.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
  // Center on bbox center
  let box = new THREE.Box3().setFromObject(obj);
  let center = box.getCenter(new THREE.Vector3());
  obj.position.x -= center.x;
  obj.position.y -= center.y;
  obj.position.z -= center.z;
  // Rest on ground (min y = 0)
  box = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box.min.y;
}

/** Classify a glTF node or material name into a customizer part */
function classifyNodeName(name) {
  if (!name) return null;
  const n = name.toLowerCase();

  if (n.includes('front_tire') || n.includes('front_tyre')) return { id: 'tyres', label: 'Front Tyres' };
  if (n.includes('rear_tire') || n.includes('rear_tyre')) return { id: 'tyres', label: 'Rear Tyres' };
  if (n.includes('wheel_rim') || n.includes('wheel_nut') || n.includes('wheel_screw') || n.includes('wheel_cover') || n.includes('tire') || n.includes('tyre') || n.includes('pirelli') || n.includes('rubber')) {
    return { id: 'tyres', label: 'Wheels & Tyres' };
  }
  if (n.includes('front_wing') || n.includes('frontwing') || n.includes('front_flap') || n.includes('frontflap') || n.includes('front_spoiler') || n.includes('frontspoiler') || n.includes('fw_') || n.includes('fw')) return { id: 'aero', label: 'Front Wing' };
  if (n.includes('rear_wing') || n.includes('rearwing') || n.includes('rear_flap') || n.includes('rearflap') || n.includes('rear_spoiler') || n.includes('rearspoiler') || n.includes('rwing')) return { id: 'aero', label: 'Rear Wing' };
  if (n.includes('drs') || n.includes('windlet') || n.includes('drs_puller')) return { id: 'aero', label: 'Aerodynamics' };
  if (n.includes('exhaust') || n.includes('exthaust') || n.includes('rearlight')) return { id: 'power', label: 'Engine / Exhaust' };
  if (n.includes('suspension') || n.includes('carbon_suspension')) return { id: 'suspension', label: 'Suspension' };
  if (n.includes('halo')) return { id: 'halo', label: 'Halo' };
  if (n.includes('headrest') || n.includes('HEADREST')) return { id: 'cockpit', label: 'Cockpit' };
  if (n.includes('mirror')) return { id: 'mirrors', label: 'Mirrors' };
  if (n.includes('main_body') || n.includes('cam_tbone') || n.includes('Body_Main') || n.includes('paints') || n.includes('body_main') || n.includes('body_wings') || n.includes('chassis') || n.includes('monocoque')) return { id: 'body', label: 'Chassis / Body' };

  return null;
}

/** Meshes are named Object_N — walk parents + materials to find the real part */
function resolvePartFromObject(obj, team = 'McLaren') {
  if (obj?.userData?.partId) {
    return { id: obj.userData.partId, label: obj.userData.partLabel };
  }

  let current = obj;
  while (current) {
    const hit = classifyNodeName(current.name);
    if (hit) return hit;
    current = current.parent;
  }

  if (obj?.isMesh) {
    const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
    for (const mat of mats) {
      const hit = classifyNodeName(mat?.name);
      if (hit) return hit;
    }
    // Spatial fallback for bad naming (W14 Cubes, some Red Bull parts)
    const spatial = getSpatialClassification(obj, team);
    if (spatial) return spatial;
  }

  return { id: 'unknown', label: 'Unknown Part' };
}

/** Finer group for hover/select — e.g. front axle vs rear axle */
function resolvePartGroup(obj, team = 'McLaren') {
  if (obj?.userData?.partGroup) return obj.userData.partGroup;

  let current = obj;
  while (current) {
    const n = (current.name || '').toLowerCase();
    if (n.includes('front_tire') || n.includes('front_tyre')) return 'front_tire';
    if (n.includes('rear_tire') || n.includes('rear_tyre')) return 'rear_tire';
    if (n.includes('front_wing') || n.includes('frontwing') || n.includes('frontspoiler') || n.includes('frontflap') || n.includes('fw_')) return 'front_wing';
    if (n.includes('rear_wing') || n.includes('rearwing') || n.includes('rearspoiler') || n.includes('rearflap') || n.includes('rwing')) return 'rear_wing';
    if (n.includes('exhaust') || n.includes('exthaust')) return 'exhaust';
    if (n.includes('suspension')) return 'suspension';
    if (n.includes('headrest')) return 'cockpit';
    if (n.includes('main_body')) return 'body';
    current = current.parent;
  }

  // Spatial fallback for group (used for hover highlighting whole front/rear tyres or wings)
  if (obj?.isMesh) {
    const spatial = getSpatialClassification(obj, team);
    if (spatial && spatial.group) {
      return spatial.group;
    }
  }

  return resolvePartFromObject(obj, team).id;
}

/**
 * Spatial fallback classification for models with non-descriptive names (e.g. W14 "Object_" / "Cube_", Red Bull generic).
 * Uses position in the *normalized* model space (center at 0,0,0 after our normalizeOrientationAndCenter).
 * Assumes after per-team rotation normalization, length axis is roughly Z, with negative Z = front (tweak isFront sign if reversed).
 */
function getSpatialClassification(mesh, team = 'McLaren') {
  if (!mesh || !mesh.isMesh) return null;
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const vol = size.x * size.y * size.z;

  // Also check materials for strong clues (pirelli for tyres, wing materials etc.)
  const mats = Array.isArray(mesh.material) ? mesh.material : (mesh.material ? [mesh.material] : []);
  const matNames = mats.map(m => (m.name || '').toLowerCase()).join(' ');
  const hasPirelli = matNames.includes('pirelli');
  const hasWingMat = matNames.includes('wing') || matNames.includes('flap') || matNames.includes('spoiler') || matNames.includes('carbon');
  const hasBodyMat = matNames.includes('body') || matNames.includes('paint') || matNames.includes('main') || matNames.includes('chassis');
  const hasWheelMat = matNames.includes('wheel') || matNames.includes('sk') || matNames.includes('rim');

  // Use per-team Z sign for front (set in TEAM_FRONT_Z_SIGN so Red Bull/Mercedes front/rear are correct)
  const zSignForFront = TEAM_FRONT_Z_SIGN[team] || -1;
  const isFront = Math.sign(center.z || 0) === zSignForFront;
  const isRear = Math.sign(center.z || 0) === -zSignForFront;

  if (team === 'Red Bull' || team === 'Mercedes') {
    console.log(`[SpatialAttempt ${team}] mesh="${mesh.name || 'anon'}" c.z=${center.z.toFixed(2)} sz=(${size.x.toFixed(1)},${size.y.toFixed(1)},${size.z.toFixed(1)}) vol=${vol.toFixed(1)} mats=${matNames.substring(0,60)}`);
  }

  // Tyres: small, low, sides, or confirmed by pirelli/wheel/sk material (strong for Red Bull)
  if ((size.y < 1.2 && vol < 2 && Math.abs(center.x) > 0.3 && center.y < 0.8) || hasPirelli || hasWheelMat) {
    return { id: 'tyres', label: 'Wheels & Tyres', group: isFront ? 'front_tire' : 'rear_tire' };
  }

  // Wings / aero: relatively flat (small y), decent span, at extreme z, or wing material. Relaxed for W14 thicker wings.
  if (((size.y < 1.0 && (size.x > 0.8 || size.z > 0.8) && Math.abs(center.z) > 0.3) || hasWingMat) && Math.abs(center.z) > 0.3) {
    const group = isFront ? 'front_wing' : 'rear_wing';
    return { id: 'aero', label: isFront ? 'Front Wing' : 'Rear Wing', group };
  }

  // Body / chassis: central + volume, or body material, or low flat large (floor/underbody for Red Bull "bottom")
  const isLowFlatLarge = size.y < 0.5 && center.y < 0 && (size.x > 1.5 || size.z > 1.5);
  if (((Math.abs(center.x) < 1.2 && Math.abs(center.z) < 1.8 && vol > 3 && size.x > 0.8 && size.z > 0.8) || hasBodyMat || isLowFlatLarge) && !hasWingMat) {
    return { id: 'body', label: 'Chassis / Body', group: 'body' };
  }

  // Exhaust / power: rear small low
  if (isRear && size.x < 0.7 && size.y < 0.7 && size.z < 0.7 && center.y < 0.5) {
    return { id: 'power', label: 'Engine / Exhaust', group: 'exhaust' };
  }

  if ((team === 'Red Bull' || team === 'Mercedes') ) {
    // Log every spatial attempt for these teams so user can see why a click got tyres/wing/body/unknown/exhaust
    console.log(`[SpatialAttempt ${team}] mesh="${mesh.name || 'anon'}" c.z=${center.z.toFixed(2)} sz=(${size.x.toFixed(1)},${size.y.toFixed(1)},${size.z.toFixed(1)}) mat=${matNames.substring(0,80)}`);
  }

  return null;
}

/** Stamp every mesh once so clicks/hover don't re-walk the hierarchy */
function tagModelParts(scene, team = 'McLaren') {
  if (!scene) return;
  scene.traverse((child) => {
    if (!child.isMesh) return;
    const part = resolvePartFromObject(child, team);
    child.userData.partId = part.id;
    child.userData.partLabel = part.label;
    child.userData.partGroup = resolvePartGroup(child, team);
  });
}

function meshPartId(mesh) {
  return mesh?.userData?.partId ?? resolvePartFromObject(mesh, 'McLaren').id;
}

function meshPartGroup(mesh) {
  return mesh?.userData?.partGroup ?? meshPartId(mesh);
}

function forEachMaterial(mesh, fn) {
  if (!mesh?.material) return;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach(fn);
}

function saveMaterialBaseline(mat) {
  if (!mat || mat.userData._hlBase) return;
  mat.userData._hlBase = {
    emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
    intensity: mat.emissiveIntensity ?? 0,
  };
}

function applyMeshHighlight(mesh, mode) {
  forEachMaterial(mesh, (mat) => {
    if (!mat.emissive) mat.emissive = new THREE.Color(0x000000);
    // Only save baseline when applying a highlight, not when clearing
    if (mode === 'hover' || mode === 'selected') {
      saveMaterialBaseline(mat);
    }
    if (mode === 'hover') {
      mat.emissive.setHex(HIGHLIGHT.hover.color);
      mat.emissiveIntensity = HIGHLIGHT.hover.intensity;
    } else if (mode === 'selected') {
      mat.emissive.setHex(HIGHLIGHT.selected.color);
      mat.emissiveIntensity = HIGHLIGHT.selected.intensity;
    } else {
      // Restore to baseline if it exists, otherwise set to black
      if (mat.userData._hlBase) {
        mat.emissive.copy(mat.userData._hlBase.emissive);
        mat.emissiveIntensity = mat.userData._hlBase.intensity;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
  });
}

function clearHighlightsOnScene(scene, exceptGroup = null) {
  if (!scene) return;
  scene.traverse((child) => {
    if (!child.isMesh) return;
    if (exceptGroup && meshPartGroup(child) === exceptGroup) return;
    applyMeshHighlight(child, null);
  });
}

function applyHighlightsForGroup(scene, partGroup, mode) {
  if (!scene || !partGroup) return;
  scene.traverse((child) => {
    if (!child.isMesh) return;
    if (meshPartGroup(child) === partGroup) {
      applyMeshHighlight(child, mode);
    }
  });
}

/** Re-apply the dynamic engine/exhaust emissive glow (from powerLevel) only to non-highlighted exhaust parts.
 *  This ensures glow is visible in normal state even after highlight clears/restores (which target baseline emissive=0).
 */
function applyNormalExhaustGlow(scene, powerLevel, exceptGroups = []) {
  if (!scene) return;
  const engineGlow = Math.max(0.18, ((powerLevel || 5) - 4) * 0.115);
  scene.traverse((child) => {
    if (!child.isMesh) return;
    const n = (child.name || '').toLowerCase();
    if (n.includes('exhaust') || n.includes('exthaust')) {
      const g = meshPartGroup(child);
      if (exceptGroups.includes(g)) return;
      forEachMaterial(child, (m) => {
        if (m.emissive) {
          m.emissive.setHex(0xff5500);
          m.emissive.multiplyScalar(engineGlow * 0.9);
        }
        if (m.emissiveIntensity !== undefined) m.emissiveIntensity = engineGlow * 1.8;
      });
    }
  });
}

const DEFAULT_MCLAREN_MODEL_URL = '/models/f1_2025_mclaren_mcl39/scene.gltf';

const BASE_MODEL_SCALE = 1.01615;

function RealF1Model({ stats, onPartClick, selectedPart, teamColor = '#3671C6', team = 'McLaren', modelUrl, viewZoom = 1, orbitControlsRef, frameKey = 0, forceClearHighlights = 0, desiredPreset = null }) {
  const primaryGltf = useGLTF(modelUrl);
  const fallbackGltf = useGLTF(DEFAULT_MCLAREN_MODEL_URL);
  const gltf = (primaryGltf && primaryGltf.scene) ? primaryGltf : fallbackGltf;
  const usingFallback = !(primaryGltf && primaryGltf.scene) && team !== 'McLaren';
  const { compound, initialTyreWear, aeroLevel, powerLevel } = stats;

  // Dev/validation log for model loading per team (helps verify normalization, presence)
  useEffect(() => {
    if (gltf?.scene) {
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      const maxD = Math.max(size.x, size.y, size.z);
      console.log(`[CarCustomizer] Loaded team=${team} modelUrl=${modelUrl} nativeMaxDim=${maxD.toFixed(2)}${usingFallback ? ' (FALLBACK to McLaren)' : ''}`);
      if (!window.__stratbotModelsLogged) {
        window.__stratbotModelsLogged = true;
        console.table(MODEL_INTEGRATION_SUMMARY);
      }
    }
    if (usingFallback) {
      console.warn(`[CarCustomizer] Primary model for team "${team}" at ${modelUrl} failed to load (file missing?). Gracefully fell back to McLaren.`);
    }
  }, [gltf, team, modelUrl, usingFallback]);
  const { camera } = useThree();
  const hoveredGroupRef = useRef(null);
  const modelRef = useRef(null);
  const selectedGroup = selectedPart?.group ?? null;
  const selectedGroupRef = useRef(selectedGroup);

  const tyreColor = COMPOUND_COLORS[compound] || '#ffcc00';
  const wearScale = Math.max(0.72, 1 - ((initialTyreWear || 0) / 95));
  const wingAngle = (aeroLevel - 5) * 0.085;
  const engineGlow = Math.max(0.18, (powerLevel - 4) * 0.115);

  // Auto-framing flag (dynamic, supports model changes)
  const framedRef = useRef(false);

  // Reset framing when model or explicit frameKey changes (for Reset button / future models)
  useEffect(() => {
    framedRef.current = false;
  }, [modelUrl, frameKey, team]);

  // Keep a ref in sync for event handlers (avoid stale closures for selected state during hovers/clicks)
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  useEffect(() => {
    if (!gltf?.scene) return;

    // Clone materials on first load / when needed so we don't mutate shared ones across re-renders
    const cloned = new WeakSet();

    gltf.scene.traverse((child) => {
      if (!child.isMesh) return;

      // Ensure we have per-mesh materials we can safely mutate
      if (child.material && !cloned.has(child.material)) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => {
            const c = m.clone();
            cloned.add(c);
            // Preserve any existing highlight baseline across re-clones (e.g. while selected and stats change)
            if (m.userData?._hlBase) {
              c.userData._hlBase = {
                emissive: m.userData._hlBase.emissive.clone(),
                intensity: m.userData._hlBase.intensity,
              };
            }
            // Save baseline immediately after cloning to preserve initial state (guarded inside save to not capture highlight state)
            saveMaterialBaseline(c);
            return c;
          });
        } else {
          const origMat = child.material;
          const c = origMat.clone();
          child.material = c;
          cloned.add(c);
          // Preserve any existing highlight baseline across re-clones (e.g. while selected and stats change)
          if (origMat.userData?._hlBase) {
            c.userData._hlBase = {
              emissive: origMat.userData._hlBase.emissive.clone(),
              intensity: origMat.userData._hlBase.intensity,
            };
          }
          // Save baseline immediately after cloning to preserve initial state (guarded inside save to not capture highlight state)
          saveMaterialBaseline(c);
        }
      }

      const n = (child.name || '').toLowerCase();
      const mat = child.material;
      const mats = Array.isArray(mat) ? mat : (mat ? [mat] : []);

      // === Body / main structure recoloring (team color) ===
      // Only force-tint for the McLaren model (its livery is tint-based). For other team-specific models
      // the authentic pre-baked team liveries in the GLTF textures are used instead.
      if (team === 'McLaren' && (n.includes('main_body') || n.includes('suspensions') || n.includes('headrest') ||
          n.includes('wheel_cover') || n.includes('wheel_windlet') || n.includes('mirror'))) {
        mats.forEach(m => {
          if (m.color) m.color.set(teamColor);
          // keep the rich PBR maps from the model
        });
      }

      // === Halo (special carbon part, light tint) ===
      if (n.includes('halo')) {
        mats.forEach(m => {
          if (m.color) m.color.set('#2a2a30'); // dark carbon, or mix with team if wanted
        });
      }

      // === Tyres / wheels: compound color + wear scale ===
      if (n.includes('tire') || n.includes('rear_tire') || n.includes('front_tire')) {
        // Scale for visual wear (affects the whole wheel group or tire submesh)
        child.scale.setScalar(wearScale);
        mats.forEach(m => {
          if (m.color) m.color.set(tyreColor); // tint the rubber
          // The model already has good normal + roughness for tires; tinting color works well on top of baseColor
        });
      }

      // Also tint wheel rims/nuts lightly or leave (they have their own maps)
      if (n.includes('wheel_rim') || n.includes('wheel_nut') || n.includes('wheel_screw')) {
        // keep mostly as-is, or slight desat
      }

      // === Wings rotation for aero ===
      if (n.includes('front_wing') || n.includes('rear_wing') || n.includes('drs_puller')) {
        const isFront = n.includes('front');
        // Apply to the wing nodes (they are groups or meshes in the hierarchy)
        child.rotation.x = wingAngle * (isFront ? 0.55 : 1.0);
      }

      // === Engine / exhaust glow (power) ===
      if (n.includes('exhaust') || n.includes('exthaust')) {
        mats.forEach(m => {
          if (m.emissive) {
            m.emissive.setHex(0xff5500);
            m.emissive.multiplyScalar(engineGlow * 0.9);
          }
          if (m.emissiveIntensity !== undefined) m.emissiveIntensity = engineGlow * 1.8;
        });
      }
    });
  }, [gltf, stats, teamColor, team, compound, initialTyreWear, aeroLevel, powerLevel, tyreColor, wearScale, wingAngle, engineGlow]);

  // Re-apply selection glow after stat/material updates (traverse effect resets emissive)
  useEffect(() => {
    if (!modelRef.current) return;
    // Clear hover state when selection is cleared to prevent stale hover highlights
    if (!selectedGroup) {
      hoveredGroupRef.current = null;
    }
    clearHighlightsOnScene(modelRef.current, selectedGroup);
    applyHighlightsForGroup(modelRef.current, selectedGroup, 'selected');
    if (hoveredGroupRef.current && hoveredGroupRef.current !== selectedGroup) {
      applyHighlightsForGroup(modelRef.current, hoveredGroupRef.current, 'hover');
    }
    // Re-apply normal exhaust glows to any exhaust groups not currently under highlight (selected or hover)
    const excepts = [];
    if (selectedGroup) excepts.push(selectedGroup);
    if (hoveredGroupRef.current && hoveredGroupRef.current !== selectedGroup) excepts.push(hoveredGroupRef.current);
    applyNormalExhaustGlow(modelRef.current, powerLevel, excepts);
  }, [selectedGroup, stats, teamColor, team, compound, initialTyreWear, aeroLevel, powerLevel]);

  // Force clear all highlights when parent requests it (e.g., clicking outside)
  useEffect(() => {
    if (!modelRef.current || forceClearHighlights === 0) return;
    hoveredGroupRef.current = null;
    clearHighlightsOnScene(modelRef.current, null);
    // After clearing everything, ensure exhaust glows are restored on all (no highlights active)
    applyNormalExhaustGlow(modelRef.current, powerLevel, []);
  }, [forceClearHighlights, powerLevel]);

  const handlePointerOver = (e) => {
    e.stopPropagation();
    const mesh = e.object;
    if (!mesh?.isMesh) return;

    const partGroup = meshPartGroup(mesh);
    hoveredGroupRef.current = partGroup;

    const sel = selectedGroupRef.current;
    modelRef.current?.traverse((child) => {
      if (!child.isMesh) return;
      const childGroup = meshPartGroup(child);
      if (childGroup === partGroup && childGroup !== sel) {
        applyMeshHighlight(child, 'hover');
      } else if (childGroup !== sel) {
        applyMeshHighlight(child, null);
      }
    });

    // Re-assert normal exhaust glow on exhaust parts that are not the hovered group and not selected
    // (clears during this over may have restored stale baseline on other exhausts)
    if (modelRef.current) {
      const exceptGs = [partGroup];
      if (sel && sel !== partGroup) exceptGs.push(sel);
      applyNormalExhaustGlow(modelRef.current, powerLevel, exceptGs);
    }

    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    const previousHover = hoveredGroupRef.current;
    hoveredGroupRef.current = null;

    const sel = selectedGroupRef.current;
    modelRef.current?.traverse((child) => {
      if (!child.isMesh) return;
      const childGroup = meshPartGroup(child);
      // Clear hover highlight from the previously hovered group (unless it's the selected group)
      if (childGroup === previousHover && childGroup !== sel) {
        applyMeshHighlight(child, null);
      }
    });

    // Re-assert normal exhaust glows for non-selected exhausts (in case the just-cleared hover group was exhaust, or to ensure freshness)
    if (modelRef.current) {
      const exceptGs = sel ? [sel] : [];
      applyNormalExhaustGlow(modelRef.current, powerLevel, exceptGs);
    }

    document.body.style.cursor = 'auto';
  };

  const handleClick = (e) => {
    e.stopPropagation();
    const part = resolvePartFromObject(e.object, team);
    onPartClick?.({ ...part, group: meshPartGroup(e.object) });
  };

  // ========================================================
  // AUTO-FRAMING SYSTEM (dynamic bounding box based)
  // Frames the car nicely on initial load in a professional front-3/4 slightly elevated view.
  // Calculates from the loaded glTF scene (supports future different models without hard-coded values).
  // Accounts for the render scale (base * user viewZoom) so the car fills the view appropriately.
  // Sets both camera position and OrbitControls target for consistent orbiting around the car.
  // ========================================================
  useEffect(() => {
    if (!gltf?.scene || framedRef.current) return;

    // Use a normalized temp clone for bbox so framing works consistently for every team.
    const temp = gltf.scene.clone();
    normalizeOrientationAndCenter(temp, team);
    const box = new THREE.Box3().setFromObject(temp);
    let center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (team === 'Mercedes') {
      console.log('[Mercedes debug] pure normalized center (from temp bbox):', center.clone());
    }

    const targetAdj = TEAM_TARGET_CENTER_OFFSETS[team] || { x: 0, y: 0, z: 0 };
    center.x += (targetAdj.x || 0);
    center.y += (targetAdj.y || 0);
    center.z += (targetAdj.z || 0);

    if (team === 'Mercedes') {
      console.log('[Mercedes debug] effective framing center after targetAdj:', center.clone());
    }

    const scaleMult = TEAM_SCALE_MULT[team] || 1;
    const renderScale = BASE_MODEL_SCALE * scaleMult * (viewZoom);
    const visualMaxDim = maxDim * renderScale;

    const fov = camera.fov * (Math.PI / 200);
    const distance = (visualMaxDim / 2) / Math.tan(fov / 2) * 0.85;

    let dir;
    if (desiredPreset === 'side') {
      dir = new THREE.Vector3(1, 0.08, 0).normalize(); // clean side profile
    } else if (desiredPreset === 'top') {
      dir = new THREE.Vector3(0, 1, 0.01).normalize(); // mostly top-down
    } else {
      // front34 or reset or default
      dir = new THREE.Vector3(1.15, 0.55, 1.65).normalize();
    }
    const camPos = center.clone().add(dir.multiplyScalar(distance));

    camera.position.copy(camPos);
    if (desiredPreset === 'top') {
      camera.lookAt(center.x, center.y - 2, center.z);
    } else {
      camera.lookAt(center.x, center.y + 0.2, center.z);
    }
    camera.updateProjectionMatrix();

    // Keep OrbitControls centered on the car so orbiting always feels natural around the vehicle
    if (orbitControlsRef && orbitControlsRef.current) {
      orbitControlsRef.current.target.copy(center);
      orbitControlsRef.current.update();
    }

    framedRef.current = true;
  }, [gltf?.scene, camera, orbitControlsRef, viewZoom, frameKey, team, desiredPreset]);

  if (!gltf?.scene) return null;

  // Center + reasonable scale for the customizer canvas (McLaren 2025 is a full-size F1 car in the source units).
  // viewZoom (passed from UI) lets the user magnify the car in the viewport independently of the actual car physics stats.
  // Base scale tuned for this exported model; user can make it much larger/smaller.
  const model = gltf.scene.clone(); // clone so we don't mutate the cached original across re-renders/stats
  tagModelParts(model, team);
  // Team model normalization (center, ground, orientation) so every car presents identically
  normalizeOrientationAndCenter(model, team);
  modelRef.current = model;
  // Custom positioning offset for this team (e.g. Mercedes W14 may need origin tweaks).
  // Applied *only here on the final rendered model* (framing temp stays neutral) so you can visually
  // slide/offset the car body to match the exact placement/height/fore-aft/lateral position of the other models
  // inside the (otherwise identical) framed view. Edit the value below and reload to fine-tune.
  // The camera target and auto-framing will remain centered on the model's geometric bbox (after rot+ground+center).
  const posOffset = TEAM_POSITION_OFFSETS[team] || { x: 0, y: 0, z: 0 };
  model.position.x += (posOffset.x || 0);
  model.position.y += (posOffset.y || 0);
  model.position.z += (posOffset.z || 0);
  const scaleMult = TEAM_SCALE_MULT[team] || 1;
  const baseScale = BASE_MODEL_SCALE * scaleMult;
  model.scale.setScalar(baseScale * (viewZoom || 1));
  // position + rotation already handled by normalize + the offset above — do not reset

  return (
    <primitive
      object={model}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  );
}

/** HDRI racetrack environment (background + IBL lighting + reflections for the car). Switches with weather prop. */
function WeatherEnvironment({ weather = 'clear' }) {
  const hdriUrl = USER_HDRI_OVERRIDES[weather] || WEATHER_HDRI[weather];
  const texture = useTexture(hdriUrl);

  useEffect(() => {
    if (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 16;
      texture.needsUpdate = true;
    }
  }, [texture]);

  const p = WEATHER_PRESETS[weather] || WEATHER_PRESETS.clear;

  // For rainy ONLY: use a solid dark color for the visual background sphere (no HDRI image as BG, to avoid the bright pano).
  // But KEEP the HDRI texture loaded and passed to Environment for reflections/lighting on the car
  // (so car still gets rainy pano reflections to look wet/shiny).
  // Extra lights + high env/ambient make the car much brighter.
  // For other weathers: use the (user's) HDRI image as the pano BG with tint.
  // (No visible floor — only invisible shadow receiver below.)
  return (
    <>
      <Environment map={texture} background={false} intensity={p.envIntensity} />

      {/* Background sphere - for rainy: solid dark (no HDRI texture); else: user's HDRI pano with tint */}
      <mesh>
        <sphereGeometry args={[450]} />
        {weather === 'rainy' ? (
          <meshBasicMaterial
            color={p.rainyBgColor || '#0f1a28'}
            side={THREE.BackSide}
            fog={false}
            depthWrite={false}
          />
        ) : (
          <meshBasicMaterial
            map={texture}
            side={THREE.BackSide}
            color={p.bgTint}
            fog={false}
            depthWrite={false}
          />
        )}
      </mesh>
    </>
  );
}

/** Dynamic lights + accent tuned per weather so the car is always well lit and visible.
 * Extra car-focused lights (key, fill, rims) for shine, specular pop, and glimmer on the PBR model.
 * These don't affect the background sphere (which uses unlit MeshBasicMaterial - for rainy it's a solid dark color #0f1a28, no HDRI image as visual BG).
 */
function WeatherLights({ weather = 'clear' }) {
  const p = WEATHER_PRESETS[weather] || WEATHER_PRESETS.clear;

  // Boost extra lights more on dark weathers (rainy/cloudy) to prevent car looking too dark vs the pano
  const extraMult = weather === 'rainy' ? 4.0 : (weather === 'overcast' ? 1.7 : 1.0);

  return (
    <>
      <ambientLight intensity={p.ambient.intensity} color={p.ambient.color} />
      <directionalLight
        position={p.sun.position}
        intensity={p.sun.intensity}
        color={p.sun.color}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Colored accent/rim light helps the car "pop" especially in overcast/rainy conditions */}
      <pointLight position={[-4, 3.5, -5.5]} intensity={p.accent.intensity} color={p.accent.color} />

      {/* Additional "car-focused" lights (effectively car-only: the HDRI bg sphere is MeshBasicMaterial so ignores all lights).
          These add strong specular highlights, edge rims and glints ("shine and glimmer") on the PBR car paint, carbon, glass and metals.
          Positions relative to centered car. Easy to tweak the numbers below for different angles/moods. */}
      {/* Front key light - strong frontal shine on nose/front wing */}
      <pointLight position={[2.5, 4, 9]} intensity={3.5 * extraMult} color="#ffffff" castShadow={false} />
      {/* Top key / overhead - roof, halo and upper body highlights */}
      <pointLight position={[0, 9, 1]} intensity={2.8 * extraMult} color="#f8f8ff" castShadow={false} />
      {/* Side fill / warm rim - side form and nice paint reflections */}
      <pointLight position={[-7, 2.5, 4]} intensity={2.0 * extraMult} color="#ffeedd" castShadow={false} />
      {/* Rear / back rim - tail, rear wing edges and taillight pop/glimmer */}
      <pointLight position={[1, 3, -8]} intensity={2.5 * extraMult} color="#e0f0ff" castShadow={false} />
      {/* Low side accent - wheel arches, underbody and extra lower specular glints */}
      <pointLight position={[5, 1, -2]} intensity={1.8 * extraMult} color="#ffffff" castShadow={false} />
    </>
  );
}

/** Sets scene fog from the weather preset (distance fade into the HDRI horizon). */
function WeatherFog({ weather = 'clear' }) {
  const p = WEATHER_PRESETS[weather] || WEATHER_PRESETS.clear;
  return <fog attach="fog" args={[p.fog.color, p.fog.near, p.fog.far]} />;
}

export function CarCustomizer({ stats, onStatsChange, driverName = 'Your Car', driverColor = '#3671C6', team = 'McLaren', weather = 'clear', trackName = 'Track', onClose, onApply }) {
  const [selectedPart, setSelectedPart] = useState(null);
  const [localStats, setLocalStats] = useState(stats);

  // Separate view control so user can zoom/scale the entire car in the viewport
  // without affecting the actual carStats (compound/wear/aero/power) that feed the sim + ML.
  const [viewZoom, setViewZoom] = useState(1); // start a bit closer by default for the detailed McLaren model
  const [showroomMode, setShowroomMode] = useState(true); //spinny thing
  const [desiredPreset, setDesiredPreset] = useState(null);

  // Reset preset when team changes so next view uses the new model's framing
  useEffect(() => {
    setDesiredPreset(null);
  }, [team]);

  // Ref for OrbitControls so we can programmatically control camera for auto-framing and view presets
  const orbitControlsRef = useRef();

  // Bump this to force child to re-run auto-framing (e.g. on Reset)
  const [frameKey, setFrameKey] = useState(0);

  // Force clear highlights when clicking outside the model
  const [forceClearHighlights, setForceClearHighlights] = useState(0);

  // Preset view controls (motorsport showroom style)
  const setCameraPreset = (preset) => {
    if (!orbitControlsRef.current) return;

    // Set desired so child framing logic picks correct dir, but still uses *perfect* distance
    // computed from this model's bbox + RedBull's 4x scale + current viewZoom (fixes zoomed-out on side/top/34 for RedBull).
    setDesiredPreset(preset);

    const controls = orbitControlsRef.current;
    const cam = controls.object;
    const target = controls.target.clone();

    let offset;
    let newZoom = viewZoom;

    switch (preset) {
      case 'reset':
	    setShowroomMode(true);
        newZoom = 1.6;
		setFrameKey(k => k + 1);
        setViewZoom(newZoom); // force the child RealF1Model to re-run its auto-framing (bounding box + 3/4 view)
        break;
      case 'front34':
        // Professional front 3/4 elevated (the auto one)
		setShowroomMode(false);
        offset = new THREE.Vector3(1.15, 0.55, 1.65).normalize().multiplyScalar(8);
        newZoom = 1.0;
        setViewZoom(newZoom);
        setFrameKey(k => k + 1); // ensure bbox distance recalc for scaled models like RedBull
        break;
      case 'side':
        // Clean side profile to showcase length and aero
		setShowroomMode(false);
        offset = new THREE.Vector3(100, 10, 0.8).normalize().multiplyScalar(8);
        newZoom = 1.0;
        setViewZoom(newZoom);
        setFrameKey(k => k + 1);
        break;
      case 'top':
        // Top down for strategy overview feel
		setShowroomMode(false);
        offset = new THREE.Vector3(0, 100, 0).normalize().multiplyScalar(8);
        newZoom = 1.0;
        setViewZoom(newZoom);
        setFrameKey(k => k + 1);
        break;
      default:
        return;
    }

    // We still do immediate position for responsiveness; the frameKey bump + desiredPreset will
    // make the child's useEffect correct it with proper distance on next render.
    const newPos = target.clone().add(offset);
    cam.position.copy(newPos);
    controls.target.copy(target);
    controls.update();
  };

  const updateStat = (key, value) => {
    const newStats = { ...localStats, [key]: value };
    setLocalStats(newStats);
    onStatsChange?.(newStats);
  };

  const handlePartClick = (part) => {
    setSelectedPart(part);
    if (part.id === 'tyres') {
      // Cycle compound on click
      const current = localStats.compound || 'medium';
      const next = COMPOUNDS[(COMPOUNDS.indexOf(current) + 1) % 3];
      updateStat('compound', next);
    }
  };

  const handleSlider = (key, e) => {
    updateStat(key, parseFloat(e.target.value));
  };

  // Realistic F1 team strategy for this specific driver on this track/weather
  const applyTeamRecommendation = () => {
    let recCompound = 'medium';
    let recWear = 5;
    let recAero = 6;
    let recPower = 6;

    if (weather === 'rainy') {
      recCompound = 'intermediate';
      recWear = 8; // cautious
      recAero = 8; // more downforce for grip
      recPower = 5; // conservative to manage
    } else if (weather === 'overcast') {
      recCompound = 'medium';
      recAero = 7;
      recPower = 7;
    } else {
      // clear - depends on track, but for demo aggressive for pace
      recCompound = trackName.includes('Monaco') ? 'soft' : 'medium';
      recAero = trackName.includes('Monaco') ? 4 : 5; // less aero on tight tracks?
      recPower = 8;
    }

    const recommended = {
      compound: recCompound,
      initialTyreWear: recWear,
      aeroLevel: recAero,
      powerLevel: recPower,
    };
    setLocalStats(recommended);
    onStatsChange?.(recommended);
  };

  const effectiveModelUrl = getModelUrlForTeam(team);

  return (
    <div className="rounded-2xl border border-f1-border bg-f1-panel p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display text-xl text-white">Team Strategy for {driverName}'s Car</div>
          <div className="text-xs text-gray-400">As the race engineer for this driver, make realistic F1 team choices (tyres, setup for weather/track). Click car parts or briefing. Affects sim + ML for accurate, driver-specific results.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-f1-border rounded hover:bg-white/5">Close</button>
          <button onClick={() => onApply(localStats)} className="px-4 py-2 text-sm bg-f1-accent text-black rounded font-medium">Apply Stats</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 3D Visualizer - main "driving game" interaction area */}
        <div className="lg:col-span-9 rounded-xl overflow-hidden border border-f1-border bg-[#050508]" style={{ height: 550 }}>
          {/* Professional viewer toolbar (motorsport showroom style) */}
          <div className="flex items-center justify-between bg-[#050508]/80 px-3 py-1 text-[10px] font-mono border-b border-f1-border/50">
            <div className="text-f1-accent/80 flex items-center gap-2">
              3D MODEL VIEWER
              <span className="text-[9px] px-1.5 py-0 rounded bg-white/5 text-gray-400 border border-f1-border/40">
                { (WEATHER_PRESETS[weather] || WEATHER_PRESETS.clear).name.toUpperCase() }
                {(() => {
                  const currentHdri = USER_HDRI_OVERRIDES[weather] || WEATHER_HDRI[weather];
                  return (currentHdri && currentHdri.includes('/backgrounds/')) ? ' (custom)' : '';
                })()}
              </span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setCameraPreset('reset')} className="px-2 py-0.5 border border-f1-border/60 hover:bg-white/5 rounded text-[9px]">RESET</button>
              <button onClick={() => setCameraPreset('front34')} className="px-2 py-0.5 border border-f1-border/60 hover:bg-white/5 rounded text-[9px]">FRONT 3/4</button>
              <button onClick={() => setCameraPreset('side')} className="px-2 py-0.5 border border-f1-border/60 hover:bg-white/5 rounded text-[9px]">SIDE</button>
              <button onClick={() => setCameraPreset('top')} className="px-2 py-0.5 border border-f1-border/60 hover:bg-white/5 rounded text-[9px]">TOP</button>
            </div>
          </div>
          <Canvas
            camera={{ position: [0, 1.6, 4.8], fov: 50 }}
            style={{ background: '#222222' }}
            shadows
            onPointerMissed={() => {
              setSelectedPart(null);
              setForceClearHighlights(prev => prev + 1);
            }}
          >
            {/* Fallback color (the HDRI background sphere above is the main pano; this is only if texture fails) */}
            <color attach="background" args={['#222222']} />
            <WeatherFog weather={weather} />

            {/* The ultra high-res HDRI racetrack for this weather condition.
                Provides the 360° background panorama AND realistic environment lighting + reflections on the car. */}
            <Suspense fallback={null}>
              <WeatherEnvironment weather={weather} />
            </Suspense>

            <WeatherLights weather={weather} />

            {/* Invisible shadow receiver (no visible floor) so the car's shadows still ground it against the HDRI pano. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow raycast={() => null}>
              <planeGeometry args={[100, 100]} />
              <shadowMaterial transparent opacity={0} />
            </mesh>

            {/* Real detailed team-specific F1 car (or fallback) with live stat-driven tweaks.
                The HDRI + weather lights ensure it is properly illuminated and visible in every condition. */}
            <Suspense fallback={
              <Html center style={{ color: '#00d4aa', fontSize: '12px', fontFamily: 'monospace' }}>
                {`Loading detailed ${team} F1 car...`}<br />Large model (high poly + PBR textures)
              </Html>
            }>
              <RealF1Model
                stats={localStats}
                onPartClick={handlePartClick}
                selectedPart={selectedPart}
                teamColor={driverColor}
                team={team}
                modelUrl={effectiveModelUrl}
                viewZoom={viewZoom}
                orbitControlsRef={orbitControlsRef}
                frameKey={frameKey}
                forceClearHighlights={forceClearHighlights}
                desiredPreset={desiredPreset}
              />
            </Suspense>

            <OrbitControls
              ref={orbitControlsRef}
              enablePan={false}
              enableZoom={true}
              enableRotate={true}
              enableDamping={true}
              dampingFactor={0.1}
			  autoRotate={showroomMode} //autorotate
			  autoRotateSpeed={0.3} //rotate
              minDistance={0.15}          // very close inspection allowed
              maxDistance={12}
              zoomSpeed={1.4}
              rotateSpeed={0.75}
              // Vertical orbit limits (polar): prevent flipping upside down or going under the car
              minPolarAngle={0.15}
              maxPolarAngle={Math.PI * 0.92}
              target={[0, 0.55, 0]}
            />
          </Canvas>
        </div>

        {/* Controls / Stats - "click what you want to change" */}
        <div className="lg:col-span-3 space-y-4 text-sm">
          <div className="rounded-lg border border-f1-border bg-black/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-mono text-xs uppercase text-f1-accent">
                  Selected: {selectedPart?.label || 'Click a part on the car'}
                </div>
                {selectedPart && (
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {PART_HINTS[selectedPart.id] || 'Inspect this area on the 3D model.'}
                  </div>
                )}
              </div>
              <button 
                onClick={() => setViewZoom(1.0)} 
                className="text-[10px] px-2 py-0.5 border border-f1-border rounded hover:bg-white/5"
                title="Reset magnification to default"
              >
                Reset Zoom
              </button>
            </div>
            
            {/* Tyre / Compound — highlighted when wheels selected */}
            <div className={`mb-3 rounded-md p-2 transition-colors ${selectedPart?.id === 'tyres' ? 'bg-f1-accent/10 ring-1 ring-f1-accent/40' : ''}`}>
              <div className="flex justify-between mb-1">
                <span>Tyre Compound</span>
                <span className="font-mono text-f1-accent">{localStats.compound?.toUpperCase()}</span>
              </div>
              <div className="flex gap-1">
                {COMPOUNDS.map(c => (
                  <button 
                    key={c} 
                    onClick={() => updateStat('compound', c)}
                    className={`flex-1 py-1 text-xs rounded border ${localStats.compound === c ? 'bg-f1-accent text-black border-f1-accent' : 'border-f1-border hover:bg-white/5'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">Click tyre on 3D car to cycle. Affects ML CompoundCode + sim deg.</div>
            </div>

            {/* Initial Tyre Wear */}
            <div className={`mb-3 rounded-md p-2 transition-colors ${selectedPart?.id === 'tyres' ? 'bg-f1-accent/10 ring-1 ring-f1-accent/40' : ''}`}>
              <div className="flex justify-between mb-1">
                <span>Initial Tyre Wear</span>
                <span className="font-mono">{localStats.initialTyreWear || 0}%</span>
              </div>
              <input 
                type="range" min="0" max="25" step="1" 
                value={localStats.initialTyreWear || 0}
                onChange={(e) => updateStat('initialTyreWear', parseInt(e.target.value))}
                className="w-full accent-f1-accent"
              />
              <div className="text-[10px] text-gray-500">Higher start wear = more aggressive start, affects early pace & ML TyreLife.</div>
            </div>

            {/* Aero Level */}
            <div className={`mb-3 rounded-md p-2 transition-colors ${selectedPart?.id === 'aero' ? 'bg-f1-accent/10 ring-1 ring-f1-accent/40' : ''}`}>
              <div className="flex justify-between mb-1">
                <span>Aero / Downforce Level</span>
                <span className="font-mono">{localStats.aeroLevel || 5}/10</span>
              </div>
              <input 
                type="range" min="1" max="10" step="1" 
                value={localStats.aeroLevel || 5}
                onChange={(e) => updateStat('aeroLevel', parseInt(e.target.value))}
                className="w-full accent-f1-accent"
              />
              <div className="text-[10px] text-gray-500">Higher = more stable (less deg in sim), lower top speed. Visual: rear wing angle changes.</div>
            </div>

            {/* Power Level */}
            <div className={`rounded-md p-2 transition-colors ${selectedPart?.id === 'power' ? 'bg-f1-accent/10 ring-1 ring-f1-accent/40' : ''}`}>
              <div className="flex justify-between mb-1">
                <span>Engine Power Level</span>
                <span className="font-mono">{localStats.powerLevel || 5}/10</span>
              </div>
              <input 
                type="range" min="1" max="10" step="1" 
                value={localStats.powerLevel || 5}
                onChange={(e) => updateStat('powerLevel', parseInt(e.target.value))}
                className="w-full accent-f1-accent"
              />
              <div className="text-[10px] text-gray-500">Higher = faster in straight (sim speedMult), higher fuel use. Visual: engine glows more.</div>
            </div>

            {/* View Zoom / Magnify control - purely visual, does NOT affect sim or ML stats */}
            <div className="pt-2 border-t border-f1-border/50 mt-2">
              <div className="flex justify-between mb-1">
                <span>View Zoom (magnify car)</span>
                <span className="font-mono">{viewZoom.toFixed(1)}x</span>
              </div>
              <input 
                type="range" min="0.35" max="3.5" step="0.05" 
                value={viewZoom}
                onChange={(e) => setViewZoom(parseFloat(e.target.value))}
                className="w-full accent-f1-accent"
              />
              <div className="text-[10px] text-gray-500">Makes the car larger/smaller in this preview only. Use mouse wheel or this slider to get close and inspect details. Orbit by dragging.</div>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 border-t border-f1-border pt-2">
            These custom stats directly feed the simulation physics for your driver AND the ML LapDelta predictor (via compound, tyreLife, speed biases). Results in Post-Race will reflect your choices accurately (final wear, speeds, deltas).
          </div>

          <button 
            onClick={applyTeamRecommendation}
            className="w-full mt-2 py-2 text-xs border border-f1-accent text-f1-accent rounded hover:bg-f1-accent/10"
          >
            Get Team Strategy Briefing for {driverName} ({weather} on {trackName})
          </button>
        </div>
      </div>

      <div className="mt-4 text-center text-xs text-gray-500">
        <strong>Professional viewer controls (top of 3D area):</strong> RESET • FRONT 3/4 • SIDE • TOP for instant showroom-style views.
        <br />Drag to orbit • Mouse wheel or "View Zoom" slider (right) to magnify/close in • Low min-distance allows extreme close-ups. Auto-frames on load using bounding box for any model.
      </div>
    </div>
  );
}
