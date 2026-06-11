# Static Site Deployer API Reference

## POST /api/deploy

Upload a zip file containing static assets. The zip is extracted and served immediately.

### Request

```http
POST /api/deploy HTTP/1.1
Content-Type: multipart/form-data
Authorization: Bearer <token>  (optional)
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | ✅ | Zip file containing static assets |
| `id` | String | ❌ | Custom site ID (alphanumeric, hyphens, underscores). Auto-generated if omitted. |

### Response 201

```json
{
  "id": "a1b2c3d4",
  "url": "http://localhost:3457/a1b2c3d4",
  "indexPath": "/a1b2c3d4/index.html",
  "deployedAt": "2026-06-11T08:30:00.000Z",
  "fileCount": 5
}
```

### cURL example

```bash
curl -X POST http://localhost:3456/api/deploy \
  -F "file=@./dist.zip" \
  -F "id=my-site"
```

---

## POST /api/deploy/html

Deploy raw HTML content without a zip file.

### Request

```http
POST /api/deploy/html HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>  (optional)
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | String | ✅ | HTML content to deploy |
| `id` | String | ❌ | Custom site ID |
| `filename` | String | ❌ | Filename (default: `index.html`) |

### Response 201

Same structure as zip deploy.

### cURL example

```bash
curl -X POST http://localhost:3456/api/deploy/html \
  -H "Content-Type: application/json" \
  -d '{"content":"<h1>Hello World</h1>","id":"hello"}'
```

---

## POST /api/deploy/url

Download a zip from a URL and deploy it.

### Request

```http
POST /api/deploy/url HTTP/1.1
Content-Type: application/json
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | String | ✅ | URL of a zip file to download |
| `id` | String | ❌ | Custom site ID |

### Response 201

Same structure as zip deploy.

### cURL example

```bash
curl -X POST http://localhost:3456/api/deploy/url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/site.zip","id":"remote-site"}'
```

---

## GET /api/sites

List all deployed sites, sorted by most recent first.

### Response 200

```json
{
  "sites": [
    {
      "id": "my-site",
      "url": "http://localhost:3457/my-site",
      "deployedAt": "2026-06-11T08:30:00.000Z",
      "fileCount": 5
    }
  ],
  "total": 1
}
```

---

## GET /api/sites/:id

Get detailed info about a specific site, including file listing.

### Response 200

```json
{
  "id": "my-site",
  "url": "http://localhost:3457/my-site",
  "deployedAt": "2026-06-11T08:30:00.000Z",
  "fileCount": 5,
  "files": [
    "index.html",
    "styles.css",
    "app.js",
    "images/logo.png",
    "images/bg.jpg"
  ]
}
```

### Response 404

```json
{ "error": "Site not found" }
```

---

## DELETE /api/sites/:id

Delete a deployed site and all its files.

### Response 200

```json
{ "message": "Site \"my-site\" deleted" }
```

---

## GET /api/health

Health check endpoint.

### Response 200

```json
{ "status": "ok", "uptime": 12345 }
```
