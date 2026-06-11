#!/usr/bin/env node
/**
 * Static Site Deployer Server
 * 
 * A lightweight self-hosted static site deployment API.
 * - POST /api/deploy - upload a zip file
 * - POST /api/deploy/html - deploy raw HTML content
 * - GET /api/sites - list all deployed sites
 * - GET /api/sites/:id - get site details
 * - DELETE /api/sites/:id - delete a site
 * - Static serving on separate port
 */

const express = require('express');
const multer = require('multer');
const unzipper = require('unzipper');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ========== Configuration ==========

const CONFIG = {
  // API server port
  apiPort: parseInt(process.env.STATIC_API_PORT || '3456', 10),
  // Static file serving port
  staticPort: parseInt(process.env.STATIC_SERVE_PORT || '3457', 10),
  // Where to store deployed sites
  sitesDir: process.env.STATIC_SITES_DIR || path.join(__dirname, '..', '..', '..', 'static-sites'),
  // Auth token (empty = no auth)
  authToken: process.env.STATIC_AUTH_TOKEN || '',
  // Max upload size (50MB)
  maxFileSize: parseInt(process.env.STATIC_MAX_SIZE || '52428800', 10),
  // Public base URL
  publicUrl: process.env.STATIC_PUBLIC_URL || `http://localhost:3457`,
  // Allowed origins for CORS
  corsOrigins: process.env.STATIC_CORS || '*',
};

// ========== Setup ==========

// Ensure sites directory exists
if (!fs.existsSync(CONFIG.sitesDir)) {
  fs.mkdirSync(CONFIG.sitesDir, { recursive: true });
}

const upload = multer({
  dest: path.join(CONFIG.sitesDir, '_uploads'),
  limits: { fileSize: CONFIG.maxFileSize },
});

