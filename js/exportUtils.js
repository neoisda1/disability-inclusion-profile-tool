// Client-side only export helpers. Nothing is uploaded anywhere - files are generated
// in the browser and handed to the browser's normal file-download mechanism.

const EXPORT_FOOTER = "AI-assisted preparation document. Not an official Victorian Department of Education Disability Inclusion Profile.";

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportJSON(filename, data) {
  download(filename, JSON.stringify(data, null, 2), "application/json");
}

export function exportCSV(filename, rows) {
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(esc).join(",")).join("\r\n");
  download(filename, csv, "text/csv");
}

// Produces a .doc file using Word-compatible HTML - opens directly in Microsoft Word,
// with no extra libraries required.
export function exportDoc(filename, title, bodyHtml, options) {
  const showFooter = !options || options.footer !== false;
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"><title>${title}</title></head>
  <body style="font-family:Calibri, Arial, sans-serif; font-size:11pt;">
  <h1>${title}</h1>
  ${showFooter ? `<p style="color:#7a1f1f;"><em>${EXPORT_FOOTER}</em></p>` : ""}
  ${bodyHtml}
  </body></html>`;
  download(filename, html, "application/msword");
}

export function printSection(html, title) {
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <link rel="stylesheet" href="css/styles.css">
  <style>body{padding:2rem;} .no-print{display:none;}</style>
  </head><body>${html}<p><em>${EXPORT_FOOTER}</em></p></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export { EXPORT_FOOTER };
