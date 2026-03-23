# RACEMAKE Basic Challenge

## What I changed

### Level 1
Fixed a bug in lap analysis:
- sector findings were sorted in ascending delta order
- this caused coaching to focus on the least costly sector
- fixed by sorting in descending delta order

### Level 2
Extended the existing pipeline to support multiple laps:
- per-lap analysis for both driver laps
- coaching output for each lap
- stint summary describing issue progression across the stint

### Level 3
Included short production notes on what breaks first at session scale and how I would restructure ingestion and analysis.

## Run

```bash
bun run challenge-basic.ts
```

## Expected outcome

- Level 1 validation passes
- Worst sector for the first lap is Sector 2
- Main issue on Lap 1 is traction loss
- Lap 14 shows worsening sector 2 degradation plus later-lap early lift patterns