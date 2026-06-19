import React, { useState, useCallback, useEffect } from 'react';
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
  }, [race, sim]);

  /* ── BOOT ── */
  if (phase === PHASE.BOOT) {
    return <BootSequence onComplete={onBootComplete} />;
  }

  /* ── SETUP ── */
  if (phase === PHASE.SETUP) {
    return <PreRaceSetup onStart={onSetupStart} />;
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
        <Header right="POST-RACE ANALYSIS" />
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
      <Header right={`${raceTypeLabel} · ${weatherLabel} ${race.slowing ? '· SLOWING' : ''}`} />

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
              <div className="mb-4 text-2xl font-display text-amber-400">Fast-forwarding full simulation...</div>
              <div className="mb-2 text-sm text-gray-400">Advancing remaining laps as fast as possible to compute final results.</div>
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
            <TrackMap drivers={race.drivers} />
            <LiveTimingLeaderboard leaderboard={race.drivers} />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Shared header bar ── */
function Header({ right }) {
  return (
    <header className="border-b border-f1-border bg-f1-panel/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <h1 className="font-display text-lg font-bold tracking-wider text-white md:text-xl">
          F1 STRATEGY DASHBOARD
        </h1>
        <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">
          {right}
        </span>
      </div>
    </header>
  );
}

export default App;
