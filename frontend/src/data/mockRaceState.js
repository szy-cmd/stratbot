/**
 * Hardcoded mock race states for turn-based F1 simulation.
 * Each turn = one "decision moment" with strategic branches.
 */

export const DRIVERS = [
  { id: 'VER', name: 'Verstappen', team: 'Red Bull', color: '#3671C6', number: 1 },
  { id: 'PER', name: 'Pérez', team: 'Red Bull', color: '#3671C6', number: 11 },
  { id: 'HAM', name: 'Hamilton', team: 'Mercedes', color: '#00D2BE', number: 44 },
  { id: 'RUS', name: 'Russell', team: 'Mercedes', color: '#00D2BE', number: 63 },
  { id: 'LEC', name: 'Leclerc', team: 'Ferrari', color: '#DC0000', number: 16 },
  { id: 'SAI', name: 'Sainz', team: 'Ferrari', color: '#DC0000', number: 55 },
  { id: 'NOR', name: 'Norris', team: 'McLaren', color: '#FF8700', number: 4 },
  { id: 'PIA', name: 'Piastri', team: 'McLaren', color: '#FF8700', number: 81 },
  { id: 'ALO', name: 'Alonso', team: 'Aston Martin', color: '#006F62', number: 14 },
  { id: 'STR', name: 'Stroll', team: 'Aston Martin', color: '#006F62', number: 18 },
];

export const TURNS = [
  {
    id: 1,
    lap: 5,
    description: 'Formation lap complete. Tire temps nominal. First stint strategy — push hard or manage tires early?',
    branches: [
      { id: 'push', label: 'Push — build gap', probability: 0.35, outcome: 'Early track position' },
      { id: 'manage', label: 'Manage tires', probability: 0.40, outcome: 'Longer first stint' },
      { id: 'mirror', label: 'Mirror rival strategy', probability: 0.20, outcome: 'Cover options' },
      { id: 'fuel_save', label: 'Fuel save mode', probability: 0.05, outcome: 'One-stop viable' },
    ],
    confidence: 82,
    riskLevel: 'low',
  },
  {
    id: 2,
    lap: 10,
    description: 'Undercut window approaching. Gap to car ahead 2.1s — pit early for mediums to jump them?',
    branches: [
      { id: 'undercut', label: 'Pit now — undercut', probability: 0.42, outcome: 'Jump P3' },
      { id: 'extend', label: 'Extend stint 3 laps', probability: 0.30, outcome: 'Overcut instead' },
      { id: 'cover', label: 'Wait for rival to pit', probability: 0.18, outcome: 'React to them' },
      { id: 'push', label: 'Push and pit next lap', probability: 0.10, outcome: 'Fastest in-lap' },
    ],
    confidence: 79,
    riskLevel: 'medium',
  },
  {
    id: 3,
    lap: 15,
    description: 'Safety Car deployed — Turn 6 incident. Pit window is open. Everyone scrambling.',
    branches: [
      { id: 'box_m', label: 'Box — Mediums', probability: 0.45, outcome: 'Standard choice' },
      { id: 'box_h', label: 'Box — Hards', probability: 0.25, outcome: 'One-stop to end' },
      { id: 'stay', label: 'Stay out', probability: 0.20, outcome: 'Track position' },
      { id: 'double', label: 'Double stack with teammate', probability: 0.10, outcome: 'Team play' },
    ],
    confidence: 91,
    riskLevel: 'medium',
  },
  {
    id: 4,
    lap: 20,
    description: 'First stint ending. Rear tires dropping off — 1.2s slower per lap. Which compound for stint 2?',
    branches: [
      { id: 'hard', label: 'Switch to Hards', probability: 0.38, outcome: 'Run to the end' },
      { id: 'medium', label: 'Switch to Mediums', probability: 0.35, outcome: 'Two-stop likely' },
      { id: 'extend', label: 'Extend 5 more laps', probability: 0.15, outcome: 'Offset strategy' },
      { id: 'soft', label: 'Gamble on Softs', probability: 0.12, outcome: 'Sprint then stop again' },
    ],
    confidence: 85,
    riskLevel: 'medium',
  },
  {
    id: 5,
    lap: 25,
    description: 'Rain radar active — 35% chance of precipitation in 8 laps. Adjust strategy now or hold?',
    branches: [
      { id: 'hold', label: 'Hold current strategy', probability: 0.32, outcome: 'Bet on dry' },
      { id: 'inter_ready', label: 'Prepare inters on standby', probability: 0.38, outcome: 'Quick swap if rain' },
      { id: 'early_pit', label: 'Pit early + longer stint', probability: 0.20, outcome: 'Be on fresh rubber' },
      { id: 'wet_gamble', label: 'Gamble on early inters', probability: 0.10, outcome: 'Huge gain if rain hits' },
    ],
    confidence: 68,
    riskLevel: 'high',
  },
  {
    id: 6,
    lap: 30,
    description: 'Virtual Safety Car. Cheap pit stop available — only ~12s loss instead of 22s. React?',
    branches: [
      { id: 'vsc_box', label: 'Pit under VSC', probability: 0.55, outcome: '~10s advantage' },
      { id: 'stay_one', label: 'Stay out — one-stop', probability: 0.25, outcome: 'Simpler strategy' },
      { id: 'splash', label: 'Splash fuel only', probability: 0.12, outcome: 'Minimal time loss' },
      { id: 'double', label: 'Convert to two-stop', probability: 0.08, outcome: 'Aggressive split' },
    ],
    confidence: 92,
    riskLevel: 'low',
  },
  {
    id: 7,
    lap: 35,
    description: 'Rival behind has pitted for fresh Softs and is 4s back but lapping 0.8s faster. Respond?',
    branches: [
      { id: 'respond', label: 'Pit next lap to cover', probability: 0.35, outcome: 'Neutralize threat' },
      { id: 'extend', label: 'Extend and overcut', probability: 0.30, outcome: 'Track position play' },
      { id: 'defend', label: 'Defend — use ERS', probability: 0.25, outcome: 'Hold position' },
      { id: 'let_pass', label: 'Let them through, manage race', probability: 0.10, outcome: 'Focus on others' },
    ],
    confidence: 74,
    riskLevel: 'high',
  },
  {
    id: 8,
    lap: 40,
    description: 'Second stint tire management. 17 laps to go. Tires at 62% grip. Push or conserve for the end?',
    branches: [
      { id: 'push', label: 'Push now — attack gap', probability: 0.30, outcome: 'Catch leader' },
      { id: 'conserve', label: 'Conserve for final 10', probability: 0.40, outcome: 'Strong finish' },
      { id: 'mix', label: 'Lift and coast straights', probability: 0.20, outcome: 'Balanced approach' },
      { id: 'mode', label: 'Switch engine mode — Overtake', probability: 0.10, outcome: 'Short burst' },
    ],
    confidence: 80,
    riskLevel: 'medium',
  },
  {
    id: 9,
    lap: 45,
    description: 'DRS train — 5 cars within 3s ahead. Dirty air killing tire life. Tactical call needed.',
    branches: [
      { id: 'aggressive', label: 'Aggressive overtakes', probability: 0.28, outcome: 'Clear the train' },
      { id: 'patient', label: 'Patient — wait for gaps', probability: 0.38, outcome: 'Preserve tires' },
      { id: 'pit_fresh', label: 'Pit for fresh Softs', probability: 0.22, outcome: 'Clear air + speed' },
      { id: 'offset', label: 'Use alternate lines', probability: 0.12, outcome: 'Find clean air' },
    ],
    confidence: 71,
    riskLevel: 'high',
  },
  {
    id: 10,
    lap: 50,
    description: 'Final stint. Leader 4.2s ahead with older tires. Rain drops spotted. All in or secure P2?',
    branches: [
      { id: 'attack', label: 'Full attack — hunt P1', probability: 0.38, outcome: 'Possible win' },
      { id: 'secure', label: 'Secure P2 — points matter', probability: 0.35, outcome: 'Safe podium' },
      { id: 'rain_bet', label: 'Prepare for rain switch', probability: 0.17, outcome: 'Inters ready' },
      { id: 'conserve', label: 'Manage tires to flag', probability: 0.10, outcome: 'No drama finish' },
    ],
    confidence: 77,
    riskLevel: 'high',
  },
  {
    id: 11,
    lap: 55,
    description: 'Last 2 laps! 0.8s behind leader. DRS available on the back straight. This is it.',
    branches: [
      { id: 'drs_pass', label: 'DRS pass on back straight', probability: 0.45, outcome: 'Go for the win' },
      { id: 'lunge', label: 'Late brake into Turn 1', probability: 0.20, outcome: 'All or nothing' },
      { id: 'exit', label: 'Perfect corner exit only', probability: 0.15, outcome: 'Marginal gain' },
      { id: 'settle', label: 'Settle P2 — great result', probability: 0.20, outcome: 'No risk' },
    ],
    confidence: 72,
    riskLevel: 'high',
  },
];

