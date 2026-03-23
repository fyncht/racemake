# RACEMAKE Hard Challenge — PitGPT Telemetry API

Bun + Hono API that ingests raw simulator telemetry, computes completed lap summaries, and produces a coaching-style analysis against the best lap in the stint.

## Endpoints

- `GET /health` — health check
- `POST /ingest` — stores telemetry in memory and returns `{ laps, frames }`
- `GET /laps` — returns completed lap summaries
- `GET /analysis` — compares laps to the best lap and identifies the dominant issue in the worst sector of the worst lap

## Edge cases handled

- Excludes the out-lap if the first frame starts away from start/finish
- Excludes the incomplete final lap if it does not return near the finish line
- Filters stationary / pit-stop frames where speed is below 5 and track position does not change

## Design decisions

### Sector timing uses interpolation
Telemetry is sampled discretely, so sector boundaries do not align exactly with `0.333` and `0.667`.  
I interpolate boundary crossing timestamps between adjacent frames instead of using nearest-sample cuts.

### Stationary frames are removed before analytics
Pit-stop / stationary frames are filtered before lap analytics so they do not distort completed lap detection, average speed, or sector variance.

### Issue classification is deterministic
The worst sector of the worst lap is compared directly against the same sector on the best lap.  
The issue is then classified using explicit telemetry rules rather than opaque heuristics.

## Run

```bash
bun install
bun run challenge-hard.ts 
```
or
```bash
bun run start
```

## Example usage

```bash
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  --data-binary @telemetry.json

curl http://localhost:3000/laps
curl http://localhost:3000/analysis
```

## Example usage and output

```bash
curl http://localhost:3000/health
```
{"ok":true}    
```bash
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  --data-binary @telemetry.json
```
{"laps":3,"frames":166}
```bash
curl http://localhost:3000/laps
```
[{"lapNumber":1,"lapTime":133.2,"sectors":[{"sector":1,"time":43.6},{"sector":2,"time":47.4},{"sector":3,"time":42.2}],"avgSpeed":227.907,"maxSpeed":291},{"lapNumber":2,"lapTime":132.8,"sectors":[{"sector":1,"time":42.953},{"sector":2,"time":47.147},{"sector":3,"time":42.7}],"avgSpeed":230.605,"maxSpeed":292},{"lapNumber":3,"lapTime":137.4,"sectors":[{"sector":1,"time":44.422},{"sector":2,"time":50.973},{"sector":3,"time":42.005}],"avgSpeed":217.5,"maxSpeed":286}]
```bash
curl http://localhost:3000/analysis
```
{"bestLap":{"lapNumber":2,"lapTime":132.8},"worstLap":{"lapNumber":3,"lapTime":137.4,"delta":4.6},"problemSector":2,"issue":"tyre_overheat","coachingMessage":"Sector 2 is killing your lap. You're overheating the tyres and paying for it mid-corner. Calm the inputs. Protect the fronts."}

