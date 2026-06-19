import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Html } from '@react-three/drei';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Interactive 3D F1 Car visualizer / customizer (STRATBOT).
 * ENHANCED: Detailed procedural F1 geometry (front/rear wings multi-element, halo, sidepods,
 * diffuser, proper proportions, suspension) + PBR MeshStandardMaterial.
 * Optional GLTF path: place modern F1 .glb (e.g. from Meshy.ai free CC0 "F1 low poly" or
 * exported 2022 Pixel Lab model) at /public/models/f1-car.glb and set MODEL_URL below.
 * Stats drive live updates (tyre wear/compound scale+color, wing angle from aero, engine glow from power, body color from team).
 * Clickable parts + sliders. Affects sim physics + ML LapDelta.
 * Designed for FYP demos / presentations: realistic from all angles, premium lighting.
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

// Team to model folder mapping (unpacked glTF preferred for customizations)
// All models copied to frontend/public/models/<key>/
const TEAM_MODEL_MAP = {
  'McLaren': 'f1_2025_mclaren_mcl39',
  'Red Bull': 'f1-2025_redbull_rb21',
  'Aston Martin': 'aston_martin_aramco_amr25',
  'Mercedes': 'f1_mercedes_w13_concept',
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

// Per-team rotation (radians) to normalize orientation so nose faces consistent direction (typically -Z for front-3/4 view with current dir vector), +Y up.
const TEAM_ROTATIONS = {
  'McLaren': { x: 0, y: 0, z: 0 },
  'Red Bull': { x: 0, y: 0, z: 0 }, // often exported facing opposite
  'Aston Martin': { x: 0, y: 0, z: 0 },
  'Mercedes': { x: 0, y: Math.PI, z: 0 },
  'Ferrari': { x: 0, y: 0, z: 0 },
  'Alpine': { x: 0, y: 0, z: 0 },
};

// Fine-tune overall visual scale if bbox-based framing alone doesn't make cars feel identical in presence (rarely needed).
const TEAM_SCALE_MULT = {
  'McLaren': 1.0,
  'Red Bull': 4.0,
  'Aston Martin': 1.0,
  'Mercedes': 0.1,
  'Ferrari': 1.0,
  'Alpine': 1.0,
};

// Per-team additional position offset (applied AFTER bbox centering + ground alignment, only to rendered model).
// Use this to fine-tune the visual placement of the car body (slide it left/right/forward/up so it "sits" in the same spot in the frame as other teams).
// Separate from TEAM_TARGET_CENTER_OFFSETS (which controls the rotation pivot without moving the geometry).
// Edit Mercedes and click RESET in viewer to test.
const TEAM_POSITION_OFFSETS = {
  'McLaren': { x: 0, y: 0, z: 0 },
  'Red Bull': { x: 0, y: 0, z: 0 },
  'Aston Martin': { x: 0, y: 0, z: 0 },
  'Mercedes': { x: -50, y: 30, z: -90},  // <-- fine-tune this for Mercedes origin offset
  'Ferrari': { x: 0, y: 0, z: 0 },
  'Alpine': { x: 0, y: 0, z: 0 },
};

// Separate per-team adjustment for the *orbit target / camera framing center* (the point around which the view rotates).
// This shifts the OrbitControls target and the center used for camera positioning in auto-framing.
// It does NOT move the model itself (use TEAM_POSITION_OFFSETS for that).
// Ideal for making the car "rotate along its axis" the same way as other models — e.g. if Mercedes' source origin
// makes the geometric center not align with the visual/rotation center that McLaren/Red Bull use.
// Edit the Mercedes values, then click RESET (or change team and back) in the 3D viewer to test. Small increments recommended.
// Units are post-normalization (after rot + bbox center + ground).
const TEAM_TARGET_CENTER_OFFSETS = {
  'McLaren': { x: 0, y: 0, z: 0 },
  'Red Bull': { x: 0, y: 0, z: 0 },
  'Aston Martin': { x: 0, y: 0, z: 0 },
  'Mercedes': { x: 0, y: 0, z: 0 },  // <-- main knob for making rotation feel the same as other models
  'Ferrari': { x: 0, y: 0, z: 0 },
  'Alpine': { x: 0, y: 0, z: 0 },
};

// Static summary for validation (see console on first customizer load)
// Note: values below are the live ones from the *consts* above (user can edit TEAM_* maps for fine-tuning).
const MODEL_INTEGRATION_SUMMARY = {
  'McLaren': { file: 'f1_2025_mclaren_mcl39/scene.gltf', adjustments: `rot=${JSON.stringify(TEAM_ROTATIONS['McLaren'])}, scaleMult=${TEAM_SCALE_MULT['McLaren']}, posOffset=${JSON.stringify(TEAM_POSITION_OFFSETS['McLaren'])}, targetCenterAdj=${JSON.stringify(TEAM_TARGET_CENTER_OFFSETS['McLaren'])}, bbox-center+ground` },
  'Red Bull': { file: 'f1-2025_redbull_rb21/scene.gltf', adjustments: `rot=${JSON.stringify(TEAM_ROTATIONS['Red Bull'])}, scaleMult=${TEAM_SCALE_MULT['Red Bull']}, posOffset=${JSON.stringify(TEAM_POSITION_OFFSETS['Red Bull'])}, targetCenterAdj=${JSON.stringify(TEAM_TARGET_CENTER_OFFSETS['Red Bull'])}, bbox-center+ground (user-tuned scale/rot)` },
  'Aston Martin': { file: 'aston_martin_aramco_amr25/scene.gltf', adjustments: `rot=${JSON.stringify(TEAM_ROTATIONS['Aston Martin'])}, scaleMult=${TEAM_SCALE_MULT['Aston Martin']}, posOffset=${JSON.stringify(TEAM_POSITION_OFFSETS['Aston Martin'])}, targetCenterAdj=${JSON.stringify(TEAM_TARGET_CENTER_OFFSETS['Aston Martin'])}, bbox-center+ground` },
  'Mercedes': { file: 'f1_mercedes_w13_concept/scene.gltf', adjustments: `rot=${JSON.stringify(TEAM_ROTATIONS['Mercedes'])}, scaleMult=${TEAM_SCALE_MULT['Mercedes']}, posOffset=${JSON.stringify(TEAM_POSITION_OFFSETS['Mercedes'])}, targetCenterAdj=${JSON.stringify(TEAM_TARGET_CENTER_OFFSETS['Mercedes'])}, bbox-center+ground (use targetCenterAdj to tune rotation pivot/axis to match others; posOffset to align body placement)` },
  'Ferrari': { file: 'ferrari_sf-25/scene.gltf', adjustments: `rot=${JSON.stringify(TEAM_ROTATIONS['Ferrari'])}, scaleMult=${TEAM_SCALE_MULT['Ferrari']}, posOffset=${JSON.stringify(TEAM_POSITION_OFFSETS['Ferrari'])}, targetCenterAdj=${JSON.stringify(TEAM_TARGET_CENTER_OFFSETS['Ferrari'])}, bbox-center+ground` },
  'Alpine': { file: '2025_alpine_a525/scene.gltf', adjustments: `rot=${JSON.stringify(TEAM_ROTATIONS['Alpine'])}, scaleMult=${TEAM_SCALE_MULT['Alpine']}, posOffset=${JSON.stringify(TEAM_POSITION_OFFSETS['Alpine'])}, targetCenterAdj=${JSON.stringify(TEAM_TARGET_CENTER_OFFSETS['Alpine'])}, bbox-center+ground` },
};

/** Normalize a model's orientation, center, and ground plane so all team cars present identically (automatic part).
 *  TEAM_POSITION_OFFSETS (model body placement) and TEAM_TARGET_CENTER_OFFSETS (orbit pivot/rotation axis) 
 *  are applied after this for per-team fine tuning. Target center affects framing + controls.target for rotation feel.
 */
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

  if (n.includes('front_tire')) return { id: 'tyres', label: 'Front Tyres' };
  if (n.includes('rear_tire')) return { id: 'tyres', label: 'Rear Tyres' };
  if (n.includes('wheel_rim') || n.includes('wheel_nut') || n.includes('wheel_screw') || n.includes('wheel_cover') || n.includes('tire')) {
    return { id: 'tyres', label: 'Wheels & Tyres' };
  }
  if (n.includes('front_wing') || n.includes('frontspoiler') || n.includes('frontflap') || n.includes('fw_') || n.includes('fw')) return { id: 'aero', label: 'Front Wing' };
  if (n.includes('rear_wing') || n.includes('rearspoiler') || n.includes('rearflap')) return { id: 'aero', label: 'Rear Wing' };
  if (n.includes('drs') || n.includes('windlet')) return { id: 'aero', label: 'Aerodynamics' };
  if (n.includes('exhaust') || n.includes('exthaust') || n.includes('rearlight')) return { id: 'power', label: 'Engine / Exhaust' };
  if (n.includes('suspension') || n.includes('carbon_suspension')) return { id: 'suspension', label: 'Suspension' };
  if (n.includes('halo')) return { id: 'halo', label: 'Halo' };
  if (n.includes('headrest') || n.includes('HEADREST')) return { id: 'cockpit', label: 'Cockpit' };
  if (n.includes('mirror')) return { id: 'mirrors', label: 'Mirrors' };
  if (n.includes('main_body') || n.includes('cam_tbone') || n.includes('Body_Main') || n.includes('paints')) return { id: 'body', label: 'Chassis / Body' };

  return null;
}

