import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Interactive 3D F1 Car visualizer / customizer.
 * Procedural model using primitives for F1-like look (no external asset needed).
 * Click parts or use controls to change stats: compound (tyres), initial wear, aero, power.
 * Live updates visuals.
 * Like a driving game car select screen.
 */

const COMPOUNDS = ['soft', 'medium', 'hard'];
const COMPOUND_COLORS = { soft: '#ff3333', medium: '#ffcc00', hard: '#eeeeee' };

function F1Car({ stats, onPartClick, selectedPart, teamColor = '#3671C6' }) {
  const { compound, initialTyreWear, aeroLevel, powerLevel } = stats;
  const tyreColor = COMPOUND_COLORS[compound] || '#ffcc00';
  const wearScale = 1 - (initialTyreWear || 0) / 120; // visual wear on tyres
  const wingAngle = (aeroLevel - 5) * 0.08; // radians
  const engineGlow = powerLevel > 6 ? 0.6 : 0.2;

  return (
    <group>
      {/* Main chassis/body */}
      <mesh 
        position={[0, 0.6, 0]} 
        onClick={() => onPartClick('body')}
        onPointerOver={(e) => { e.object.material.emissive = new THREE.Color(selectedPart === 'body' ? 0x444444 : 0x222222); }}
      >
        <boxGeometry args={[3.2, 0.7, 1.1]} />
        <meshPhongMaterial 
          color={teamColor} 
          shininess={30} 
          emissive={selectedPart === 'body' ? 0x333333 : 0x000000} 
        />
      </mesh>

      {/* Cockpit / halo area */}
      <mesh position={[0.2, 1.1, 0]} onClick={() => onPartClick('cockpit')}>
        <boxGeometry args={[1.2, 0.5, 0.9]} />
        <meshPhongMaterial color="#222233" emissive={selectedPart === 'cockpit' ? 0x333333 : 0} />
      </mesh>

      {/* Nose cone */}
      <mesh position={[-1.8, 0.55, 0]} onClick={() => onPartClick('nose')}>
        <coneGeometry args={[0.4, 1.2, 4]} />
        <meshPhongMaterial color="#1a1a2e" emissive={selectedPart === 'nose' ? 0x333333 : 0} />
      </mesh>

      {/* Front wing */}
      <group position={[-1.5, 0.4, 0]} rotation={[wingAngle * 0.5, 0, 0]} onClick={() => onPartClick('frontWing')}>
        <mesh>
          <boxGeometry args={[1.8, 0.08, 1.6]} />
          <meshPhongMaterial color="#333344" emissive={selectedPart === 'frontWing' ? 0x222266 : 0} />
        </mesh>
      </group>

      {/* Rear wing */}
      <group position={[1.4, 0.9, 0]} rotation={[wingAngle, 0, 0]} onClick={() => onPartClick('rearWing')}>
        <mesh>
          <boxGeometry args={[1.4, 0.1, 1.8]} />
          <meshPhongMaterial color="#333344" emissive={selectedPart === 'rearWing' ? 0x222266 : 0} />
        </mesh>
        {/* Wing supports */}
        <mesh position={[0, -0.3, 0.6]}>
          <boxGeometry args={[0.1, 0.6, 0.1]} />
          <meshPhongMaterial color="#222233" />
        </mesh>
        <mesh position={[0, -0.3, -0.6]}>
          <boxGeometry args={[0.1, 0.6, 0.1]} />
          <meshPhongMaterial color="#222233" />
        </mesh>
      </group>

      {/* 4 Wheels - clickable for tyre compound/wear */}
      {[-1.1, 1.1].map((x, i) => (
        <group key={i}>
          {/* Left wheels */}
          <mesh 
            position={[x, 0.45, 0.85]} 
            rotation={[0, 0, Math.PI / 2]}
            onClick={() => onPartClick('tyres')}
          >
            <cylinderGeometry args={[0.45 * wearScale, 0.45 * wearScale, 0.35, 16]} />
            <meshPhongMaterial color={tyreColor} shininess={10} />
          </mesh>
          {/* Right wheels */}
          <mesh 
            position={[x, 0.45, -0.85]} 
            rotation={[0, 0, Math.PI / 2]}
            onClick={() => onPartClick('tyres')}
          >
            <cylinderGeometry args={[0.45 * wearScale, 0.45 * wearScale, 0.35, 16]} />
            <meshPhongMaterial color={tyreColor} shininess={10} />
          </mesh>
        </group>
      ))}

      {/* Engine / exhaust glow area */}
      <mesh position={[0.8, 0.7, 0]} onClick={() => onPartClick('engine')}>
        <boxGeometry args={[1.2, 0.5, 0.7]} />
        <meshPhongMaterial 
          color="#111122" 
          emissive={engineGlow > 0.3 ? new THREE.Color(0xff6600).multiplyScalar(engineGlow) : 0x000000} 
          emissiveIntensity={engineGlow} 
        />
      </mesh>

      {/* Simple "driver" helmet */}
      <mesh position={[-0.1, 1.3, 0]} onClick={() => onPartClick('driver')}>
        <sphereGeometry args={[0.28]} />
        <meshPhongMaterial color="#222244" />
      </mesh>
    </group>
  );
}

