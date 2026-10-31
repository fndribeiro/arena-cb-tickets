const FORMULA_PREFIXES: ReadonlyArray<string> = ["=", "+", "-", "@", "\t", "\r"];

/** Escapes a CSV cell and neutralizes spreadsheet formula injection (Excel/Sheets). */
export function csvCell(value: string): string {

  const startsWithFormula: boolean = FORMULA_PREFIXES.some((prefix) => value.startsWith(prefix));

  const safe: string = startsWithFormula ? `'${value}` : value;

  return `"${safe.replaceAll('"', '""')}"`;
}

export function csvRow(values: ReadonlyArray<string>): string {
  return values.map(csvCell).join(",");
}