/** Meshes are named Object_N — walk parents + materials to find the real part */
function resolvePartFromObject(obj) {
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
  }

  return { id: 'unknown', label: 'Unknown Part' };
}

/** Finer group for hover/select — e.g. front axle vs rear axle */
function resolvePartGroup(obj) {
  if (obj?.userData?.partGroup) return obj.userData.partGroup;

  let current = obj;
  while (current) {
    const n = (current.name || '').toLowerCase();
    if (n.includes('front_tire')) return 'front_tire';
    if (n.includes('rear_tire')) return 'rear_tire';
    if (n.includes('front_wing') || n.includes('frontspoiler') || n.includes('frontflap')) return 'front_wing';
    if (n.includes('rear_wing') || n.includes('rearspoiler')) return 'rear_wing';
    if (n.includes('exhaust') || n.includes('exthaust')) return 'exhaust';
    if (n.includes('suspension')) return 'suspension';
    if (n.includes('headrest')) return 'cockpit';
    if (n.includes('main_body')) return 'body';
    current = current.parent;
  }

  return resolvePartFromObject(obj).id;
}

/** Stamp every mesh once so clicks/hover don't re-walk the hierarchy */
function tagModelParts(scene) {
  if (!scene) return;
  scene.traverse((child) => {
    if (!child.isMesh) return;
    const part = resolvePartFromObject(child);
    child.userData.partId = part.id;
    child.userData.partLabel = part.label;
    child.userData.partGroup = resolvePartGroup(child);
  });
}

