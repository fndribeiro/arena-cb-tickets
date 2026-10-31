export const APP_TIME_ZONE = "America/Sao_Paulo";

/** Brazil abolished DST in 2019, so São Paulo is a fixed UTC-3 offset. */
const APP_UTC_OFFSET = "-03:00";

const LOCAL_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Parses an <input type="datetime-local"> value typed in São Paulo time. Returns null when malformed. */
export function parseLocalDateTime(value: string): Date | null {

  if (!LOCAL_DATETIME_PATTERN.test(value)) {
    return null;
  }

  const date = new Date(`${value}:00${APP_UTC_OFFSET}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(date: Date): string {
  return DATE_TIME_FORMATTER.format(date);
}
