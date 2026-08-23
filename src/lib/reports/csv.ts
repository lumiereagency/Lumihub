export interface CsvColumn<T> {
  key: keyof T;
  label: string;
  format?: (value: T[keyof T], row: T) => string;
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const raw = row[c.key];
        const formatted = c.format ? c.format(raw, row) : String(raw ?? "");
        return escapeCsvField(formatted);
      })
      .join(","),
  );
  return [header, ...lines].join("\n");
}
