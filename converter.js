// Customer.io (Liquid-like) → HTML converter with basic variable replacement.
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

  // Replace {{ key }} and {{ key | filter: 'x' }} with provided values.
  // Very basic handling of | default: 'value' if key not found.
  convertToHTML(emailHTML, customSampleData = {}) {
    const data = { ...this.defaultSampleData, ...customSampleData };

    // Helper to resolve a key path like a.b.c in data
    const resolve = (key) => {
      if (key in data) return data[key];
      // support nested-like lookup: a.b -> data['a.b'] or data.a?.b
      const parts = key.split('.');
      let cur = data;
      for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) {
          cur = cur[p];
        } else {
          return undefined;
        }
      }
      return cur;
    };

    // Replace variables {{ ... }}
    let html = emailHTML;

    // Match any {{ ... }} block non-greedily
    html = html.replace(/{{\s*([^}]+?)\s*}}/g, (match, inner) => {
      // inner might be: key | default: 'value' | upcase
      const [left, ...filters] = inner.split('|').map(s => s.trim());
      const key = left.replace(/^['"]|['"]$/g, ''); // strip quotes around keys if any
      let val = resolve(key);

      // process filters (only 'default' is supported explicitly)
      if ((val === undefined || val === null || val === '') && filters.length) {
        for (const f of filters) {
          const m = f.match(/^default\s*:\s*(.*)$/i);
          if (m) {
            let raw = m[1].trim();
            // strip surrounding quotes if present
            raw = raw.replace(/^['"]|['"]$/g, '');
            val = raw;
            break;
          }
        }
      }

      // If still undefined, keep original token to make it obvious
      if (val === undefined) return match;
      return String(val);
    });

    return html;
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

fileInput?.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) {
    fileName.textContent = fileInput.files[0].name;
    // If paste area is empty, load the file content into it for visibility
    const reader = new FileReader();
    reader.onload = (e) => { pasteInput.value = String(e.target.result || ''); };
    reader.readAsText(fileInput.files[0]);
  } else {
    fileName.textContent = '';
  }
});

function getTemplateText() {
  const pasted = pasteInput.value.trim();
  if (pasted) return pasted;
  if (fileInput.files && fileInput.files[0]) {
    // Fallback if paste is empty but file provided
    return null; // handled via FileReader earlier
  }
  return '';
}

async function convert() {
  let emailHTML = getTemplateText();
  if (emailHTML === null) {
    // Read from file
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

  const result = converter.convertToHTML(emailHTML, customSampleData);
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

