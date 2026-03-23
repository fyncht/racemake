import { writeFileSync } from "fs";
import { telemetry } from "./telemetry";

writeFileSync("telemetry.json", JSON.stringify(telemetry, null, 2));
console.log("telemetry.json written");