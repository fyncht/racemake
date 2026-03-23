/**
 * 🏁 RACEMAKE PRODUCT ENGINEER CHALLENGE 🏁
 * ==========================================
 *
 * Level 1:
 * - Fixed sector sorting so the worst sector is analyzed first.
 *
 * Level 2:
 * - Extended the pipeline to analyze multiple laps and summarize stint patterns.
 *
 * Level 3:
 * - See notes printed at the end of the run output.
 */

// ============================================================
// SECTION 1: TYPES
// ============================================================

interface BrakingPoint {
  turn: string;
  brakeMarker: number;
  trailBraking: boolean;
}

interface DriverBrakingPoint extends BrakingPoint {
  lockup: boolean;
  tcActive: boolean;
}

interface TyreTemps {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
}

interface TyreData {
  avgSlip: number;
  peakSlip: number;
  avgTemp: TyreTemps;
}

interface ThrottleTrace {
  earlyLift: boolean;
  smoothApplication: boolean;
  fullThrottlePercent: number;
}

interface ReferenceSector {
  time: number;
  brakingPoints: BrakingPoint[];
}

interface DriverSector {
  time: number;
  delta: number;
  brakingPoints: DriverBrakingPoint[];
  tyreData: TyreData;
  throttleTrace: ThrottleTrace;
}

interface ReferenceLap {
  track: string;
  car: string;
  totalTime: number;
  sectors: Record<string, ReferenceSector>;
}

interface DriverLap {
  track: string;
  car: string;
  totalTime: number;
  sectors: Record<string, DriverSector>;
}

type Issue = "late_braking" | "early_lift" | "traction_loss" | "overcorrection";

interface SectorFinding {
  sector: number;
  sectorKey: string;
  delta: number;
  issue: Issue;
  details: string;
}

interface LapAnalysis {
  findings: SectorFinding[];
  totalDelta: number;
}

interface CoachingOutput {
  problemSector: number;
  issue: Issue;
  timeLost: number;
  coachingMessage: string;
}

interface Config {
  coachVoice: "generic" | "pitgpt";
  units: "metric" | "imperial";
}

interface LapRun {
  label: string;
  lap: DriverLap;
}

interface LapReport {
  lapLabel: string;
  totalTime: number;
  totalDelta: number;
  analysis: LapAnalysis;
  coaching: CoachingOutput;
}

interface StintSummary {
  patterns: string[];
  dominantIssue: Issue | null;
  worstLapLabel: string | null;
}

interface StintReport {
  laps: LapReport[];
  summary: StintSummary;
}

// ============================================================
// SECTION 2: DATA — Spa-Francorchamps, LMU
// Car: Porsche 963 LMdh | Conditions: Dry, 24°C track
// ============================================================

const referenceLap: ReferenceLap = {
  track: "Spa-Francorchamps",
  car: "Porsche 963 LMdh",
  totalTime: 133.412,
  sectors: {
    s1: {
      time: 41.203,
      brakingPoints: [{ turn: "T1 La Source", brakeMarker: 92, trailBraking: true }],
    },
    s2: {
      time: 48.887,
      brakingPoints: [
        { turn: "T6 Rivage", brakeMarker: 68, trailBraking: true },
        { turn: "T10 Pouhon", brakeMarker: 44, trailBraking: true },
      ],
    },
    s3: {
      time: 43.322,
      brakingPoints: [
        { turn: "T14 Stavelot", brakeMarker: 55, trailBraking: true },
        { turn: "T18 Bus Stop", brakeMarker: 78, trailBraking: false },
      ],
    },
  },
};