function meshPartId(mesh) {
  return mesh?.userData?.partId ?? resolvePartFromObject(mesh).id;
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

// === GLTF OPTION (preferred for max realism when asset present) ===
// 1. Download a suitable low-poly / optimized F1 GLB (recommended: Meshy.ai free CC0 F1 models e.g. "Red Bull Racing Formula 1 Car" or "2026 Formula one car" in low-poly style; or export/convert the free Pixel Lab 2022 F1 Monopost).
// 2. Place at frontend/public/models/f1-car.glb (create models/ dir).
// 3. (Optional for smaller size/perf) Run: npx gltf-transform optimize public/models/f1-car.glb public/models/f1-car.glb --compress draco
// 4. Set MODEL_URL below. Code falls back to enhanced procedural if missing or disabled.
// Visual target: full wings (multi-element), halo, sidepods, diffuser, correct proportions, PBR textures from asset.
// Path to the real high-detail 2025 McLaren MCL39 model (glTF + external PBR textures).
// This was the best choice from the added "3d models" folder:
// - scene.gltf + scene.bin + textures/ (separate textures) gives maximum flexibility for dynamic color tinting, part scaling (wear), wing rotation (aero), emissive glow (power), and future livery swaps.
// - The .glb (66MB) is the bundled version but much larger and less editable for textures.
// - .usdz is for AR only, not suitable here.
// Separate glTF + textures is superior here for the customizer needs (we can tweak colors/textures/materials in code easily by traversing named parts like "main_body", "front_wing", "halo", "front_tire", "rear_tire", "exhaust" etc. and overriding .color / .scale / .rotation / emissive on the materials or objects).
// We could achieve similar overrides with the .glb (by cloning materials and setting color/emissive/scale/rotation on traversed children), but the unpacked version is the source of truth, easier to author/edit textures externally, and matches the "with seperate textures" the user mentioned.
// Note: This model is detailed (~high poly + large textures). For production web use, run optimization: npx gltf-transform optimize ... --draco etc. and move to public/models/.
// The folder was copied to public/models/f1_2025_mclaren_mcl39/ during setup.
// Default (legacy) - now computed dynamically via getModelUrlForTeam(team) based on selected driver/team
const DEFAULT_MCLAREN_MODEL_URL = '/models/f1_2025_mclaren_mcl39/scene.gltf';

// Base scale for the GLTF model. Increased by 70% (from 0.0095 to 0.01615) so the car appears substantially larger
// by default in the viewer (addresses "too far away" / small model feedback). The auto-framing logic accounts
// for this, but because of fixed model.position pivot + source center, the net visual effect is a bigger car
// filling more of the view.
const BASE_MODEL_SCALE = 1.01615; // 0.0095 * 1.7 (70% increase for substantially larger default model appearance)

// Real high-detail McLaren 2025 MCL39 loader (using the glTF + separate textures from the added "3d models" folder).
// This is the BEST choice:
// - scene.gltf + scene.bin + textures/ (separate PBR textures per part) is superior for the CarCustomizer use case.
// - We get named parts/materials (main_body, front_wing, rear_wing, halo, front_tire, rear_tire, exhaust/exthaust, suspensions, wheel_rim etc. from the glTF JSON).
// - Full control to dynamically:
//   * Tint body color (teamColor) by setting material.color on main_body / related parts (preserves the detailed baseColor + normal + metallicRoughness maps).
//   * Tint + scale tyres (compound color + wearScale) on front_tire / rear_tire meshes.
//   * Rotate front/rear wing groups/meshes for aeroLevel (the wing nodes respond to .rotation.x).
//   * Add emissive glow on exhaust parts for powerLevel.
// - Separate textures make it easy to author/swap liveries externally or hot-replace maps in future.
// - We can do *most* of the same overrides with the .glb (traverse + material clone + set color/scale/rotation/emissive), but the unpacked glTF gives cleaner part identification, easier external texture edits, and no re-bundling step.
// - The .glb (66MB at root) is the all-in-one but bloated and less flexible for textures.
// - .usdz is Apple-only AR format – ignore for this.
// Recommendation implemented: Use the glTF with separate textures.

function RealF1Model({ stats, onPartClick, selectedPart, teamColor = '#3671C6', team = 'McLaren', modelUrl, viewZoom = 1, orbitControlsRef, frameKey = 0, forceClearHighlights = 0 }) {
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
        console.log('%c[CarCustomizer] === MODEL INTEGRATION VALIDATION SUMMARY ===', 'color: #0af; font-weight: bold');
        console.table(MODEL_INTEGRATION_SUMMARY);
        console.log('All teams use same BASE_MODEL_SCALE + dynamic bbox framing + normalize (center/ground/orient + TEAM_POSITION_OFFSETS for fine-tune) + identical OrbitControls + camera presets.');
        console.log('Issues discovered: (1) Part names for classify/hover/click are McLaren-centric so may be incomplete on other models (e.g. tyres/wings may still tag via broad keywords). (2) Some rots/scales/offsets are best-guess and may need visual tweak via the TEAM_* consts. (3) Livery tint only on McLaren; others use baked team textures (correct). (4) No models were missing after copy.');
        console.log('To fine-tune Mercedes (or others):');
        console.log('  - TEAM_POSITION_OFFSETS["Mercedes"] moves the car body (placement in view).');
        console.log('  - TEAM_TARGET_CENTER_OFFSETS["Mercedes"] shifts the orbit target / rotation center (the "axis" the car rotates around during mouse drag / presets). This is likely what you need for "rotate along its axis the same".');
        console.log('Edit either (or both), SAVE, then click the RESET button in the 3D toolbar (or switch driver and back) to re-apply framing with new values. The target one keeps the camera math neutral while choosing a better pivot point on the car.');
        console.log('Ground plane ≈ y=-0.05. Use external glTF viewer (e.g. https://gltf-viewer.donmccurdy.com/) or Blender on the Mercedes scene.gltf to inspect its RootNode / Body_low transform and estimate offsets from center.');
      }
      if (team === 'Mercedes') {
        // Extra debug for Mercedes: log the centers used for this load so you can see what the offsets are doing.
        console.log('[Mercedes debug] native bbox center (pre any adj):', box.getCenter(new THREE.Vector3()));
        console.log('[Mercedes debug] effective target center after TEAM_TARGET_CENTER_OFFSETS:', /* will be logged by framing too */);

        // === Automated in-project inspection (as requested) ===
        // 1. Detailed bbox for deciding origin (you believe it's at driver seat)
        const nativeBox = new THREE.Box3().setFromObject(gltf.scene);
        console.log('[Mercedes origin debug - bbox] min:', nativeBox.min, 'max:', nativeBox.max, 'center:', nativeBox.getCenter(new THREE.Vector3()), 'size:', nativeBox.getSize(new THREE.Vector3()));

        // 2. Find nodes that might be "driver seat" / interior to see their world position relative to center
        console.log('[Mercedes node positions - look for seat/driver/interior]');
        gltf.scene.traverse((child) => {
          const n = (child.name || '').toLowerCase();
          if (n.includes('seat') || n.includes('driver') || n.includes('interior') || n.includes('steering') || n.includes('cockpit') || n.includes('body')) {
            const wp = new THREE.Vector3();
            child.getWorldPosition(wp);
            console.log(`  ${child.name} -> world pos (relative to model origin):`, wp);
          }
        });

        // 3. "Open the glTF in text editor" equivalent - fetch and print root node transforms
        fetch(modelUrl)
          .then(r => r.json())
          .then(g => {
            console.log('[Mercedes glTF JSON root nodes - translations/rotations (origin info)]');
            const sceneNodeIndices = g.scenes?.[0]?.nodes || [];
            sceneNodeIndices.forEach(idx => {
              const node = g.nodes?.[idx];
              if (node) {
                console.log(`  Root node ${node.name || idx}: translation=${JSON.stringify(node.translation) || 'identity (0,0,0)'}, rotation=${JSON.stringify(node.rotation) || 'identity'}`);
              }
            });
            // Show any nodes with non-trivial translation (the offset is often baked here or in geometry)
            const interesting = (g.nodes || []).filter(n => n.translation && (n.translation.some(v => Math.abs(v) > 0.01)));
            if (interesting.length) {
              console.log('  Nodes with translations (potential origin clues):', interesting.slice(0,5).map(n => ({name: n.name, trans: n.translation})));
            }
          })
          .catch(err => console.log('glTF JSON fetch for inspection:', err.message));
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
    const part = resolvePartFromObject(e.object);
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

    // Measure using a *normalized* temp clone so bbox/center accounts for this team's orientation + ground + any per-team scale.
    // This ensures camera framing, distance, and target match McLaren experience for every team.
    const temp = gltf.scene.clone();
    normalizeOrientationAndCenter(temp, team);
    const box = new THREE.Box3().setFromObject(temp);
    let center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (team === 'Mercedes') {
      console.log('[Mercedes debug] pure normalized center (from temp bbox):', center.clone());
    }

    // Apply target center adjustment (shifts the rotation pivot / orbit center without moving the model).
    // This is the key for making "rotate along its axis" feel consistent across models.
    const targetAdj = TEAM_TARGET_CENTER_OFFSETS[team] || { x: 0, y: 0, z: 0 };
    center.x += (targetAdj.x || 0);
    center.y += (targetAdj.y || 0);
    center.z += (targetAdj.z || 0);

    if (team === 'Mercedes') {
      console.log('[Mercedes debug] effective framing center after targetAdj:', center.clone());
      console.log('[Mercedes debug] current TEAM_TARGET_CENTER_OFFSETS Mercedes:', TEAM_TARGET_CENTER_OFFSETS['Mercedes']);
      console.log('[Mercedes framing] Using this center as orbit target. Adjust TEAM_TARGET_CENTER_OFFSETS if rotation pivot feels off (e.g. around driver seat instead of chassis center).');
    }

    // Effective scale the model will have in the scene (base tuned for this export + current user zoom)
    const scaleMult = TEAM_SCALE_MULT[team] || 1;
    const renderScale = BASE_MODEL_SCALE * scaleMult * (viewZoom);
    const visualMaxDim = maxDim * renderScale;

    // Distance so the car nicely fills ~70-80% of the view (professional showroom feel, not too tight, not lost in space)
    const fov = camera.fov * (Math.PI / 200);
    const distance = (visualMaxDim / 2) / Math.tan(fov / 2) * 0.85;  // reduced factor (from 1.45) so with 70% larger BASE_MODEL_SCALE the car fills ~70% more of the view by default (tighter, more impressive presentation)

    // Preferred presentation angle: front 3/4 (shows front wing + side profile), slightly elevated
    // Vector chosen and normalized for this McLaren model orientation to give strong visual depth.
    // After per-team normalize rot, same dir works for all.
    const dir = new THREE.Vector3(1.15, 0.55, 1.65).normalize();
    const camPos = center.clone().add(dir.multiplyScalar(distance));

    // Position camera
    camera.position.copy(camPos);
    camera.lookAt(center.x, center.y, center.z); // tiny lift for elegant elevation
    camera.updateProjectionMatrix();

    // Keep OrbitControls centered on the car so orbiting always feels natural around the vehicle
    if (orbitControlsRef && orbitControlsRef.current) {
      orbitControlsRef.current.target.copy(center);
      orbitControlsRef.current.update();
    }

    framedRef.current = true;
  }, [gltf?.scene, camera, orbitControlsRef, viewZoom, frameKey, team]);

  if (!gltf?.scene) return null;

  // Center + reasonable scale for the customizer canvas (McLaren 2025 is a full-size F1 car in the source units).
  // viewZoom (passed from UI) lets the user magnify the car in the viewport independently of the actual car physics stats.
  // Base scale tuned for this exported model; user can make it much larger/smaller.
  const model = gltf.scene.clone(); // clone so we don't mutate the cached original across re-renders/stats
  tagModelParts(model);
  // Team model normalization (center, ground, orientation) so every car presents identically
  normalizeOrientationAndCenter(model, team);
  modelRef.current = model;
  // Custom positioning offset for this team (e.g. Mercedes has a different source origin/pivot from the others).
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

