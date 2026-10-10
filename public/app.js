const form = document.querySelector('#upload-form');
const fileInput = document.querySelector('#html-file');
const dropZone = document.querySelector('#drop-zone');
const fileTitle = document.querySelector('#file-title');
const fileCaption = document.querySelector('#file-caption');
const notice = document.querySelector('#notice');

const params = new URLSearchParams(window.location.search);
if (params.has('error')) {
  notice.textContent = params.get('error');
  notice.className = 'notice error';
  notice.hidden = false;
}
if (params.has('success')) {
  const url = params.get('success') || '';
  notice.textContent = 'Published successfully. ';
  const link = document.createElement('a');
  if (/^\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(url)) {
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open your sample ↗';
    notice.append(link);
  }
  notice.className = 'notice success';
  notice.hidden = false;
}

function showFile(file) {
  if (!file) return;
  fileTitle.innerHTML = `<b>${file.name.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))}</b>`;
  fileCaption.textContent = `${(file.size / 1024).toFixed(0)} KB · ready to publish`;
}
fileInput.addEventListener('change', () => showFile(fileInput.files[0]));
for (const eventName of ['dragenter', 'dragover']) dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('dragover'); });
for (const eventName of ['dragleave', 'drop']) dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  showFile(file);
});

async function loadSamples() {
  const list = document.querySelector('#sample-list');
  try {
    const response = await fetch('/api/samples');
    const samples = await response.json();
    document.querySelector('#sample-total').textContent = samples.length;
    document.querySelector('#nav-count').textContent = samples.length;
    if (!samples.length) return;
    list.innerHTML = samples.map((sample) => {
      const safeUrl = encodeURI(sample.url);
      const date = new Date(sample.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return `<article class="sample-card"><div class="sample-glyph">▧</div><div class="sample-info"><strong>${escapeHtml(sample.site)} <span style="color:#a1aaa3;font-weight:400">/ ${escapeHtml(sample.sample)}</span></strong><small>Updated ${date}</small></div><a class="sample-url" href="${safeUrl}" target="_blank" rel="noopener">${window.location.host}${safeUrl}</a><button class="copy-button" type="button" title="Copy link" data-url="${safeUrl}">⧉</button></article>`;
    }).join('');
    list.querySelectorAll('.copy-button').forEach((button) => button.addEventListener('click', async () => {
      await navigator.clipboard.writeText(`${window.location.origin}${button.dataset.url}`);
      button.textContent = '✓';
      setTimeout(() => { button.textContent = '⧉'; }, 1300);
    }));
  } catch (error) { console.error('Could not load samples', error); }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

form.addEventListener('submit', (event) => {
  if (!fileInput.files.length) return;
  const filename = fileInput.files[0].name.toLowerCase();
  if (!filename.endsWith('.html') && !filename.endsWith('.htm')) {
    event.preventDefault();
    notice.textContent = 'Please choose an .html file.';
    notice.className = 'notice error';
    notice.hidden = false;
  }
});

loadSamples();