const driverLap: DriverLap = {
  track: "Spa-Francorchamps",
  car: "Porsche 963 LMdh",
  totalTime: 135.067,
  sectors: {
    s1: {
      time: 41.59,
      delta: +0.387,
      brakingPoints: [
        {
          turn: "T1 La Source",
          brakeMarker: 89,
          trailBraking: true,
          lockup: false,
          tcActive: false,
        },
      ],
      tyreData: {
        avgSlip: 0.032,
        peakSlip: 0.071,
        avgTemp: { fl: 94, fr: 97, rl: 91, rr: 92 },
      },
      throttleTrace: {
        earlyLift: false,
        smoothApplication: true,
        fullThrottlePercent: 0.78,
      },
    },
    s2: {
      time: 50.085,
      delta: +1.198,
      brakingPoints: [
        {
          turn: "T6 Rivage",
          brakeMarker: 56,
          trailBraking: false,
          lockup: false,
          tcActive: true,
        },
        {
          turn: "T10 Pouhon",
          brakeMarker: 41,
          trailBraking: true,
          lockup: false,
          tcActive: false,
        },
      ],
      tyreData: {
        avgSlip: 0.058,
        peakSlip: 0.134,
        avgTemp: { fl: 101, fr: 104, rl: 97, rr: 99 },
      },
      throttleTrace: {
        earlyLift: false,
        smoothApplication: false,
        fullThrottlePercent: 0.62,
      },
    },
    s3: {
      time: 43.392,
      delta: +0.07,
      brakingPoints: [
        {
          turn: "T14 Stavelot",
          brakeMarker: 54,
          trailBraking: true,
          lockup: false,
          tcActive: false,
        },
        {
          turn: "T18 Bus Stop",
          brakeMarker: 76,
          trailBraking: false,
          lockup: false,
          tcActive: false,
        },
      ],
      tyreData: {
        avgSlip: 0.029,
        peakSlip: 0.065,
        avgTemp: { fl: 93, fr: 96, rl: 90, rr: 91 },
      },
      throttleTrace: {
        earlyLift: false,
        smoothApplication: true,
        fullThrottlePercent: 0.81,
      },
    },
  },
};

// Second driver lap — stint lap 14, same session
// Tyres are degraded, driver is managing pace
const driverLap2: DriverLap = {
  track: "Spa-Francorchamps",
  car: "Porsche 963 LMdh",
  totalTime: 136.841,
  sectors: {
    s1: {
      time: 42.105,
      delta: +0.902,
      brakingPoints: [
        {
          turn: "T1 La Source",
          brakeMarker: 96,
          trailBraking: false,
          lockup: false,
          tcActive: false,
        },
      ],
      tyreData: {
        avgSlip: 0.041,
        peakSlip: 0.088,
        avgTemp: { fl: 99, fr: 103, rl: 96, rr: 98 },
      },
      throttleTrace: {
        earlyLift: true,
        smoothApplication: true,
        fullThrottlePercent: 0.71,
      },
    },
    s2: {
      time: 51.203,
      delta: +2.316,
      brakingPoints: [
        {
          turn: "T6 Rivage",
          brakeMarker: 61,
          trailBraking: false,
          lockup: true,
          tcActive: true,
        },
        {
          turn: "T10 Pouhon",
          brakeMarker: 48,
          trailBraking: false,
          lockup: false,
          tcActive: true,
        },
      ],
      tyreData: {
        avgSlip: 0.079,
        peakSlip: 0.168,
        avgTemp: { fl: 108, fr: 112, rl: 104, rr: 107 },
      },
      throttleTrace: {
        earlyLift: false,
        smoothApplication: false,
        fullThrottlePercent: 0.49,
      },
    },
    s3: {
      time: 43.533,
      delta: +0.211,
      brakingPoints: [
        {
          turn: "T14 Stavelot",
          brakeMarker: 58,
          trailBraking: true,
          lockup: false,
          tcActive: false,
        },
        {
          turn: "T18 Bus Stop",
          brakeMarker: 81,
          trailBraking: false,
          lockup: false,
          tcActive: true,
        },
      ],
      tyreData: {
        avgSlip: 0.044,
        peakSlip: 0.091,
        avgTemp: { fl: 101, fr: 105, rl: 98, rr: 100 },
      },
      throttleTrace: {
        earlyLift: true,
        smoothApplication: true,
        fullThrottlePercent: 0.68,
      },
    },
  },
};

// ============================================================
// SECTION 3: ANALYSIS
// ============================================================

