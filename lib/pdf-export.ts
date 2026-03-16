// ================================================================
// PDF Export — HTML-based PDF generation
// ================================================================
// Generates a styled HTML table from export data that can be
// printed to PDF via the browser's print dialog or a headless renderer.

export interface PdfExportOptions {
  title: string;
  headers: string[];
  rows: Record<string, any>[];
  generatedAt?: string;
}

/**
 * Generate a self-contained HTML document styled for print-to-PDF.
 * Returns a full HTML string with inline styles.
 */
export function generatePdfHtml(options: PdfExportOptions): string {
  const { title, headers, rows, generatedAt } = options;
  const timestamp = generatedAt || new Date().toISOString();

  const escapeHtml = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const headerCells = headers
    .map(h => `<th style="border:1px solid #d1d5db;padding:8px 12px;background:#1B2A4A;color:#fff;font-size:12px;text-align:left;white-space:nowrap;">${escapeHtml(h)}</th>`)
    .join('');

  const bodyRows = rows
    .map((row, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      const cells = headers
        .map(h => `<td style="border:1px solid #d1d5db;padding:6px 12px;font-size:11px;color:#374151;">${escapeHtml(row[h])}</td>`)
        .join('');
      return `<tr style="background:${bg};">${cells}</tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)} — Solis OS Export</title>
<style>
  @media print {
    body { margin: 0; }
    .no-print { display: none; }
  }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; color: #111827; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #6b7280; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">Generated: ${escapeHtml(timestamp)} · ${rows.length} row(s)</div>
<table>
<thead><tr>${headerCells}</tr></thead>
<tbody>
${bodyRows}
</tbody>
</table>
</body>
</html>`;
}

/**
 * Convert CSV export data (from analytics-export.ts format) into PDF HTML.
 */
export function exportDataAsPdf(data: { csv: string; entity: string; generatedAt: string }): string {
  const lines = data.csv.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    return generatePdfHtml({ title: data.entity, headers: [], rows: [] });
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const row: Record<string, any> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });

  return generatePdfHtml({
    title: `${data.entity} Export`,
    headers,
    rows,
    generatedAt: data.generatedAt,
  });
}

/** Simple CSV line parser (handles quoted fields) */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
