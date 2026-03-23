import { Hono } from 'hono';

export interface TelemetryFrame {
  ts: number;
  lap: number;
  pos: number;
  spd: number;
  thr: number;
  brk: number;
  str: number;
  gear: number;
  rpm: number;
  tyres: { fl: number; fr: number; rl: number; rr: number };
}

type SectorNumber = 1 | 2 | 3;

type IssueType = 'heavy_braking' | 'low_throttle' | 'tyre_overheat' | 'inconsistency';

interface SectorSummary {
  sector: SectorNumber;
  time: number;
}

interface LapSummary {
  lapNumber: number;
  lapTime: number;
  sectors: SectorSummary[];
  avgSpeed: number;
  maxSpeed: number;
}

interface SectorStats {
  sector: SectorNumber;
  startTs: number;
  endTs: number;
  time: number;
  avgThrottle: number;
  maxBrakeAtHighSpeed: number;
  hasHeavyBraking: boolean;
  hasTyreOverheat: boolean;
  speedStdDev: number;
}

interface CompletedLap {
  lapNumber: number;
  lapTime: number;
  sectors: SectorStats[];
  avgSpeed: number;
  maxSpeed: number;
  frames: TelemetryFrame[];
}

const app = new Hono();

const SECTOR_1_END = 0.333;
const SECTOR_2_END = 0.667;
const LAP_START_WINDOW = 0.02;
const EPSILON = 1e-9;

let storedFrames: TelemetryFrame[] = [];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTelemetryFrame(value: unknown): value is TelemetryFrame {
  if (!isObject(value)) return false;
  if (!isObject(value.tyres)) return false;

  return (
    typeof value.ts === 'number' &&
    typeof value.lap === 'number' &&
    typeof value.pos === 'number' &&
    typeof value.spd === 'number' &&
    typeof value.thr === 'number' &&
    typeof value.brk === 'number' &&
    typeof value.str === 'number' &&
    typeof value.gear === 'number' &&
    typeof value.rpm === 'number' &&
    typeof value.tyres.fl === 'number' &&
    typeof value.tyres.fr === 'number' &&
    typeof value.tyres.rl === 'number' &&
    typeof value.tyres.rr === 'number'
  );
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sortFrames(frames: TelemetryFrame[]): TelemetryFrame[] {
  return [...frames].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    if (a.lap !== b.lap) return a.lap - b.lap;
    return a.pos - b.pos;
  });
}

function removeStationaryFrames(frames: TelemetryFrame[]): TelemetryFrame[] {
  const sorted = sortFrames(frames);

  return sorted.filter((frame, index) => {
    if (index === 0) return true;

    const prev = sorted[index - 1];
    if (!prev) return true;

    const stationary = frame.spd < 5 && Math.abs(frame.pos - prev.pos) < EPSILON;
    return !stationary;
  });
}

function groupFramesByLap(frames: TelemetryFrame[]): Map<number, TelemetryFrame[]> {
  const laps = new Map<number, TelemetryFrame[]>();

  for (const frame of frames) {
    const lapFrames = laps.get(frame.lap) ?? [];
    lapFrames.push(frame);
    laps.set(frame.lap, lapFrames);
  }

  for (const [lapNumber, lapFrames] of laps.entries()) {
    laps.set(lapNumber, sortFrames(lapFrames));
  }

  return laps;
}

function isOutLap(lapFrames: TelemetryFrame[]): boolean {
  const first = lapFrames.at(0);
  if (!first) return true;
  return first.pos > LAP_START_WINDOW;
}

