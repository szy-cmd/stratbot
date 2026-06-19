import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { useRaceEngine } from './engine/RaceEngine';
import { TURNS } from './data/mockRaceState';
import { BootSequence } from './components/BootSequence';
import { PreRaceSetup } from './components/PreRaceSetup';
import { TurnPanel } from './components/TurnPanel';
import { TurnNavigation } from './components/TurnNavigation';
import { TrackMap } from './components/TrackMap';
import { LiveTimingLeaderboard } from './components/LiveTimingLeaderboard';
import { StrategyEnginePanel } from './components/StrategyEnginePanel';
import { TelemetryCharts } from './components/TelemetryCharts';
import { PostRaceSummary } from './components/PostRaceSummary';
import { RaceFeed } from './components/RaceFeed';
import { ModelInsightsPanel } from './components/ModelInsightsPanel';
import { useStratBotModel } from './hooks/useStratBotModel';

/* App state machine: BOOT → SETUP → RACING → POST_RACE */
const PHASE = { BOOT: 'boot', SETUP: 'setup', RACING: 'racing', POST_RACE: 'post_race' };

function App() {
  const [phase, setPhase] = useState(PHASE.BOOT);
  const race = useRaceEngine();
  const sim = useSimulation();

  // Persistent race history for previous results (recorded on completion)
  const [raceHistory, setRaceHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('stratbot_race_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [viewingPastRace, setViewingPastRace] = useState(null);

  // Ref to debounce saves (prevent multiple on finish)
  const lastSavedRef = useRef(0);

  const trackedDriver = race.drivers.find((d) => d.id === race.trackedDriverId) || race.drivers[0];
  const stratBot = useStratBotModel({
    driver: trackedDriver,
    lap: trackedDriver?.lap ?? 1,
    totalLaps: race.totalLaps,
    raceConfig: race.raceConfig,
    enabled: phase === PHASE.RACING && !race.raceFinished,
  });

  // Persist live predictions for post-race ML comparison / analysis
  useEffect(() => {
    if (phase === PHASE.RACING && stratBot.prediction && race.recordPrediction) {
      race.recordPrediction({
        ...stratBot.prediction,
        lap: trackedDriver?.lap,
        variant: race.raceConfig?.modelVariant || 'base',
        weather: race.raceConfig?.weather,
      });
    }
  }, [phase, stratBot.prediction, trackedDriver?.lap, race.raceConfig, race.recordPrediction]);

  // FYP-II: feed live ML LapDelta into simulation engine to influence pace/tyre/fuel
  useEffect(() => {
    if (phase === PHASE.RACING && race.setCurrentMLDelta && race.raceConfig?.useMLDeltas) {
      if (stratBot.prediction && stratBot.prediction.lap_delta_seconds != null) {
        race.setCurrentMLDelta(stratBot.prediction.lap_delta_seconds);
      }
    }
  }, [phase, stratBot.prediction, race.setCurrentMLDelta, race.raceConfig?.useMLDeltas]);

  /* ── Phase transitions ── */
  const onBootComplete = useCallback(() => setPhase(PHASE.SETUP), []);

  const onSetupStart = useCallback((config) => {
    race.startRace(config);
    sim.resetSimulation();
    setPhase(PHASE.RACING);
  }, [race, sim]);

  const onNewRace = useCallback(() => {
    race.reset();
    sim.resetSimulation();
    setPhase(PHASE.SETUP);
    setViewingPastRace(null);
  }, [race, sim]);

  // Record completed race to history when it finishes
  useEffect(() => {
    if (race.raceFinished && race.drivers?.length > 0 && race.totalLaps > 0) {
      const now = Date.now();
      if (now - lastSavedRef.current < 1000) return; // debounce
      lastSavedRef.current = now;

      const entry = {
        id: now.toString(36) + Math.random().toString(36).slice(2),
        timestamp: now,
        raceConfig: race.raceConfig,
        drivers: race.drivers,
        lapHistory: race.lapHistory || [],
        highlightsLog: race.highlightsLog || [],
        telemetryHistory: race.telemetryHistory || {},
        mlPredictions: race.mlPredictions || [],
        peakSpeed: race.peakSpeed || 0,
        totalLaps: race.totalLaps,
        trackedDriverId: race.trackedDriverId,
      };
      setRaceHistory(prev => {
        const updated = [entry, ...prev].slice(0, 10);
        try {
          localStorage.setItem('stratbot_race_history', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  }, [race.raceFinished, race.drivers, race.totalLaps]);

  // Exposed for header nav: clicking title or nav button always returns to selection/setup
  const goToSetup = onNewRace;

  /* ── BOOT ── */
  if (phase === PHASE.BOOT) {
    return <BootSequence onComplete={onBootComplete} />;
  }

  /* ── SETUP ── */
  if (phase === PHASE.SETUP) {
    return (
      <>
        <PreRaceSetup 
          onStart={onSetupStart} 
          previousRaces={raceHistory} 
          onViewPrevious={setViewingPastRace} 
        />
        {viewingPastRace && (
          <div className="fixed inset-0 z-[80] bg-f1-dark overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              <div className="sticky top-0 z-10 bg-f1-panel/95 backdrop-blur border-b border-f1-border px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-display text-sm uppercase tracking-[2px] text-f1-accent">Past Race Results</span>
                  <span className="ml-4 text-white/70 font-mono text-xs">{new Date(viewingPastRace.timestamp).toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => setViewingPastRace(null)}
                  className="px-4 py-1 text-sm border border-f1-border rounded hover:bg-white/5"
                >
                  Back to Configuration
                </button>
              </div>
              <PostRaceSummary
                drivers={viewingPastRace.drivers || []}
                peakSpeed={viewingPastRace.peakSpeed || 0}
                highlightsLog={viewingPastRace.highlightsLog || []}
                telemetryHistory={viewingPastRace.telemetryHistory || { speed: [], tireWear: [], fuel: [] }}
                raceConfig={viewingPastRace.raceConfig || {}}
                onReset={() => setViewingPastRace(null)}
                mlPredictions={viewingPastRace.mlPredictions || []}
                trackedDriverId={viewingPastRace.trackedDriverId || viewingPastRace.raceConfig?.trackedDriver || ''}
                lapHistory={viewingPastRace.lapHistory || []}
                totalLaps={viewingPastRace.totalLaps || 57}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  /* ── Determine active TURNS index (filtered by totalLaps) ── */
  const activeTurns = TURNS.filter((t) => t.lap <= race.totalLaps);
  const currentTurnIndex = race.paused && race.decisionIndex >= 0 ? race.decisionIndex : sim.currentTurnIndex;
  const currentTurn = activeTurns[currentTurnIndex];

  const onSelectBranch = (branchId) => {
    const turn = activeTurns[currentTurnIndex];
    const branch = turn?.branches?.find((b) => b.id === branchId);
    if (turn && branch) {
      race.addHighlight(`Lap ${turn.lap}: ${branch.label} — ${branch.outcome}`);
    }
    sim.selectBranch(branchId, currentTurnIndex);
    race.resume();
  };

  const showTurnPanel = race.paused && race.decisionIndex >= 0 && !race.raceFinished;
  const raceActive = !race.paused && !race.raceFinished;

  /* ── POST-RACE ── */
  if (race.raceFinished) {
    return (
      <div className="min-h-screen bg-f1-dark scanlines animate-fade-in">
        <Header right="POST-RACE ANALYSIS" onGoHome={goToSetup} />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <PostRaceSummary
            drivers={race.drivers}
            peakSpeed={race.peakSpeed}
            highlightsLog={race.highlightsLog}
            telemetryHistory={race.telemetryHistory}
            raceConfig={race.raceConfig}
            onReset={onNewRace}
            mlPredictions={race.mlPredictions}
            trackedDriverId={race.trackedDriverId}
            lapHistory={race.lapHistory || []}
            totalLaps={race.totalLaps}
          />
        </main>
      </div>
    );
  }

  /* ── RACING ── */
  const weatherLabel = { clear: 'CLEAR', overcast: 'OVERCAST', rainy: 'WET' }[race.raceConfig?.weather] || '';
  const raceTypeLabel = { sprint: 'SPRINT', standard: 'GRAND PRIX', endurance: 'ENDURANCE' }[race.raceConfig?.raceType] || '';

  return (
    <div className="min-h-screen bg-f1-dark scanlines animate-fade-in">
      <Header right={`${raceTypeLabel} · ${weatherLabel} ${race.slowing ? '· SLOWING' : ''}`} onGoHome={goToSetup} />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <TurnNavigation
            onPrev={sim.goPrevTurn}
            onNext={sim.goNextTurn}
            onReset={onNewRace}
            onEndRace={race.endSimulation}
            onFastForward={race.toggleFastForward}
            fastForward={race.fastForward}
            hasPrev={sim.hasPrevTurn}
            hasNext={sim.hasNextTurn}
            currentIndex={currentTurnIndex}
            totalTurns={activeTurns.length}
            raceActive={raceActive}
            currentLap={race.drivers[0]?.lap ?? 1}
            totalLaps={race.totalLaps}
            onFastComplete={() => race.fastCompleteRace()}
          />
        </div>

        {/* FYP-II fast complete loading overlay - shows while sim runs to end at high speed to let user see full results after "loading" */}
        {race.isFastCompleting && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
            <div className="rounded-xl border border-amber-400 bg-f1-panel p-8 text-center shadow-2xl">
              <div className="mb-4 text-2xl font-display text-amber-400">Simulating full race...</div>
              <div className="mb-2 text-sm text-gray-400">Accurate physics + tire/fuel/strategy running at accelerated speed. Lap counter updates live.</div>
              <div className="font-mono text-lg text-white">Lap {race.drivers[0]?.lap ?? 1} / {race.totalLaps}</div>
              <div className="mt-4 h-2 w-64 overflow-hidden rounded bg-gray-800">
                <div className="h-full bg-amber-400 transition-all" style={{width: `${Math.min(100, ((race.drivers[0]?.lap ?? 1) / race.totalLaps) * 100)}%` }} />
              </div>
              <div className="mt-2 text-xs text-gray-500">This will take a moment but simulates the entire remaining race instantly.</div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            {showTurnPanel && currentTurn && (
              <TurnPanel
                key={race.decisionIndex}
                turn={currentTurn}
                selectedBranchId={sim.selectedBranchIds[currentTurnIndex]}
                onSelectBranch={onSelectBranch}
                turnIndex={currentTurnIndex}
                totalTurns={activeTurns.length}
              />
            )}
            {!showTurnPanel && (
              <RaceFeed
                raceFeed={race.raceFeed}
                currentLap={race.drivers[0]?.lap ?? 1}
              />
            )}
            <StrategyEnginePanel turn={currentTurn} />
            <ModelInsightsPanel
              modelInfo={stratBot.modelInfo}
              prediction={stratBot.prediction}
              loading={stratBot.loading}
              error={stratBot.error}
              apiOnline={stratBot.apiOnline}
              onRefresh={stratBot.refreshPrediction}
            />
            <TelemetryCharts
              telemetryHistory={race.telemetryHistory}
              trackedDriverId={race.trackedDriverId}
              drivers={race.drivers}
              onChangeDriver={race.setTrackedDriverId}
            />
          </div>

          <div className="space-y-6 lg:col-span-7">
            <TrackMap drivers={race.drivers} trackId={race.raceConfig?.trackId} />
            <LiveTimingLeaderboard leaderboard={race.drivers} />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Shared header bar ── */
function Header({ right, onGoHome }) {
  return (
    <header className="sticky top-0 z-50 border-b border-f1-border bg-f1-panel/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* GitHub link on the very left side, under/aligned with STRATBOT branding */}
          <a
            href="https://github.com/szy-cmd/stratbot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors mt-0.5"
            title="View source on GitHub"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>

          {/* StratBot branding + team credits on the very top (as requested) */}
          <div className="flex flex-col leading-none">
            <div className="flex items-baseline gap-2">
              <span
                onClick={onGoHome}
                className="font-display text-xl font-black tracking-[3px] text-f1-accent cursor-pointer select-none hover:bg-f1-panel/40 hover:text-white px-1 -mx-1 rounded active:scale-[0.985] transition-colors"
                title="StratBot • Return to race configuration / selection screen"
              >
                STRATBOT
              </span>
              <h1
                onClick={onGoHome}
                className="font-display text-base font-bold tracking-wider text-white md:text-lg cursor-pointer select-none hover:bg-f1-panel/40 hover:text-f1-accent px-1 -mx-1 rounded active:opacity-80 transition-colors"
                title="Return to race configuration / selection screen"
              >
                F1 STRATEGY DASHBOARD
              </h1>
            </div>
            <div className="text-[9px] font-mono tracking-[0.5px] text-white/85 font-medium mt-1">
              ZAAFIR EJAZ (CS221222) • EBAD AHMED (CS221217) • FATIMA ATHER RAJPUT (CS221270)
            </div>
          </div>

          {onGoHome && (
            <button
              onClick={onGoHome}
              className="ml-1 rounded border border-f1-border bg-black/30 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-gray-400 hover:bg-f1-accent/10 hover:text-f1-accent active:bg-f1-accent/20 transition"
              title="Go back to setup / new race configuration"
            >
              SETUP
            </button>
          )}
        </div>
        <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">
          {right}
        </span>
      </div>
    </header>
  );
}

export default App;