// Ensure upload temp dir exists
const uploadsDir = path.join(CONFIG.sitesDir, '_uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ========== Auth Middleware ==========

function requireAuth(req, res, next) {
  if (!CONFIG.authToken) return next(); // No auth configured
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== CONFIG.authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ========== API App ==========

const apiApp = express();
apiApp.use(cors({ origin: CONFIG.corsOrigins }));
apiApp.use(express.json());
apiApp.use(express.urlencoded({ extended: true }));

// Health check
apiApp.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// === POST /api/deploy - Upload zip ===
apiApp.post('/api/deploy', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Send a zip file as multipart/form-data with field name "file".' });
    }

    const siteId = req.body.id || uuidv4().slice(0, 8);
    const siteDir = path.join(CONFIG.sitesDir, sanitizeId(siteId));

    if (fs.existsSync(siteDir)) {
      return res.status(409).json({ error: `Site "${siteId}" already exists` });
    }

    // Extract zip
    await extractZip(req.file.path, siteDir);
    
    // Cleanup upload
    fs.unlinkSync(req.file.path);

    // Find index file
    const indexFile = findIndexFile(siteDir);
    
    const site = {
      id: siteId,
      url: `${CONFIG.publicUrl}/${siteId}`,
      indexPath: indexFile ? `/${siteId}/${indexFile}` : null,
      deployedAt: new Date().toISOString(),
      fileCount: countFiles(siteDir),
    };

    // Save metadata
    fs.writeFileSync(
      path.join(siteDir, '.site-meta.json'),
      JSON.stringify(site, null, 2)
    );

    res.status(201).json(site);
  } catch (err) {
    console.error('Deploy error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === POST /api/deploy/html - Deploy raw HTML ===
apiApp.post('/api/deploy/html', requireAuth, (req, res) => {
  try {
    const { content, filename, id } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Missing "content" (HTML string)' });
    }

    const siteId = id ? sanitizeId(id) : uuidv4().slice(0, 8);
    const siteDir = path.join(CONFIG.sitesDir, siteId);

    if (fs.existsSync(siteDir)) {
      return res.status(409).json({ error: `Site "${siteId}" already exists` });
    }

    fs.mkdirSync(siteDir, { recursive: true });
    fs.writeFileSync(path.join(siteDir, filename || 'index.html'), content);

    const site = {
      id: siteId,
      url: `${CONFIG.publicUrl}/${siteId}`,
      indexPath: `/${siteId}/${filename || 'index.html'}`,
      deployedAt: new Date().toISOString(),
      fileCount: 1,
    };

    fs.writeFileSync(
      path.join(siteDir, '.site-meta.json'),
      JSON.stringify(site, null, 2)
    );

    res.status(201).json(site);
  } catch (err) {
    console.error('Deploy HTML error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === GET /api/sites - List all sites ===
apiApp.get('/api/sites', requireAuth, (req, res) => {
  try {
    const sites = fs.readdirSync(CONFIG.sitesDir)
      .filter(name => !name.startsWith('_') && !name.startsWith('.'))
      .filter(name => {
        // Skip known non-site files
        const fullPath = path.join(CONFIG.sitesDir, name);
        try { return fs.statSync(fullPath).isDirectory(); } catch { return false; }
      })
      .map(name => {
        const metaPath = path.join(CONFIG.sitesDir, name, '.site-meta.json');
        if (fs.existsSync(metaPath)) {
          return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        }
        return {
          id: name,
          url: `${CONFIG.publicUrl}/${name}`,
          deployedAt: null,
          fileCount: countFiles(path.join(CONFIG.sitesDir, name)),
        };
      })
      .sort((a, b) => {
        if (!a.deployedAt) return 1;
        if (!b.deployedAt) return -1;
        return new Date(b.deployedAt) - new Date(a.deployedAt);
      });

    res.json({ sites, total: sites.length });
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === GET /api/sites/:id - Get site details ===
apiApp.get('/api/sites/:id', requireAuth, (req, res) => {
  try {
    const siteDir = path.join(CONFIG.sitesDir, sanitizeId(req.params.id));
    if (!fs.existsSync(siteDir)) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const metaPath = path.join(siteDir, '.site-meta.json');
    const site = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      : { id: req.params.id, url: `${CONFIG.publicUrl}/${req.params.id}` };

    site.fileCount = countFiles(siteDir);
    site.files = listFiles(siteDir);

    res.json(site);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === DELETE /api/sites/:id - Delete a site ===
apiApp.delete('/api/sites/:id', requireAuth, (req, res) => {
  try {
    const siteDir = path.join(CONFIG.sitesDir, sanitizeId(req.params.id));
    if (!fs.existsSync(siteDir)) {
      return res.status(404).json({ error: 'Site not found' });
    }

    fs.rmSync(siteDir, { recursive: true, force: true });
    res.json({ message: `Site "${req.params.id}" deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === POST /api/deploy/url - Deploy from URL ===
apiApp.post('/api/deploy/url', requireAuth, async (req, res) => {
  try {
    const { url, id } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing "url" parameter' });
    }

    const siteId = id ? sanitizeId(id) : uuidv4().slice(0, 8);
    const siteDir = path.join(CONFIG.sitesDir, siteId);

    if (fs.existsSync(siteDir)) {
      return res.status(409).json({ error: `Site "${siteId}" already exists` });
    }

    // Download the zip
    const response = await new Promise((resolve, reject) => {
      http.get(url, resolve).on('error', reject);
    });

    if (response.statusCode !== 200) {
      return res.status(400).json({ error: `Failed to download: HTTP ${response.statusCode}` });
    }

    // Stream to temp file
    const tmpFile = path.join(uploadsDir, uuidv4());
    const ws = fs.createWriteStream(tmpFile);
    response.pipe(ws);

    await new Promise((resolve, reject) => {
      ws.on('finish', resolve);
      ws.on('error', reject);
    });

    // Extract
    await extractZip(tmpFile, siteDir);
    fs.unlinkSync(tmpFile);

    const indexFile = findIndexFile(siteDir);

    const site = {
      id: siteId,
      url: `${CONFIG.publicUrl}/${siteId}`,
      indexPath: indexFile ? `/${siteId}/${indexFile}` : null,
      deployedAt: new Date().toISOString(),
      fileCount: countFiles(siteDir),
    };

    fs.writeFileSync(
      path.join(siteDir, '.site-meta.json'),
      JSON.stringify(site, null, 2)
    );

    res.status(201).json(site);
  } catch (err) {
    console.error('Deploy from URL error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== Static File Server ==========

const staticApp = express();
staticApp.use(express.static(CONFIG.sitesDir, {
  index: ['index.html', 'index.htm'],
  extensions: ['html', 'htm'],
}));

// Directory listing at root
staticApp.get('/', (req, res) => {
  const sites = fs.readdirSync(CONFIG.sitesDir)
    .filter(name => !name.startsWith('_') && !name.startsWith('.'))
    .filter(name => {
      try { return fs.statSync(path.join(CONFIG.sitesDir, name)).isDirectory(); } catch { return false; }
    })
    .map(name => {
      const metaPath = path.join(CONFIG.sitesDir, name, '.site-meta.json');
      let meta = {};
      if (fs.existsSync(metaPath)) {
        try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch (e) {}
      }
      return {
        id: name,
        url: `${CONFIG.publicUrl}/${name}`,
        deployedAt: meta.deployedAt || 'unknown',
        fileCount: countFiles(path.join(CONFIG.sitesDir, name)),
      };
    })
    .sort((a, b) => {
      if (a.deployedAt === 'unknown') return 1;
      if (b.deployedAt === 'unknown') return -1;
      return new Date(b.deployedAt) - new Date(a.deployedAt);
    });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Static Sites Hub</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; background: #0f0f0f; color: #e0e0e0; }
    h1 { color: #6366f1; }
    .site { background: #1a1a2e; padding: 1rem; margin: 0.5rem 0; border-radius: 8px; border: 1px solid #2a2a4e; }
    .site a { color: #818cf8; text-decoration: none; font-size: 1.1rem; }
    .site a:hover { color: #a5b4fc; text-decoration: underline; }
    .meta { color: #888; font-size: 0.85rem; margin-top: 0.3rem; }
    .total { margin-bottom: 1.5rem; color: #888; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>🦐 Static Sites</h1>
  <p class="total">${sites.length} site${sites.length !== 1 ? 's' : ''} deployed</p>
  ${sites.map(s => `
    <div class="site">
      <a href="/${s.id}" target="_blank">/${s.id}</a>
      <div class="meta">${s.deployedAt !== 'unknown' ? new Date(s.deployedAt).toLocaleString() : ''} · ${s.fileCount} files</div>
    </div>
  `).join('')}
</body>
</html>`;
  res.send(html);
});

// ========== Start Servers ==========

const HOST = '0.0.0.0'; // Listen on all network interfaces

const apiServer = apiApp.listen(CONFIG.apiPort, HOST, () => {
  console.log(`\n🦐 Static Site Deployer API running on http://0.0.0.0:${CONFIG.apiPort}`);
  console.log(`   POST   /api/deploy       - Upload zip`);
  console.log(`   POST   /api/deploy/html   - Deploy raw HTML`);
  console.log(`   POST   /api/deploy/url    - Deploy from URL`);
  console.log(`   GET    /api/sites         - List sites`);
  console.log(`   GET    /api/sites/:id     - Site details`);
  console.log(`   DELETE /api/sites/:id     - Delete site`);
});

const staticServer = staticApp.listen(CONFIG.staticPort, HOST, () => {
  console.log(`\n📦 Static files server running on http://0.0.0.0:${CONFIG.staticPort}`);
  console.log(`📁 Sites directory: ${CONFIG.sitesDir}`);
  console.log(`🔗 Public URL: ${CONFIG.publicUrl}`);
  if (CONFIG.authToken) {
    console.log(`🔒 Auth: Bearer token enabled`);
  } else {
    console.log(`⚠️  Auth: DISABLED (set STATIC_AUTH_TOKEN to enable)`);
  }
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  apiServer.close();
  staticServer.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down...');
  apiServer.close();
  staticServer.close();
  process.exit(0);
});

// ========== Helper Functions ==========

function sanitizeId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'site-' + uuidv4().slice(0, 8);
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: destDir }))
      .on('close', resolve)
      .on('error', reject);
  });
}

function findIndexFile(dir) {
  const candidates = ['index.html', 'index.htm', 'index.php'];
  for (const name of candidates) {
    if (fs.existsSync(path.join(dir, name))) return name;
  }
  // Search one level deeper
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const found = findIndexFile(itemPath);
        if (found) return `${item}/${found}`;
      }
    }
  } catch (e) {}
  return null;
}

function countFiles(dir) {
  let count = 0;
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item.startsWith('.')) continue;
      const itemPath = path.join(dir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        count += countFiles(itemPath);
      } else {
        count++;
      }
    }
  } catch (e) {}
  return count;
}

function listFiles(dir, prefix = '') {
  const files = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item.startsWith('.')) continue;
      const itemPath = path.join(dir, item);
      const relPath = prefix ? `${prefix}/${item}` : item;
      if (fs.statSync(itemPath).isDirectory()) {
        files.push(...listFiles(itemPath, relPath));
      } else {
        files.push(relPath);
      }
    }
  } catch (e) {}
  return files;
}
