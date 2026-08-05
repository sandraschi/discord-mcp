export function exportJSON<T>(data: T, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  downloadBlob(
    blob,
    filename.endsWith(".json") ? filename : `${filename}.json`,
  );
}

export function exportCSV(
  rows: Record<string, unknown>[],
  filename: string,
): void {
  if (rows.length === 0) {
    const blob = new Blob([""], { type: "text/csv" });
    downloadBlob(
      blob,
      filename.endsWith(".csv") ? filename : `${filename}.csv`,
    );
    return;
  }
  const headers = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r))),
  ) as string[];
  const line = (row: Record<string, unknown>) =>
    headers
      .map((h) => {
        const v = row[h];
        const s = v === null || v === undefined ? "" : String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      })
      .join(",");
  const csv = [headers.join(","), ...rows.map(line)].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