/**
 * Detect the primary issue in a sector by examining telemetry clues.
 *
 * Priority:
 * 1. early_lift
 * 2. traction_loss
 * 3. late_braking
 * 4. overcorrection
 */
function detectIssue(
  driverSector: DriverSector,
  refSector: ReferenceSector
): { issue: Issue; details: string } {
  const { brakingPoints, tyreData, throttleTrace } = driverSector;

  if (throttleTrace.earlyLift) {
    return {
      issue: "early_lift",
      details: `Throttle lift detected before braking zone. Full throttle: ${(throttleTrace.fullThrottlePercent * 100).toFixed(0)}%`,
    };
  }

  const hasTcActivation = brakingPoints.some((bp) => bp.tcActive);
  const highSlip = tyreData.peakSlip > 0.1;
  const lowThrottle = throttleTrace.fullThrottlePercent < 0.7;

  if (hasTcActivation && highSlip && lowThrottle) {
    return {
      issue: "traction_loss",
      details: `TC active, peak slip ${tyreData.peakSlip.toFixed(3)}, full throttle only ${(throttleTrace.fullThrottlePercent * 100).toFixed(0)}%`,
    };
  }

  for (let i = 0; i < driverSector.brakingPoints.length; i++) {
    const driverBp = driverSector.brakingPoints[i];
    const refBp = refSector.brakingPoints[i];

    if (!driverBp || !refBp) continue;

    if (driverBp.brakeMarker < refBp.brakeMarker - 8) {
      return {
        issue: "late_braking",
        details: `${driverBp.turn}: braked at ${driverBp.brakeMarker}m vs reference ${refBp.brakeMarker}m`,
      };
    }
  }

  if (tyreData.avgSlip > 0.05 && !hasTcActivation) {
    return {
      issue: "overcorrection",
      details: `High average slip ${tyreData.avgSlip.toFixed(3)} without TC — likely excessive steering input`,
    };
  }

  return {
    issue: "late_braking",
    details: "No single clear cause — general time loss through sector",
  };
}

/**
 * Analyze a driver lap against a reference lap.
 * Returns findings for each sector, sorted by time lost.
 */
function analyzeLap(reference: ReferenceLap, driver: DriverLap): LapAnalysis {
  const sectorKeys = Object.keys(driver.sectors);
  const findings: SectorFinding[] = [];

  for (const key of sectorKeys) {
    const driverSector = driver.sectors[key];
    const refSector = reference.sectors[key];

    if (!driverSector || !refSector) continue;

    const sectorNum = Number.parseInt(key.replace("s", ""), 10);
    const { issue, details } = detectIssue(driverSector, refSector);

    findings.push({
      sector: sectorNum,
      sectorKey: key,
      delta: driverSector.delta,
      issue,
      details,
    });
  }

  // Level 1 fix:
  // Sort by highest time loss first so coaching targets the worst sector.
  findings.sort((a, b) => b.delta - a.delta);

  const totalDelta = findings.reduce((sum, finding) => sum + finding.delta, 0);

  return { findings, totalDelta };
}

// ============================================================
// SECTION 4: COACH
// ============================================================

function generateMessage(finding: SectorFinding, config: Config): string {
  if (config.coachVoice === "pitgpt") {
    return generatePitGPTMessage(finding);
  }
  return generateGenericMessage(finding);
}

function generateGenericMessage(finding: SectorFinding): string {
  const sector = `Sector ${finding.sector}`;
  const delta = `+${finding.delta.toFixed(3)}s`;

  switch (finding.issue) {
    case "late_braking":
      return `${sector} (${delta}): Late braking detected. ${finding.details}. Consider matching reference braking points for more consistent sector times.`;
    case "early_lift":
      return `${sector} (${delta}): Early throttle lift detected. ${finding.details}. Maintain full throttle deeper into the braking zone.`;
    case "traction_loss":
      return `${sector} (${delta}): Traction loss identified. ${finding.details}. Reduce throttle application rate on corner exit.`;
    case "overcorrection":
      return `${sector} (${delta}): Overcorrection detected. ${finding.details}. Reduce steering input to lower tyre scrub.`;
  }
}

