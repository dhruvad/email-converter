# Update the Customer.io converter with lighter input backgrounds, better-formatted HTML output,
# and an email-style preview wrapper. Then zip for download.
from pathlib import Path
import zipfile

base = Path("/mnt/data/cio_email_converter_v2")
base.mkdir(parents=True, exist_ok=True)

index_html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CIO Email → HTML Converter</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script defer src="converter.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <meta name="color-scheme" content="light dark">
  <style>
    /* Ensure high-contrast inputs regardless of OS/theme */
    textarea, input[type="text"] { background: #ffffff !important; color:#111827 !important; }
    ::placeholder { color:#9CA3AF !important; opacity:1; }
  </style>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">
  <header class="bg-white border-b">
    <div class="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
      <h1 class="text-xl md:text-2xl font-bold">📧 Customer.io Email → HTML Converter</h1>
      <div class="text-xs text-gray-500">Local-only · No data leaves your browser</div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-6 py-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left column: Inputs -->
      <section class="bg-white rounded-lg border p-4 md:p-6">
        <h2 class="font-semibold text-lg mb-3">1) Provide your Customer.io template</h2>
        <div class="space-y-3">
          <label class="block text-sm font-medium">Paste template (HTML or Liquid)</label>
          <textarea id="pasteInput" rows="10" placeholder="Paste your Customer.io email HTML here..." class="w-full border rounded p-3 font-mono text-sm bg-white text-gray-900 placeholder-gray-400"></textarea>

          <div class="flex items-center gap-3">
            <span class="text-sm text-gray-500">or</span>
            <label class="inline-flex items-center gap-2 cursor-pointer px-3 py-2 border rounded bg-gray-50 hover:bg-gray-100">
              <input id="fileInput" type="file" accept=".html,.txt" class="hidden" />
              <span>Upload file</span>
            </label>
            <span id="fileName" class="text-sm text-gray-500"></span>
          </div>

          <label class="block text-sm font-medium mt-2">Optional sample data (JSON)</label>
          <textarea id="sampleData" rows="5" class="w-full border rounded p-3 font-mono text-sm bg-white text-gray-900 placeholder-gray-400" placeholder='{
  "event.customer_name": "Jane Smith",
  "event.vehicle_make": "Toyota",
  "event.license_plate_number": "ABC123",
  "customer.first_name": "Jane"
}'></textarea>

          <div class="flex flex-wrap items-center gap-4 pt-2">
            <label class="inline-flex items-center gap-2 text-sm">
              <input id="wrapEmail" type="checkbox" class="h-4 w-4" checked>
              <span>Wrap with email boilerplate (600px table)</span>
            </label>
            <label class="inline-flex items-center gap-2 text-sm">
              <input id="inlineCss" type="checkbox" class="h-4 w-4" checked>
              <span>Apply basic inline CSS</span>
            </label>
          </div>

          <div class="flex flex-wrap gap-3 pt-2">
            <button id="convertBtn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">🔁 Convert</button>
            <button id="downloadBtn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 hidden">💾 Download HTML</button>
            <button id="copyBtn" class="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 hidden">📋 Copy HTML</button>
            <button id="resetBtn" class="px-4 py-2 bg-white border rounded hover:bg-gray-50">Reset</button>
          </div>
        </div>
      </section>

      <!-- Right column: Outputs -->
      <section class="bg-white rounded-lg border p-4 md:p-6">
        <h2 class="font-semibold text-lg mb-3">2) Result</h2>
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="block text-sm font-medium">Formatted HTML Output</label>
            <textarea id="convertedHTML" class="w-full h-64 border p-3 rounded font-mono text-sm bg-gray-50 text-gray-900" readonly></textarea>
            <p class="text-xs text-gray-500 mt-1">The output is pretty‑printed for readability and includes optional inline CSS and a 600px email wrapper.</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Live Email‑style Preview</label>
            <!-- sandbox prevents external script execution -->
            <iframe id="previewFrame" class="w-full h-[32rem] border rounded bg-white" sandbox=""></iframe>
          </div>
        </div>
      </section>
    </div>

    <section class="mt-6 bg-white rounded-lg border p-4 md:p-6">
      <h3 class="font-semibold mb-2">Notes</h3>
      <ul class="list-disc pl-6 text-sm text-gray-700 space-y-1">
        <li>Supports simple <code>{{ '{' }}{ variable }}</code> substitutions and <code>default</code> filter (e.g., <code>{{ '{' }}{ name | default: 'there' }}</code>).</li>
        <li>Preview uses a standard 600px table layout with web‑safe fonts for a CRM‑like appearance.</li>
        <li>Emails are best built with tables and inline CSS for broad client support.</li>
      </ul>
    </section>
  </main>

  <footer class="text-center text-xs text-gray-500 py-8">
    Built for static hosting (GitHub Pages). No data leaves your browser.
  </footer>
