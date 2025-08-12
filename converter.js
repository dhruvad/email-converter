// Customer.io → HTML converter with i18n, pretty formatting, email wrapper, and cache-busting reset.
const APP_VERSION = '2025.08.12';

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

    // Built-in translations (override via sample JSON's i18n property)
    this.i18n = {
      en: {
        greeting: 'Hello',
        regards: 'Regards',
        button_view_account: 'View account',
        cta_confirm: 'Confirm',
        cta_reset: 'Reset password',
        cta_view_booking: 'View booking',
        footer_unsub: 'Unsubscribe',
        subject_generic: 'Important account information',
        intro_line: 'Here’s a summary of your request.'
      },
      de: {
        greeting: 'Hallo',
        regards: 'Mit freundlichen Grüßen',
        button_view_account: 'Konto anzeigen',
        cta_confirm: 'Bestätigen',
        cta_reset: 'Passwort zurücksetzen',
        cta_view_booking: 'Buchung anzeigen',
        footer_unsub: 'Abbestellen',
        subject_generic: 'Wichtige Kontoinformationen',
        intro_line: 'Hier ist eine Zusammenfassung Ihrer Anfrage.'
      },
      fr: {
        greeting: 'Bonjour',
        regards: 'Cordialement',
        button_view_account: 'Voir le compte',
        cta_confirm: 'Confirmer',
        cta_reset: 'Réinitialiser le mot de passe',
        cta_view_booking: 'Voir la réservation',
        footer_unsub: 'Se désabonner',
        subject_generic: 'Informations importantes sur votre compte',
        intro_line: 'Voici un récapitulatif de votre demande.'
      },
      sv: {
        greeting: 'Hej',
        regards: 'Vänliga hälsningar',
        button_view_account: 'Visa konto',
        cta_confirm: 'Bekräfta',
        cta_reset: 'Återställ lösenord',
        cta_view_booking: 'Visa bokning',
        footer_unsub: 'Avsluta prenumeration',
        subject_generic: 'Viktig kontoinformation',
        intro_line: 'Här är en sammanfattning av din begäran.'
      },
      da: {
        greeting: 'Hej',
        regards: 'Venlig hilsen',
        button_view_account: 'Se konto',
        cta_confirm: 'Bekræft',
        cta_reset: 'Nulstil adgangskode',
        cta_view_booking: 'Se booking',
        footer_unsub: 'Afmeld',
        subject_generic: 'Vigtig kontoinformation',
        intro_line: 'Her er et resumé af din anmodning.'
      },
      no: {
        greeting: 'Hei',
        regards: 'Vennlig hilsen',
        button_view_account: 'Se konto',
        cta_confirm: 'Bekreft',
        cta_reset: 'Tilbakestill passord',
        cta_view_booking: 'Se bestilling',
        footer_unsub: 'Meld deg av',
        subject_generic: 'Viktig kontoinformasjon',
        intro_line: 'Her er et sammendrag av forespørselen din.'
      }
    };
  }

  // Resolve language from payload JSON
  resolveLang(sample) {
    const candidates = [
      sample?.language,
      sample?.locale,
      sample?.['event.language'],
      sample?.['event.locale'],
      sample?.event?.language,
      sample?.event?.locale,
      sample?.customer?.language,
      sample?.customer?.locale
    ].filter(Boolean);

    let lang = (candidates[0] || 'en').toString().toLowerCase();
    if (lang.includes('-')) lang = lang.split('-')[0];   // en-US -> en
    if (['nb', 'nn'].includes(lang)) lang = 'no';        // Norwegian variants
    if (!['en','de','fr','sv','da','no'].includes(lang)) lang = 'en';
    return lang;
  }

  // Merge built-ins with overrides
  buildDictionary(lang, sample) {
    const overrides = (sample && sample.i18n && sample.i18n[lang]) ? sample.i18n[lang] : {};
    return { ...(this.i18n[lang] || this.i18n.en), ...overrides };
  }

  // Liquid-style replacement + i18n
  convertLiquid(html, data, langDict) {
    const resolve = (key) => {
      if (key in data) return data[key];
      const parts = key.split('.');
      let cur = data;
      for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) cur = cur[p];
        else return undefined;
      }
      return cur;
    };

    return html.replace(/{{\s*([^}]+?)\s*}}/g, (match, inner) => {
      // supports: {{ 'greeting' | t }}  OR  {{ t 'greeting' }}  OR  {{ event.customer_name | default: 'there' }}
      const parts = inner.split('|').map(s => s.trim());
      let left = parts.shift();

      // t as function: {{ t 'key' }}
      const tFn = left.match(/^t\s+(.+)$/i);
      if (tFn) {
        let raw = tFn[1].trim().replace(/^['"]|['"]$/g, '');
        return (langDict[raw] ?? raw);
      }

      // normal variable key (or quoted string)
      let key = left.replace(/^['"]|['"]$/g, '');
      let val = resolve(key);

      // translation filter
      if (parts.some(p => p === 't')) {
        const k = (typeof val === 'string' && val) ? val : key;
        return (langDict[k] ?? k);
      }

      // default: 'x' filter
      for (const f of parts) {
        const m = f.match(/^default\s*:\s*(.*)$/i);
        if (m && (val === undefined || val === null || val === '')) {
          let raw = m[1].trim().replace(/^['"]|['"]$/g, '');
          val = raw;
          break;
        }
      }

      return (val === undefined) ? match : String(val);
    });
  }

  // Pretty-print HTML (email-safe indentation)
  prettyHtml(input) {
    const tokens = input
      .replace(/>\s+</g, '><')
      .replace(/\r\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .split(/(?=<)|(?<=>)/g)
      .filter(Boolean);

    const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
    let indent = 0;
    const lines = [];

    for (let t of tokens) {
      if (!t.trim()) continue;
      if (t.startsWith('</')) indent = Math.max(indent - 1, 0);
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

  // 600px email wrapper with inline CSS (for a CRM-like look)
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
    const lang = this.resolveLang(customSampleData || {});
    const dict = this.buildDictionary(lang, customSampleData || {});

    // reflect detected language in UI
    try {
      const badge = document.getElementById('langBadge');
      if (badge) badge.textContent = `lang: ${lang}`;
    } catch {}

    let result = this.convertLiquid(emailHTML, data, dict);
    if (options.wrap) result = this.emailWrapper(result, options.inlineCss);
    return this.prettyHtml(result);
  }
}

// --- UI wiring + cache-busting reset ---
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
    wrap: wrapEmail?.checked ?? true,
    inlineCss: inlineCss?.checked ?? true
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

// Reset: clear UI + bust caches by reloading with a timestamp query param
resetBtn.addEventListener('click', () => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}
  if (pasteInput) pasteInput.value = '';
  if (sampleDataInput) sampleDataInput.value = '';
  if (convertedBox) convertedBox.value = '';
  if (previewFrame) previewFrame.srcdoc = '';
  if (fileInput) fileInput.value = '';
  if (fileName) fileName.textContent = '';
  if (downloadBtn) downloadBtn.classList.add('hidden');
  if (copyBtn) copyBtn.classList.add('hidden');

  const url = new URL(window.location.href);
  url.searchParams.set('ts', Date.now().toString());
  window.location.replace(url.toString());
});