function generatePitGPTMessage(finding: SectorFinding): string {
  const delta = finding.delta.toFixed(3);

  switch (finding.issue) {
    case "late_braking":
      return `You're losing ${delta} in sector ${finding.sector}. ${finding.details}. You're overdriving it — brake earlier, carry more speed through the apex. The time is in the exit, not the entry.`;
    case "early_lift":
      return `Sector ${finding.sector}, ${delta} off. You're lifting before the braking zone — keep your foot in, trust the car. That lift is costing you straight-line speed into the corner.`;
    case "traction_loss":
      return `Sector ${finding.sector} is where the lap falls apart — ${delta} lost. TC is fighting you, tyres are sliding. Smooth the throttle on exit. Don't ask for grip that isn't there.`;
    case "overcorrection":
      return `${delta} gone in sector ${finding.sector}. You're sawing at the wheel — the slip numbers show it. Less steering, let the front bite. The car wants to turn, stop fighting it.`;
  }
}

function generateCoaching(analysis: LapAnalysis, config: Config): CoachingOutput {
  const worst = analysis.findings[0];

  if (!worst) {
    return {
      problemSector: 0,
      issue: "late_braking",
      timeLost: 0,
      coachingMessage: "No significant issues found. Clean lap.",
    };
  }

  return {
    problemSector: worst.sector,
    issue: worst.issue,
    timeLost: worst.delta,
    coachingMessage: generateMessage(worst, config),
  };
}

// ============================================================
// SECTION 5: STINT EXTENSION
// ============================================================

function buildLapReport(
  lapLabel: string,
  reference: ReferenceLap,
  lap: DriverLap,
  config: Config
): LapReport {
  const analysis = analyzeLap(reference, lap);
  const coaching = generateCoaching(analysis, config);

  return {
    lapLabel,
    totalTime: lap.totalTime,
    totalDelta: analysis.totalDelta,
    analysis,
    coaching,
  };
}

function getDominantIssue(reports: LapReport[]): Issue | null {
  const counts = new Map<Issue, number>();

  for (const report of reports) {
    const issue = report.coaching.issue;
    counts.set(issue, (counts.get(issue) ?? 0) + 1);
  }

  let dominant: Issue | null = null;
  let maxCount = -1;

  for (const [issue, count] of counts.entries()) {
    if (count > maxCount) {
      dominant = issue;
      maxCount = count;
    }
  }

  return dominant;
}

function summarizeStintPatterns(reports: LapReport[], laps: LapRun[]): StintSummary {
  const patterns: string[] = [];

  if (reports.length === 0) {
    return {
      patterns: ["No laps available for stint summary."],
      dominantIssue: null,
      worstLapLabel: null,
    };
  }

  const dominantIssue = getDominantIssue(reports);

  const worstLap = reports.reduce((worst, current) =>
    current.totalDelta > worst.totalDelta ? current : worst
  );

  const firstLap = laps[0]?.lap;
  const lastLap = laps[laps.length - 1]?.lap;

  if (firstLap && lastLap) {
    const s2First = firstLap.sectors.s2;
    const s2Last = lastLap.sectors.s2;

    if (s2First && s2Last) {
      if (s2Last.tyreData.peakSlip > s2First.tyreData.peakSlip) {
        patterns.push(
          `Traction loss is worsening through the stint: sector 2 peak slip rises from ${s2First.tyreData.peakSlip.toFixed(3)} to ${s2Last.tyreData.peakSlip.toFixed(3)}.`
        );
      }

      if (s2Last.throttleTrace.fullThrottlePercent < s2First.throttleTrace.fullThrottlePercent) {
        patterns.push(
          `Throttle commitment is dropping as the tyres go away: sector 2 full-throttle usage falls from ${(s2First.throttleTrace.fullThrottlePercent * 100).toFixed(0)}% to ${(s2Last.throttleTrace.fullThrottlePercent * 100).toFixed(0)}%.`
        );
      }

      if (s2Last.brakingPoints.some((bp) => bp.tcActive) && s2Last.tyreData.avgTemp.fr > s2First.tyreData.avgTemp.fr) {
        patterns.push(
          `The driver is leaning on the fronts in sector 2. Front-right average temp climbs from ${s2First.tyreData.avgTemp.fr}°C to ${s2Last.tyreData.avgTemp.fr}°C while TC intervention remains present.`
        );
      }
    }

    const s1First = firstLap.sectors.s1;
    const s1Last = lastLap.sectors.s1;
    const s3First = firstLap.sectors.s3;
    const s3Last = lastLap.sectors.s3;

    if (s1First?.throttleTrace.earlyLift === false && s1Last?.throttleTrace.earlyLift === true) {
      patterns.push(
        "Early lift appears later in the stint. The driver is starting to manage entry risk before the braking zone."
      );
    }

    if (s3First?.throttleTrace.earlyLift === false && s3Last?.throttleTrace.earlyLift === true) {
      patterns.push(
        "By the later lap, the driver is compensating with early lift in sector 3 as grip degrades."
      );
    }
  }

  if (dominantIssue) {
    patterns.unshift(`Dominant issue across the stint: ${dominantIssue}.`);
  }

  if (patterns.length === 0) {
    patterns.push("No strong stint-wide pattern detected beyond normal lap-to-lap variation.");
  }

  return {
    patterns,
    dominantIssue,
    worstLapLabel: worstLap.lapLabel,
  };
}