export function CarCustomizer({ stats, onStatsChange, driverName = 'Your Car', driverColor = '#3671C6', weather = 'clear', trackName = 'Track', onClose, onApply }) {
  const [selectedPart, setSelectedPart] = useState(null);
  const [localStats, setLocalStats] = useState(stats);

  const updateStat = (key, value) => {
    const newStats = { ...localStats, [key]: value };
    setLocalStats(newStats);
    onStatsChange?.(newStats);
  };

  const handlePartClick = (part) => {
    setSelectedPart(part);
    if (part === 'tyres') {
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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-f1-border bg-f1-panel p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-display text-xl text-white">Team Strategy for {driverName}'s Car</div>
            <div className="text-xs text-gray-400">As the race engineer for this driver, make realistic F1 team choices (tyres, setup for weather/track). Click car parts or briefing. Affects sim + ML for accurate, driver-specific results.</div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-f1-border rounded hover:bg-white/5">Cancel</button>
            <button onClick={() => onApply(localStats)} className="px-4 py-2 text-sm bg-f1-accent text-black rounded font-medium">Apply Stats & Continue</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* 3D Visualizer - main "driving game" interaction area */}
          <div className="lg:col-span-3 rounded-xl overflow-hidden border border-f1-border bg-black" style={{ height: 420 }}>
            <Canvas camera={{ position: [0, 2, 6], fov: 50 }} style={{ background: '#0a0a0f' }}>
              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
              <pointLight position={[-5, 3, -5]} intensity={0.5} color="#ffaa44" />

              <F1Car 
                stats={localStats} 
                onPartClick={handlePartClick} 
                selectedPart={selectedPart} 
                teamColor={driverColor}
              />

              <OrbitControls 
                enablePan={false} 
                enableZoom={true} 
                minDistance={3} 
                maxDistance={10}
                autoRotate={false}
                target={[0, 0.8, 0]}
              />
            </Canvas>
          </div>

          {/* Controls / Stats - "click what you want to change" */}
          <div className="lg:col-span-2 space-y-4 text-sm">
            <div className="rounded-lg border border-f1-border bg-black/30 p-3">
              <div className="font-mono text-xs uppercase text-f1-accent mb-2">Selected: {selectedPart || 'Click a part on the car'}</div>
              
              {/* Tyre / Compound */}
              <div className="mb-3">
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
              <div className="mb-3">
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
              <div className="mb-3">
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
              <div>
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
          Drag to rotate • Scroll to zoom • Click parts (especially tyres) for quick changes
        </div>
      </div>
    </div>
  );
}