function isIncompleteLap(lapFrames: TelemetryFrame[]): boolean {
  const last = lapFrames.at(-1);
  if (!last) return true;
  return last.pos < 0.98;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function interpolateTimeAtBoundary(prev: TelemetryFrame, next: TelemetryFrame, boundary: number): number {
  const posDelta = next.pos - prev.pos;
  if (Math.abs(posDelta) < EPSILON) return next.ts;

  const ratio = (boundary - prev.pos) / posDelta;
  return prev.ts + ratio * (next.ts - prev.ts);
}

function getTimeAtPosition(frames: TelemetryFrame[], boundary: number): number | null {
  for (let i = 1; i < frames.length; i += 1) {
    const prev = frames[i - 1];
    const next = frames[i];

    if (!prev || !next) continue;

    if (prev.pos <= boundary && next.pos >= boundary) {
      return interpolateTimeAtBoundary(prev, next, boundary);
    }
  }

  return null;
}

function sectorForPosition(pos: number): SectorNumber {
  if (pos < SECTOR_1_END) return 1;
  if (pos < SECTOR_2_END) return 2;
  return 3;
}

function computeSectorStats(frames: TelemetryFrame[], sector: SectorNumber, startTs: number, endTs: number): SectorStats {
  const sectorFrames = frames.filter((frame) => sectorForPosition(frame.pos) === sector);
  const throttles = sectorFrames.map((frame) => frame.thr);
  const speeds = sectorFrames.map((frame) => frame.spd);

  return {
    sector,
    startTs,
    endTs,
    time: round(endTs - startTs, 3),
    avgThrottle: mean(throttles),
    maxBrakeAtHighSpeed: Math.max(
      0,
      ...sectorFrames.filter((frame) => frame.spd > 200).map((frame) => frame.brk),
    ),
    hasHeavyBraking: sectorFrames.some((frame) => frame.brk > 0.8 && frame.spd > 200),
    hasTyreOverheat: sectorFrames.some(
      (frame) =>
        frame.tyres.fl > 110 ||
        frame.tyres.fr > 110 ||
        frame.tyres.rl > 110 ||
        frame.tyres.rr > 110,
    ),
    speedStdDev: stdDev(speeds),
  };
}

function computeCompletedLaps(frames: TelemetryFrame[]): CompletedLap[] {
  const filtered = removeStationaryFrames(frames);
  const grouped = groupFramesByLap(filtered);
  const lapNumbers = [...grouped.keys()].sort((a, b) => a - b);
  const completed: CompletedLap[] = [];

  for (const lapNumber of lapNumbers) {
    const lapFrames = grouped.get(lapNumber) ?? [];
    if (lapFrames.length < 2) continue;
    if (isOutLap(lapFrames)) continue;
    if (isIncompleteLap(lapFrames)) continue;

    const firstFrame = lapFrames.at(0);
    const lastFrame = lapFrames.at(-1);

    if (!firstFrame || !lastFrame) continue;

    const lapStart = firstFrame.ts;
    const sector1End = getTimeAtPosition(lapFrames, SECTOR_1_END);
    const sector2End = getTimeAtPosition(lapFrames, SECTOR_2_END);
    const lapEnd = lastFrame.ts;

    if (sector1End === null || sector2End === null) continue;

    const sectors = [
      computeSectorStats(lapFrames, 1, lapStart, sector1End),
      computeSectorStats(lapFrames, 2, sector1End, sector2End),
      computeSectorStats(lapFrames, 3, sector2End, lapEnd),
    ];

    completed.push({
      lapNumber,
      lapTime: round(lapEnd - lapStart, 3),
      sectors,
      avgSpeed: round(mean(lapFrames.map((frame) => frame.spd)), 3),
      maxSpeed: Math.max(...lapFrames.map((frame) => frame.spd)),
      frames: lapFrames,
    });
  }

  return completed;
}

function toLapSummary(lap: CompletedLap): LapSummary {
  return {
    lapNumber: lap.lapNumber,
    lapTime: lap.lapTime,
    sectors: lap.sectors.map((sector) => ({
      sector: sector.sector,
      time: sector.time,
    })),
    avgSpeed: lap.avgSpeed,
    maxSpeed: lap.maxSpeed,
  };
}

function buildCoachingMessage(sector: SectorStats, issue: IssueType): string {
  switch (issue) {
    case 'tyre_overheat':
      return `Sector ${sector.sector} is killing your lap. You're overheating the tyres and paying for it mid-corner. Calm the inputs. Protect the fronts.`;
    case 'heavy_braking':
      return `Sector ${sector.sector} is costing time. You're braking too hard while the car is still fast. Bleed speed earlier. Release cleaner.`;
    case 'low_throttle':
      return `Sector ${sector.sector} is soft. Throttle trace is weak and you're giving away exit speed. Commit earlier. Drive off the corner.`;
    case 'inconsistency':
    default:
      return `Sector ${sector.sector} is messy. Speed trace is inconsistent and the lap falls apart there. Be smoother. One clean rhythm.`;
  }
}

function decideIssue(sector: SectorStats): IssueType {
  if (sector.hasTyreOverheat) return 'tyre_overheat';
  if (sector.hasHeavyBraking) return 'heavy_braking';
  if (sector.avgThrottle < 0.6) return 'low_throttle';
  if (sector.speedStdDev > 40) return 'inconsistency';
  return 'inconsistency';
}

app.get('/health', (c) => {
  return c.json({ ok: true });
});

app.post('/ingest', async (c) => {
  const payload = await c.req.json().catch(() => null);

  if (!Array.isArray(payload)) {
    return c.json({ error: 'Body must be an array of telemetry frames.' }, 400);
  }

  if (!payload.every(isTelemetryFrame)) {
    return c.json({ error: 'Invalid telemetry frame shape.' }, 400);
  }

  storedFrames = sortFrames(payload);
  const laps = computeCompletedLaps(storedFrames);

  return c.json({
    laps: laps.length,
    frames: storedFrames.length,
  });
});

app.get('/laps', (c) => {
  const laps = computeCompletedLaps(storedFrames).map(toLapSummary);
  return c.json(laps);
});

app.get('/analysis', (c) => {
  const laps = computeCompletedLaps(storedFrames);

  if (laps.length === 0) {
    return c.json({ error: 'No completed laps available. Ingest telemetry first.' }, 400);
  }

  const bestLap = laps.reduce((best, current) => (current.lapTime < best.lapTime ? current : best));
  const worstLap = laps.reduce((worst, current) => (current.lapTime > worst.lapTime ? current : worst));

  const sectorDeltas = worstLap.sectors
    .map((sector, index) => {
      const bestSector = bestLap.sectors[index];
      if (!bestSector) return null;

      return {
        sector,
        delta: sector.time - bestSector.time,
      };
    })
    .filter((value): value is { sector: SectorStats; delta: number } => value !== null);

  if (sectorDeltas.length === 0) {
    return c.json({ error: 'Unable to compare sector deltas.' }, 500);
  }

  const [firstDelta, ...restDeltas] = sectorDeltas;
  if (!firstDelta) {
    return c.json({ error: 'Unable to compare sector deltas.' }, 500);
  }

  const problem = restDeltas.reduce(
    (worst, current) => (current.delta > worst.delta ? current : worst),
    firstDelta,
  );

  const issue = decideIssue(problem.sector);

  return c.json({
    bestLap: {
      lapNumber: bestLap.lapNumber,
      lapTime: bestLap.lapTime,
    },
    worstLap: {
      lapNumber: worstLap.lapNumber,
      lapTime: worstLap.lapTime,
      delta: round(worstLap.lapTime - bestLap.lapTime, 3),
    },
    problemSector: problem.sector.sector,
    issue,
    coachingMessage: buildCoachingMessage(problem.sector, issue),
    evidence: {
      sectorDelta: round(problem.delta, 3),
      avgThrottle: round(problem.sector.avgThrottle, 3),
      speedStdDev: round(problem.sector.speedStdDev, 3),
      hasHeavyBraking: problem.sector.hasHeavyBraking,
      hasTyreOverheat: problem.sector.hasTyreOverheat,
    },
  });
});

const port = Number(process.env.PORT ?? 3000);

export default {
  port,
  fetch: app.fetch,
};

console.log(`PitGPT telemetry API listening on http://localhost:${port}`);
