
// Basic implementation of CustomerIOHTMLConverter class
class CustomerIOHTMLConverter {
  constructor() {
    this.sampleData = {
      'event.customer_name': 'John Doe',
      'event.vehicle_make': 'Toyota Prius',
      'event.license_plate_number': 'ABC123',
      '"now" | date: "%Y"': new Date().getFullYear().toString()
    };
  }

  convertToHTML(emailHTML, customSampleData = {}) {
    const data = { ...this.sampleData, ...customSampleData };
    let html = emailHTML;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\s*${key}\s*}}`, 'g');
      html = html.replace(regex, value);
    }
    return html;
  }
}

const converter = new CustomerIOHTMLConverter();

document.getElementById('convertBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('fileInput');
  const sampleDataInput = document.getElementById('sampleData');
  const originalBox = document.getElementById('originalHTML');
  const convertedBox = document.getElementById('convertedHTML');
  const downloadBtn = document.getElementById('downloadBtn');

  const file = fileInput.files[0];
  if (!file) {
    alert("Please upload a Customer.io template file.");
    return;
  }

  const emailHTML = await file.text();
  originalBox.value = emailHTML;

  let customSampleData = {};
  try {
    customSampleData = JSON.parse(sampleDataInput.value || '{}');
  } catch (e) {
    alert("Sample data is not valid JSON.");
    return;
  }

  const result = converter.convertToHTML(emailHTML, customSampleData);
  convertedBox.value = result;

  downloadBtn.classList.remove('hidden');
  downloadBtn.onclick = () => {
    const blob = new Blob([result], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted_email.html';
    a.click();
    URL.revokeObjectURL(url);
  };
});
