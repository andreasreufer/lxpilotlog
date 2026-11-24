// Builds src/lib/airports.json (IATA -> ICAO) from the public-domain
// OurAirports dataset. Run with: node scripts/build-airports.mjs
import { writeFileSync } from "node:fs"

const res = await fetch("https://davidmegginson.github.io/ourairports-data/airports.csv")
const lines = (await res.text()).trim().split("\n")
const header = parseCsvLine(lines[0])
const col = (name) => header.indexOf(name)
const [iCode, iIata, iSched] = [col("ident"), col("iata_code"), col("scheduled_service")]

const map = {}
for (const line of lines.slice(1)) {
  const r = parseCsvLine(line)
  const iata = r[iIata]
  if (!iata || r[iSched] !== "yes" || !/^[A-Z]{4}$/.test(r[iCode])) continue
  map[iata] ??= r[iCode]
}
const sorted = Object.fromEntries(Object.entries(map).sort())
writeFileSync(new URL("../src/lib/airports.json", import.meta.url), JSON.stringify(sorted) + "\n")
console.log(`${Object.keys(sorted).length} airports`)

function parseCsvLine(line) {
  const out = []
  let cur = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') quoted = false
      else cur += c
    } else if (c === '"') quoted = true
    else if (c === ",") {
      out.push(cur)
      cur = ""
    } else cur += c
  }
  out.push(cur)
  return out
}
