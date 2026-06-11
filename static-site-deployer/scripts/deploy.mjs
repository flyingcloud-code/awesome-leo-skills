#!/usr/bin/env node
/**
 * Static Site Deployer CLI
 *
 * Usage:
 *   node deploy.mjs deploy-zip <zip-file> [--id <name>] [--server <url>]
 *   node deploy.mjs deploy-html <html-file> [--id <name>] [--as <filename>]
 *   node deploy.mjs deploy-content --content "<html>..." [--id <name>]
 *   node deploy.mjs deploy-url <zip-url> [--id <name>]
 *   node deploy.mjs list [--server <url>]
 *   node deploy.mjs info <id>
 *   node deploy.mjs delete <id>
 *   node deploy.mjs health
 *   node deploy.mjs config             # Show current configuration
 */

import { createReadStream, readFileSync, existsSync, statSync } from 'fs';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { argv, exit, stdout, env } from 'process';
import { sep, join } from 'path';

function getDefaultServer() {
  return env.STATIC_API_URL || 'http://localhost:3456';
}

function getToken() {
  return env.STATIC_AUTH_TOKEN || '';
}

function getPublicUrl() {
  return env.STATIC_PUBLIC_URL || 'http://localhost:3457';
}

// ========== Helpers ==========

function api(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const baseUrl = opts.server || getDefaultServer();
    const url = new URL(path, baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl);
    const headers = { ...opts.headers };
    const token = opts.token || getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const requester = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = requester(url.toString(), {
      method,
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data, raw: true });
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Connection failed: ${err.message}. Make sure the server is running at ${baseUrl}`)));

    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function uploadZip(filePath, siteId, server, token) {
  return new Promise((resolve, reject) => {
    if (!existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    const boundary = '----' + Math.random().toString(36).slice(2);
    const headers = { 'Content-Type': `multipart/form-data; boundary=${boundary}` };
    const authToken = token || getToken();
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const baseUrl = server || getDefaultServer();
    const urlObj = new URL('/api/deploy', baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl);
    if (siteId) urlObj.searchParams.set('id', siteId);

    const requester = urlObj.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = requester(urlObj.toString(), {
      method: 'POST',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data, raw: true });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Upload failed: ${err.message}. Make sure the server is running at ${baseUrl}`));
    });

    // Write multipart form data
    const fileData = readFileSync(filePath);
    const fileName = filePath.split(sep).pop();
    req.write(`--${boundary}\r\n`);
    req.write(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`);
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
    console.error('❌ Error: Zip file not found:', filePath);
    exit(1);
  }

  const stats = statSync(filePath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
  console.log(`📦 Uploading ${filePath} (${sizeMB} MB)...`);
  console.log(`   → ${args.server || getDefaultServer()}/api/deploy`);
  
  const result = await uploadZip(filePath, args.id, args.server);
  
  if (result.status === 201) {
    console.log(`\n✅ Deployed successfully!`);
    console.log(`   📍 URL: ${result.body.url}`);
    console.log(`   🆔 ID:  ${result.body.id}`);
    console.log(`   📁 Files: ${result.body.fileCount}`);
  } else {
    console.error(`\n❌ Failed (HTTP ${result.status}):`, result.body.error || result.body);
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
    console.error('❌ Error: No HTML content provided');
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
    server: args.server,
  });

  if (result.status === 201) {
    console.log(`\n✅ Deployed successfully!`);
    console.log(`   📍 URL: ${result.body.url}`);
    console.log(`   🆔 ID:  ${result.body.id}`);
  } else {
    console.error(`\n❌ Failed (HTTP ${result.status}):`, result.body.error || result.body);
    exit(1);
  }
}

async function cmdDeployUrl(args) {
  const url = args._[1];
  if (!url) {
    console.error('❌ Error: URL required');
    exit(1);
  }

  console.log(`🌐 Downloading from ${url}...`);
  const result = await api('POST', '/api/deploy/url', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, id: args.id }),
    server: args.server,
  });

  if (result.status === 201) {
    console.log(`\n✅ Deployed successfully!`);
    console.log(`   📍 URL: ${result.body.url}`);
    console.log(`   🆔 ID:  ${result.body.id}`);
    console.log(`   📁 Files: ${result.body.fileCount}`);
  } else {
    console.error(`\n❌ Failed (HTTP ${result.status}):`, result.body.error || result.body);
    exit(1);
  }
}

async function cmdList(args) {
  console.log('📋 Fetching deployed sites...\n');
  const result = await api('GET', '/api/sites', { server: args.server });

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
    console.error('❌ Error: Site ID required');
    exit(1);
  }

  const result = await api('GET', `/api/sites/${id}`, { server: args.server });
  if (result.status !== 200) {
    console.error('Error:', result.body.error || result.body);
    exit(1);
  }

  const site = result.body;
  console.log(`\n📄 Site: ${site.id}`);
  console.log(`   📍 URL:  ${site.url}`);
  console.log(`   ⏰ Time: ${site.deployedAt ? new Date(site.deployedAt).toLocaleString() : 'unknown'}`);
  console.log(`   📁 Files (${site.fileCount}):`);
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
    console.error('❌ Error: Site ID required');
    exit(1);
  }

  console.log(`🗑️  Deleting site "${id}"...`);
  const result = await api('DELETE', `/api/sites/${id}`, { server: args.server });
  if (result.status === 200) {
    console.log('✅ Deleted.');
  } else {
    console.error('Error:', result.body.error || result.body);
    exit(1);
  }
}

async function cmdHealth(args) {
  const result = await api('GET', '/api/health', { server: args.server });
  if (result.status === 200) {
    console.log(`🩺 Status: ${result.body.status}`);
    if (result.body.uptime) {
      const hours = Math.floor(result.body.uptime / 3600);
      const mins = Math.floor((result.body.uptime % 3600) / 60);
      console.log(`⏱️  Uptime: ${hours}h ${mins}m`);
    }
  } else {
    console.error('❌ Server not healthy');
    exit(1);
  }
}

function cmdConfig(args) {
  console.log('\n🦐 Static Site Deployer - Current Configuration\n');
  console.log(`  STATIC_API_URL     ${getDefaultServer()}`);
  console.log(`  STATIC_PUBLIC_URL  ${getPublicUrl()}`);
  console.log(`  STATIC_AUTH_TOKEN  ${getToken() ? '(set)' : '(not set)'}`);
  console.log(`  Active server      ${args.server || getDefaultServer()}`);
  console.log('');
}

// ========== Main ==========

const commands = {
  'deploy-zip': { fn: cmdDeployZip, desc: 'Deploy a zip file: deploy-zip <file.zip> [--id name] [--server URL]' },
  'deploy-html': { fn: cmdDeployHtml, desc: 'Deploy HTML file: deploy-html <file.html> [--id name] [--as index.html]' },
  'deploy-content': { fn: cmdDeployHtml, desc: 'Deploy HTML string: deploy-content --content "<html>..." [--id name]' },
  'deploy-url': { fn: cmdDeployUrl, desc: 'Deploy from URL: deploy-url <zip-url> [--id name]' },
  'list': { fn: cmdList, desc: 'List all deployed sites' },
  'ls': { fn: cmdList, desc: 'Alias for list' },
  'info': { fn: cmdInfo, desc: 'Get site details: info <id>' },
  'delete': { fn: cmdDelete, desc: 'Delete a site: delete <id>' },
  'health': { fn: cmdHealth, desc: 'Health check and uptime' },
  'status': { fn: cmdHealth, desc: 'Alias for health' },
  'config': { fn: cmdConfig, desc: 'Show current configuration' },
};

async function main() {
  const cmd = argv[2];
  if (!cmd || cmd === '--help' || cmd === '-h' || !commands[cmd]) {
    const server = getDefaultServer();
    console.log(`\n🦐 Static Site Deployer CLI\n`);
    console.log(`Usage: node deploy.mjs <command> [options]\n`);
    console.log(`Server: ${server}`);
    console.log(`\nCommands:`);
    for (const [name, meta] of Object.entries(commands)) {
      console.log(`  ${name.padEnd(20)} ${meta.desc}`);
    }
    console.log(`\nOptions:`);
    console.log(`  --id <name>       Custom site ID (alphanumeric, hyphens, underscores)`);
    console.log(`  --server <url>    Deploy server URL (default: ${server})`);
    console.log(`  --content "..."   HTML content (deploy-content only)`);
    console.log(`  --as <file>       Filename to save as (default: index.html)`);
    console.log(`\nEnvironment variables:`);
    console.log(`  STATIC_API_URL     Deploy server URL`);
    console.log(`  STATIC_AUTH_TOKEN  Authentication token`);
    console.log(`  STATIC_PUBLIC_URL  Public URL for deployed sites`);
    console.log(`\nRemote server example:`);
    console.log(`  STATIC_API_URL=http://47.85.20.56:3456 STATIC_AUTH_TOKEN=xxx node deploy.mjs deploy-zip ./site.zip\n`);
    exit(cmd && cmd !== '--help' ? 1 : 0);
  }

  // Parse args
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
