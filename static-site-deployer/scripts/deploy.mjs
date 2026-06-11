#!/usr/bin/env node
/**
 * Static Site Deployer CLI
 *
 * Usage:
 *   node deploy.mjs deploy-zip <zip-file> [--id <name>]
 *   node deploy.mjs deploy-html <html-file> [--id <name>] [--as <filename>]
 *   node deploy.mjs deploy-content --content "<html>..." [--id <name>]
 *   node deploy.mjs deploy-url <zip-url> [--id <name>]
 *   node deploy.mjs list
 *   node deploy.mjs info <id>
 *   node deploy.mjs delete <id>
 *   node deploy.mjs health
 */

import { createReadStream, readFileSync, existsSync } from 'fs';
import { request as httpRequest } from 'http';
import { argv, exit, stdout } from 'process';
import { parseArgs } from 'util';

const CONFIG = {
  apiUrl: process.env.STATIC_API_URL || 'http://localhost:3456',
  token: process.env.STATIC_AUTH_TOKEN || '',
};

// ========== Helpers ==========

function api(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, CONFIG.apiUrl);
    const headers = { ...opts.headers };
    if (CONFIG.token) {
      headers['Authorization'] = `Bearer ${CONFIG.token}`;
    }

    const req = httpRequest(url.toString(), {
      method,
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function uploadZip(filePath, siteId) {
  return new Promise((resolve, reject) => {
    const boundary = '----' + Math.random().toString(36).slice(2);
    const headers = { 'Content-Type': `multipart/form-data; boundary=${boundary}` };
    if (CONFIG.token) headers['Authorization'] = `Bearer ${CONFIG.token}`;

    const url = new URL('/api/deploy', CONFIG.apiUrl);
    if (siteId) url.searchParams.set('id', siteId);

    const req = httpRequest(url.toString(), {
      method: 'POST',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    // Write multipart form data manually
    const fileData = readFileSync(filePath);
    req.write(`--${boundary}\r\n`);
    req.write(`Content-Disposition: form-data; name="file"; filename="${filePath.split('/').pop()}"\r\n`);
    req.write('Content-Type: application/zip\r\n\r\n');
    req.write(fileData);
    req.write(`\r\n--${boundary}--\r\n`);
    req.end();
  });
}

// ========== Commands ==========

async function cmdDeployZip(args) {
  const filePath = args._[1];
  if (!filePath || !existsSync(filePath)) {
    console.error('Error: Zip file not found:', filePath);
    exit(1);
  }

  console.log(`📦 Uploading ${filePath}...`);
  const result = await uploadZip(filePath, args.id);
  
  if (result.status === 201) {
    console.log(`\n✅ Deployed successfully!`);
    console.log(`   URL: ${result.body.url}`);
    console.log(`   ID:  ${result.body.id}`);
    console.log(`   Files: ${result.body.fileCount}`);
  } else {
    console.error(`\n❌ Failed (${result.status}):`, result.body.error || result.body);
    exit(1);
  }
}

async function cmdDeployHtml(args) {
  const filePath = args._[1];
  let content;

  if (args.content) {
    content = args.content;
  } else if (filePath && existsSync(filePath)) {
    content = readFileSync(filePath, 'utf-8');
  } else {
    // Read from stdin
    content = readFileSync('/dev/stdin', 'utf-8');
  }

  if (!content || !content.trim()) {
    console.error('Error: No HTML content provided');
    exit(1);
  }

  console.log('📄 Deploying HTML...');
  const result = await api('POST', '/api/deploy/html', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      id: args.id,
      filename: args.as || 'index.html',
    }),
  });

  if (result.status === 201) {
    console.log(`\n✅ Deployed successfully!`);
    console.log(`   URL: ${result.body.url}`);
    console.log(`   ID:  ${result.body.id}`);
  } else {
    console.error(`\n❌ Failed (${result.status}):`, result.body.error || result.body);
    exit(1);
  }
}

async function cmdDeployUrl(args) {
  const url = args._[1];
  if (!url) {
    console.error('Error: URL required');
    exit(1);
  }

  console.log(`🌐 Downloading from ${url}...`);
  const result = await api('POST', '/api/deploy/url', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      id: args.id,
    }),
  });

  if (result.status === 201) {
    console.log(`\n✅ Deployed successfully!`);
    console.log(`   URL: ${result.body.url}`);
    console.log(`   ID:  ${result.body.id}`);
    console.log(`   Files: ${result.body.fileCount}`);
  } else {
    console.error(`\n❌ Failed (${result.status}):`, result.body.error || result.body);
    exit(1);
  }
}