function analyzeStint(
  reference: ReferenceLap,
  laps: LapRun[],
  config: Config
): StintReport {
  const reports = laps.map((lapRun) =>
    buildLapReport(lapRun.label, reference, lapRun.lap, config)
  );

  return {
    laps: reports,
    summary: summarizeStintPatterns(reports, laps),
  };
}

// ============================================================
// RUNNER
// ============================================================

const config: Config = {
  coachVoice: "pitgpt",
  units: "metric",
};

// Level 1 validation target
const singleLapAnalysis = analyzeLap(referenceLap, driverLap);
const singleLapResult = generateCoaching(singleLapAnalysis, config);

console.log("--- PitGPT Single-Lap Analysis ---");
console.log(JSON.stringify(singleLapResult, null, 2));
console.log("----------------------------------");

// --- Validation ---
const checks = [
  { name: "problemSector", pass: singleLapResult.problemSector === 2 },
  {
    name: "issue",
    pass: (["late_braking", "traction_loss"] as string[]).includes(singleLapResult.issue),
  },
  { name: "timeLost", pass: Math.abs(singleLapResult.timeLost - 1.198) < 0.01 },
  {
    name: "coachingMessage",
    pass:
      typeof singleLapResult.coachingMessage === "string" &&
      singleLapResult.coachingMessage.length > 20,
  },
];

checks.forEach((check) => console.log(`${check.pass ? "✅" : "❌"} ${check.name}`));

if (checks.every((check) => check.pass)) {
  console.log("\n✅ Level 1 fix is correct.");
} else {
  console.log("\n❌ Something's off. Look at the output and trace it back.");
}

// Level 2 extension
const stintReport = analyzeStint(
  referenceLap,
  [
    { label: "Lap 1", lap: driverLap },
    { label: "Lap 14", lap: driverLap2 },
  ],
  config
);

console.log("\n--- PitGPT Stint Report ---");
console.log(JSON.stringify(stintReport, null, 2));
console.log("---------------------------");

// Level 3 answer
console.log("\n--- Level 3: Production Notes ---");
console.log(
  [
    "1. The first thing that breaks is in-memory, synchronous processing — session-scale telemetry needs streaming ingestion, partitioning by car/session, and incremental aggregation.",
    "2. I would separate raw telemetry ingestion from derived analysis: append raw events first, then compute sector/lap summaries asynchronously.",
    "3. At 120 Hz across 20+ cars, you need backpressure handling, queueing, and batched writes. Per-frame object-heavy processing in a single process will fall over fast.",
    "4. I'd store high-frequency telemetry in a columnar/time-series path and keep lap/sector/coaching outputs as derived products.",
    "5. Coaching should run off bounded windows or completed sector/lap events, not by rescanning whole sessions repeatedly.",
  ].join("\n")
);