</body>
</html>
"""

converter_js = r"""// Customer.io (Liquid-like) → HTML converter with better formatting and an email wrapper.
class CustomerIOHTMLConverter {
  constructor() {
    this.defaultSampleData = {
      'event.customer_name': 'John Doe',
      'event.vehicle_make': 'Toyota Prius',
      'event.license_plate_number': 'ABC123',
      'customer.first_name': 'John',
      'customer.last_name': 'Doe',
      'now': new Date().toISOString(),
      'year': new Date().getFullYear().toString()
    };
  }

  // Basic Liquid-style variable replacement with support for | default: 'value'
  convertLiquid(html, data) {
    const resolve = (key) => {
      if (key in data) return data[key];
      // try nested access (a.b.c)
      const parts = key.split('.');
      let cur = data;
      for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
        else return undefined;
      }
      return cur;
    };

    return html.replace(/{{\s*([^}]+?)\s*}}/g, (match, inner) => {
      const [left, ...filters] = inner.split('|').map(s => s.trim());
      const key = left.replace(/^['"]|['"]$/g, '');
      let val = resolve(key);

      // Apply 'default' filter if value is missing/empty
      if ((val === undefined || val === null || val === '') && filters.length) {
        for (const f of filters) {
          const m = f.match(/^default\s*:\s*(.*)$/i);
          if (m) {
            let raw = m[1].trim();
            raw = raw.replace(/^['"]|['"]$/g, '');
            val = raw;
            break;
          }
        }
      }
      return (val === undefined) ? match : String(val);
    });
  }

  // Pretty-print HTML for readability (simple indentation; email-safe).
  prettyHtml(input) {
    const tokens = input
      .replace(/>\s+</g, '><') // collapse whitespace between tags
      .replace(/\r\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .split(/(?=<)|(?<=>)/g)
      .filter(Boolean);

    const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
    let indent = 0;
    const lines = [];

    for (let t of tokens) {
      if (!t.trim()) continue;
      if (t.startsWith('</')) {
        indent = Math.max(indent - 1, 0);
      }
      const pad = '  '.repeat(indent);
      lines.push(pad + t.trim());
      if (t.startsWith('<') && !t.startsWith('</') && !t.endsWith('/>')) {
        const tag = (t.match(/^<\s*([a-zA-Z0-9-]+)/) || [])[1];
        if (tag && !voidTags.has(tag.toLowerCase())) {
          if (!t.includes(`</${tag}`)) indent += 1;
        }
      }
    }
    return lines.join('\n');
  }

  // Wrap the inner content with a classic CRM-style 600px table layout and inline CSS
  emailWrapper(inner, applyInlineCss = true) {
    const baseCss = applyInlineCss ? `
      body { margin:0; padding:0; background:#F3F4F6; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table { border-collapse:collapse; }
      img { border:0; line-height:100%; outline:none; text-decoration:none; max-width:100%; height:auto; display:block; }
      .container { width:100%; background:#F3F4F6; padding:24px 0; }
      .main { width:100%; max-width:600px; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; }
      .p-24 { padding:24px; }
      .footer { color:#6B7280; font-size:12px; text-align:center; padding:16px 0; }
      .h1 { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif; font-size:24px; font-weight:700; color:#111827; margin:0 0 12px 0; }
      .text { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif; font-size:16px; line-height:1.5; color:#111827; }
      .muted { color:#6B7280; font-size:14px; }
      .btn a { background:#2563EB; color:#ffffff !important; text-decoration:none; padding:10px 16px; border-radius:6px; display:inline-block; }
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Email</title>
  ${applyInlineCss ? `<style>${baseCss}</style>` : ''}
</head>
<body>
  <table role="presentation" class="container" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table role="presentation" class="main" cellpadding="0" cellspacing="0">
          <tr>
            <td class="p-24">
              ${inner}
            </td>
          </tr>
        </table>
        <div class="footer">You are receiving this email as part of a workflow. © ${new Date().getFullYear()}</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  convertToHTML(emailHTML, customSampleData = {}, options = { wrap: true, inlineCss: true }) {
    const data = { ...this.defaultSampleData, ...customSampleData };
    let result = this.convertLiquid(emailHTML, data);
    if (options.wrap) {
      result = this.emailWrapper(result, options.inlineCss);
    }
    return this.prettyHtml(result);
  }
}

const converter = new CustomerIOHTMLConverter();

const $ = (id) => document.getElementById(id);

const fileInput = $('fileInput');
const fileName = $('fileName');
const pasteInput = $('pasteInput');
const sampleDataInput = $('sampleData');
const convertedBox = $('convertedHTML');
const convertBtn = $('convertBtn');
const downloadBtn = $('downloadBtn');
const copyBtn = $('copyBtn');
const resetBtn = $('resetBtn');
const previewFrame = $('previewFrame');
const wrapEmail = $('wrapEmail');
const inlineCss = $('inlineCss');

fileInput?.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) {
    fileName.textContent = fileInput.files[0].name;
    const reader = new FileReader();
    reader.onload = (e) => { if (!pasteInput.value.trim()) pasteInput.value = String(e.target.result || ''); };
    reader.readAsText(fileInput.files[0]);
  } else {
    fileName.textContent = '';
  }
});

function getTemplateText() {
  const pasted = pasteInput.value.trim();
  if (pasted) return pasted;
  if (fileInput.files && fileInput.files[0]) return null;
  return '';
}

async function convert() {
  let emailHTML = getTemplateText();
  if (emailHTML === null) {
    const file = fileInput.files[0];
    emailHTML = await file.text();
  }
  if (!emailHTML) {
    alert('Please paste a template or upload a file.');
    return;
  }

  let customSampleData = {};
  try {
    customSampleData = JSON.parse(sampleDataInput.value || '{}');
  } catch (e) {
    alert('Sample data is not valid JSON.');
    return;
  }

  const result = converter.convertToHTML(emailHTML, customSampleData, {
    wrap: wrapEmail.checked,
    inlineCss: inlineCss.checked
  });
  convertedBox.value = result;

  // Live preview (sandboxed)
  previewFrame.srcdoc = result;

  downloadBtn.classList.remove('hidden');
  copyBtn.classList.remove('hidden');

  downloadBtn.onclick = () => {
    const blob = new Blob([result], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted_email.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(result);
      copyBtn.textContent = '✅ Copied';
      setTimeout(() => (copyBtn.textContent = '📋 Copy HTML'), 1200);
    } catch {
      alert('Copy failed. You can select and copy from the textbox.');
    }
  };
}

convertBtn.addEventListener('click', () => convert());

resetBtn.addEventListener('click', () => {
  pasteInput.value = '';
  sampleDataInput.value = '';
  convertedBox.value = '';
  previewFrame.srcdoc = '';
  fileInput.value = '';
  fileName.textContent = '';
  downloadBtn.classList.add('hidden');
  copyBtn.classList.add('hidden');
});
"""

# Write files
(index_html_path := base / "index.html").write_text(index_html, encoding="utf-8")
(converter_js_path := base / "converter.js").write_text(converter_js, encoding="utf-8")

# Zip for the user
zip_path = "/mnt/data/cio_email_converter_v2.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    z.write(index_html_path, arcname="index.html")
    z.write(converter_js_path, arcname="converter.js")

zip_path