async function cmdList() {
  console.log('📋 Fetching deployed sites...\n');
  const result = await api('GET', '/api/sites');

  if (result.status !== 200) {
    console.error('Error:', result.body.error || result.body);
    exit(1);
  }

  const { sites, total } = result.body;
  if (total === 0) {
    console.log('No sites deployed yet.');
    return;
  }

  console.log(`Total: ${total} site${total > 1 ? 's' : ''}\n`);
  for (const site of sites) {
    console.log(`  📄 ${site.id}`);
    console.log(`     URL:  ${site.url}`);
    console.log(`     Time: ${site.deployedAt ? new Date(site.deployedAt).toLocaleString() : 'unknown'}`);
    console.log(`     Size: ${site.fileCount} file${site.fileCount > 1 ? 's' : ''}`);
    console.log('');
  }
}

async function cmdInfo(args) {
  const id = args._[1];
  if (!id) {
    console.error('Error: Site ID required');
    exit(1);
  }

  const result = await api('GET', `/api/sites/${id}`);

  if (result.status !== 200) {
    console.error('Error:', result.body.error || result.body);
    exit(1);
  }

  const site = result.body;
  console.log(`\n📄 Site: ${site.id}`);
  console.log(`   URL:  ${site.url}`);
  console.log(`   Time: ${site.deployedAt ? new Date(site.deployedAt).toLocaleString() : 'unknown'}`);
  console.log(`   Files (${site.fileCount}):`);
  if (site.files) {
    for (const f of site.files) {
      console.log(`     - ${f}`);
    }
  }
  console.log('');
}

async function cmdDelete(args) {
  const id = args._[1];
  if (!id) {
    console.error('Error: Site ID required');
    exit(1);
  }

  console.log(`🗑️  Deleting site "${id}"...`);
  const result = await api('DELETE', `/api/sites/${id}`);

  if (result.status === 200) {
    console.log(`✅ Deleted.`);
  } else {
    console.error('Error:', result.body.error || result.body);
    exit(1);
  }
}

async function cmdHealth() {
  const result = await api('GET', '/api/health');
  console.log(`🩺 Status: ${result.body.status}`);
  if (result.body.uptime) {
    console.log(`⏱️  Uptime: ${Math.floor(result.body.uptime)}s`);
  }
}

// ========== Main ==========

const commands = {
  'deploy-zip': { fn: cmdDeployZip, desc: 'Deploy a zip file: deploy-zip <file.zip> [--id name]' },
  'deploy-html': { fn: cmdDeployHtml, desc: 'Deploy HTML file: deploy-html <file.html> [--id name] [--as index.html]' },
  'deploy-content': { fn: cmdDeployHtml, desc: 'Deploy HTML string: deploy-content --content "<html>..." [--id name]' },
  'deploy-url': { fn: cmdDeployUrl, desc: 'Deploy from URL: deploy-url <zip-url> [--id name]' },
  'list': { fn: cmdList, desc: 'List all deployed sites' },
  'info': { fn: cmdInfo, desc: 'Get site details: info <id>' },
  'delete': { fn: cmdDelete, desc: 'Delete a site: delete <id>' },
  'ls': { fn: cmdList, desc: 'Alias for list' },
  'health': { fn: cmdHealth, desc: 'Health check' },
  'status': { fn: cmdHealth, desc: 'Alias for health' },
};

async function main() {
  const cmd = argv[2];
  if (!cmd || cmd === '--help' || cmd === '-h' || !commands[cmd]) {
    console.log(`\n🦐 Static Site Deployer CLI\n`);
    console.log(`Usage: node deploy.mjs <command> [options]\n`);
    console.log(`Commands:`);
    for (const [name, meta] of Object.entries(commands)) {
      console.log(`  ${name.padEnd(18)} ${meta.desc}`);
    }
    console.log(`\nOptions:`);
    console.log(`  --id <name>     Custom site ID (alphanumeric, hyphens, underscores)`);
    console.log(`  --content "..."  HTML content (deploy-content only)`);
    console.log(`  --as <file>     Filename to save as (default: index.html)`);
    console.log(`\nEnvironment:`);
    console.log(`  STATIC_API_URL    API server URL (default: http://localhost:3456)`);
    console.log(`  STATIC_AUTH_TOKEN Auth token`);
    console.log('');
    exit(cmd && cmd !== '--help' ? 1 : 0);
  }

  const values = {};
  for (let i = 3; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith('--')) {
        values[key] = val;
        i++;
      } else {
        values[key] = true;
      }
    }
  }

  const args = { _: argv.slice(3).filter(a => !a.startsWith('--')), ...values };
  await commands[cmd].fn(args);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  exit(1);
});
