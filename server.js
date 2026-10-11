const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3006;
const ROOT = __dirname;
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const PUBLIC_DIR = path.join(ROOT, 'public');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.static(PUBLIC_DIR));
app.use(express.urlencoded({ extended: true }));

function safeSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveSampleFile(site, sample) {
  const sampleFile = path.join(UPLOADS_DIR, site, sample, 'index.html');
  if (fs.existsSync(sampleFile)) return sampleFile;

  // Older uploads may be stored directly in uploads/<site>/index.html.
  // Keep those reachable at the site's first sample URL while new uploads
  // use the site/sample folder structure.
  const legacyFile = path.join(UPLOADS_DIR, site, 'index.html');
  if (fs.existsSync(legacyFile)) return legacyFile;
  return null;
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    const site = safeSegment(req.body.siteName);
    const sample = safeSegment(req.body.sampleNumber);
    if (!site || !sample) return callback(new Error('Enter a valid site name and sample number.'));
    req.samplePath = path.join(UPLOADS_DIR, site, sample);
    fs.mkdir(req.samplePath, { recursive: true }, (error) => callback(error, req.samplePath));
  },
  filename(req, file, callback) {
    // Keep the current published page intact until the replacement is ready.
    callback(null, `.upload-${crypto.randomUUID()}.tmp`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension !== '.html' && extension !== '.htm') {
      return callback(new Error('Please choose an .html file.'));
    }
    callback(null, true);
  }
});

app.post('/upload', (req, res) => {
  upload.single('htmlFile')(req, res, (error) => {
    if (error) {
      const message = encodeURIComponent(error.code === 'LIMIT_FILE_SIZE' ? 'That file is larger than 5 MB.' : error.message);
      return res.redirect(`/?error=${message}`);
    }
    if (!req.file) return res.redirect('/?error=Choose an HTML file to upload.');
    const site = safeSegment(req.body.siteName);
    const sample = safeSegment(req.body.sampleNumber);
    const publishedFile = path.join(req.samplePath, 'index.html');
    fs.rename(req.file.path, publishedFile, (renameError) => {
      if (renameError) {
        fs.unlink(req.file.path, () => {});
        console.error(renameError.message);
        return res.redirect(`/?error=${encodeURIComponent('The upload could not be published. Please try again.')}`);
      }
      res.redirect(`/?success=${encodeURIComponent(`/${site}/${sample}/`)}`);
    });
  });
});

app.get('/api/samples', (req, res) => {
  const samples = [];
  if (fs.existsSync(UPLOADS_DIR)) {
    for (const site of fs.readdirSync(UPLOADS_DIR, { withFileTypes: true })) {
      if (!site.isDirectory()) continue;
      const sitePath = path.join(UPLOADS_DIR, site.name);
      for (const sample of fs.readdirSync(sitePath, { withFileTypes: true })) {
        if (!sample.isDirectory()) continue;
        const filePath = path.join(sitePath, sample.name, 'index.html');
        if (!fs.existsSync(filePath)) continue;
        const stat = fs.statSync(filePath);
        samples.push({ site: site.name, sample: sample.name, url: `/${site.name}/${sample.name}/`, updatedAt: stat.mtime.toISOString() });
      }
    }
  }
  samples.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  res.json(samples);
});

// Serve each saved index.html as regular HTML at /:site/:sample/.
app.get('/:site/:sample', (req, res, next) => {
  const site = safeSegment(req.params.site);
  const sample = safeSegment(req.params.sample);
  if (!site || !sample) return next();
  const file = resolveSampleFile(site, sample);
  if (!file) return next();
  res.sendFile(file);
});

app.get('/:site/:sample/', (req, res, next) => {
  const site = safeSegment(req.params.site);
  const sample = safeSegment(req.params.sample);
  if (!site || !sample) return next();
  const file = resolveSampleFile(site, sample);
  if (!file) return next();
  res.sendFile(file);
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).send('Something went wrong while handling the upload.');
});

app.listen(PORT, () => console.log(`Sample host running at http://localhost:${PORT}`));