export function CarCustomizer({ stats, onStatsChange, driverName = 'Your Car', driverColor = '#3671C6', team = 'McLaren', weather = 'clear', trackName = 'Track', onClose, onApply }) {
  const [selectedPart, setSelectedPart] = useState(null);
  const [localStats, setLocalStats] = useState(stats);

  // Separate view control so user can zoom/scale the entire car in the viewport
  // without affecting the actual carStats (compound/wear/aero/power) that feed the sim + ML.
  const [viewZoom, setViewZoom] = useState(1); // start a bit closer by default for the detailed McLaren model
  const [showroomMode, setShowroomMode] = useState(true); //spinny thing

  // Ref for OrbitControls so we can programmatically control camera for auto-framing and view presets
  const orbitControlsRef = useRef();

  // Bump this to force child to re-run auto-framing (e.g. on Reset)
  const [frameKey, setFrameKey] = useState(0);

  // Force clear highlights when clicking outside the model
  const [forceClearHighlights, setForceClearHighlights] = useState(0);

  // Preset view controls (motorsport showroom style)
  const setCameraPreset = (preset) => {
    if (!orbitControlsRef.current) return;
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
        offset = new THREE.Vector3(1.15, 0.55, 1.65).normalize().multiplyScalar(8); // *1.7 for larger base model scale
        newZoom = 1.0;
        setViewZoom(newZoom);
        break;
      case 'side':
        // Clean side profile to showcase length and aero
		setShowroomMode(false);
        offset = new THREE.Vector3(100, 10, 0.8).normalize().multiplyScalar(8); // *1.7 for larger base model scale
        newZoom = 1.0;
        setViewZoom(newZoom);
        break;
      case 'top':
        // Top down for strategy overview feel
		setShowroomMode(false);
        offset = new THREE.Vector3(0, 100, 0).normalize().multiplyScalar(8); // *1.7 for larger base model scale
        newZoom = 1.0;
        setViewZoom(newZoom);
        break;
      default:
        return;
    }

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
          <div className="text-xs text-gray-400">As the race engineer for this driver, make realistic F1 team choices (tyres, setup for weather/track). Click car parts or briefing. Affects sim + ML for accurate, driver-specific results. Using real high-detail {team} 2025 F1 car (glTF + separate PBR textures – authentic livery + live color/scale/rotation/glow tweaks where applicable).</div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-f1-border rounded hover:bg-white/5">Close</button>
          <button onClick={() => onApply(localStats)} className="px-4 py-2 text-sm bg-f1-accent text-black rounded font-medium">Apply Stats</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 3D Visualizer - main "driving game" interaction area */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden border border-f1-border bg-black" style={{ height: 445 }}>
          {/* Professional viewer toolbar (motorsport showroom style) */}
          <div className="flex items-center justify-between bg-black/60 px-3 py-1 text-[10px] font-mono border-b border-f1-border/50">
            <div className="text-f1-accent/80">3D MODEL VIEWER</div>
            <div className="flex gap-1">
              <button onClick={() => setCameraPreset('reset')} className="px-2 py-0.5 border border-f1-border/60 hover:bg-white/5 rounded text-[9px]">RESET</button>
              <button onClick={() => setCameraPreset('front34')} className="px-2 py-0.5 border border-f1-border/60 hover:bg-white/5 rounded text-[9px]">FRONT 3/4</button>
              <button onClick={() => setCameraPreset('side')} className="px-2 py-0.5 border border-f1-border/60 hover:bg-white/5 rounded text-[9px]">SIDE</button>
              <button onClick={() => setCameraPreset('top')} className="px-2 py-0.5 border border-f1-border/60 hover:bg-white/5 rounded text-[9px]">TOP</button>
            </div>
          </div>
          <Canvas
            camera={{ position: [0, 1.6, 4.8], fov: 50 }}
            style={{ background: '#0a0a0f' }}
            shadows
            onPointerMissed={() => {
              setSelectedPart(null);
              setForceClearHighlights(prev => prev + 1);
            }}
          >
            <ambientLight intensity={1.2} />
            <directionalLight position={[6, 11, 4]} intensity={1.35} castShadow />
            <pointLight position={[-4.5, 2.8, -4.5]} intensity={0.55} color="#ffaa55" />

            {/* Environment for premium PBR reflections (no extra asset for presets) */}
            <Environment preset="city" />

            {/* Subtle ground plane — raycast disabled so clicks pass through to deselect */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow raycast={() => null}>
              <planeGeometry args={[9, 9]} />
              <shadowMaterial transparent opacity={0.65} color="#0a0a0a" />
            </mesh>

            {/* Real detailed team-specific F1 car (or fallback) with live stat-driven tweaks */}
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
        <div className="lg:col-span-2 space-y-4 text-sm">
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
      <div className="mt-1 text-center text-[10px] text-gray-500">
        Using the unpacked glTF + separate textures (best choice from your "3d models" folder) because it gives the most flexible live material/part tweaks while preserving the high-quality PBR maps.
      </div>
    </div>
  );
}