/** Initial leaderboard order (positions 1–10) */
export const INITIAL_LEADERBOARD = DRIVERS.slice(0, 10).map((d, i) => ({
  ...d,
  position: i + 1,
  gap: i === 0 ? '—' : `+${(i * 2.4 + Math.random() * 0.8).toFixed(2)}`,
  interval: i === 0 ? '—' : `+${(0.8 + Math.random() * 0.5).toFixed(2)}`,
  lastLap: `${(78 + Math.random() * 4).toFixed(2)}`,
  bestLap: `${(76 + Math.random() * 2).toFixed(2)}`,
  pitStops: i % 2,
}));

/** SVG path for a simplified track (e.g. Bahrain outer) — normalized 0–1 along path */
export const TRACK_PATH = 'M 50 20 L 90 20 L 90 45 Q 90 70 70 70 L 30 70 Q 10 70 10 45 L 10 20 L 50 20';

/** Path length approximation for placing cars (percent 0–100) */
export const TRACK_POSITIONS = [
  5, 15, 25, 35, 42, 52, 62, 72, 80, 88,
];

/** Available tracks in racetrack-svgs (filename without .svg) */
export const TRACK_OPTIONS = [
  { id: 'buddhism-svgfind-com', name: 'Buddhism' },
  { id: 'grand prix-svgfind-com', name: 'Grand Prix' },
  { id: 'prenoes dijon-svgfind-com', name: 'Prenoes Dijon' },
];
export const DEFAULT_TRACK = 'buddhism-svgfind-com';
