import airports from "./airports.json"

const iataToIcao = airports as Record<string, string>

/** ICAO code for an IATA airport code, or undefined if unknown. */
export function toIcao(iata: string): string | undefined {
  return iataToIcao[iata]
}
