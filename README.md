# Smart Reconciliation & Audit System

A full-stack MERN application for uploading transaction data, reconciling it against system records, identifying mismatches/duplicates, and maintaining a complete audit trail.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  Dashboard │ Upload │ Reconciliation │ Audit Timeline    │
│  (Vite + Tailwind CSS + Recharts)                       │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API (JSON)
┌─────────────────────┴───────────────────────────────────┐
│                 Express.js Backend                        │
│  Auth │ Upload │ Reconciliation │ Dashboard │ Audit      │
│  (JWT + Role-based Access Control)                       │
├──────────────────┬──────────────────────────────────────┤
│   Bull Queue     │        Mongoose ODM                   │
│   (Redis)        │        (MongoDB)                      │
│   Async file     │        5 Collections:                 │
│   processing     │        Users, UploadJobs, Records,    │
│                  │        ReconciliationResults,          │
│                  │        AuditLogs                       │
└──────────────────┴──────────────────────────────────────┘
```

## Tech Stack

| Layer     | Technology                           |
| --------- | ------------------------------------ |
| Frontend  | React 18, Vite, Tailwind CSS, Recharts |
| Backend   | Node.js, Express.js                  |
| Database  | MongoDB with Mongoose                |
| Queue     | Bull with Redis                      |
| Auth      | JWT (JSON Web Tokens)                |
| File Parse| PapaParse (CSV), xlsx (Excel)        |

## Features

- **Reconciliation Dashboard** — Summary cards, donut chart, bar chart, dynamic filters
- **File Upload** — Drag-and-drop CSV/Excel, preview first 20 rows, column mapping
- **Reconciliation Engine** — Configurable matching rules (exact, partial, duplicate detection)
- **Manual Resolution** — Analysts can manually correct and resolve mismatches
- **Audit Trail** — Visual timeline with old/new values, immutable logs
- **Role-Based Access** — Admin, Analyst, Viewer with frontend + backend enforcement
- **Idempotency** — SHA-256 file hashing prevents duplicate uploads
- **Async Processing** — Bull queue with Redis handles up to 50K records non-blocking

## Prerequisites

- **Node.js** >= 18
- **MongoDB** (local or Atlas)
- **Redis** (local or cloud)

## Setup

### 1. Clone and Install

```bash
cd smart-recon
npm run install:all
```

### 2. Configure Environment

Copy `.env.example` to `server/.env` and update values:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart-recon
JWT_SECRET=your_secret_key_here
JWT_EXPIRE=7d
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
NODE_ENV=development
```

### 3. Seed Database

```bash
npm run seed
```

This creates:
- 3 users (admin, analyst, viewer)
- 200 system records for reconciliation

### 4. Start Development

```bash
npm run dev
```

- Backend runs on `http://localhost:5000`
- Frontend runs on `http://localhost:3000`

## Login Credentials

| Role    | Email                     | Password   |
| ------- | ------------------------- | ---------- |
| Admin   | admin@smartrecon.com      | admin123   |
| Analyst | analyst@smartrecon.com    | analyst123 |
| Viewer  | viewer@smartrecon.com     | viewer123  |

## API Endpoints

### Auth
| Method | Endpoint           | Access   | Description          |
| ------ | ------------------ | -------- | -------------------- |
| POST   | /api/auth/login    | Public   | Login                |
| POST   | /api/auth/register | Public   | Register             |
| GET    | /api/auth/me       | Auth     | Get current user     |
| GET    | /api/auth/users    | Admin    | Get all users        |

### Upload
| Method | Endpoint                  | Access          | Description              |
| ------ | ------------------------- | --------------- | ------------------------ |
| POST   | /api/upload               | Admin, Analyst  | Upload file              |
| GET    | /api/upload               | Auth            | List upload jobs         |
| GET    | /api/upload/:id/preview   | Auth            | Preview first 20 rows    |
| PUT    | /api/upload/:id/mapping   | Admin, Analyst  | Save mapping & process   |
| GET    | /api/upload/:id/status    | Auth            | Get processing status    |

### Reconciliation
| Method | Endpoint                              | Access          | Description              |
| ------ | ------------------------------------- | --------------- | ------------------------ |
| POST   | /api/reconciliation/run/:uploadJobId  | Admin, Analyst  | Run reconciliation       |
| GET    | /api/reconciliation/:uploadJobId      | Auth            | Get results (paginated)  |
| GET    | /api/reconciliation/:uploadJobId/summary | Auth         | Get summary stats        |
| PUT    | /api/reconciliation/:id/resolve       | Admin, Analyst  | Manual resolution        |

### Dashboard
| Method | Endpoint                 | Access | Description              |
| ------ | ------------------------ | ------ | ------------------------ |
| GET    | /api/dashboard/summary   | Auth   | Summary cards data       |
| GET    | /api/dashboard/chart     | Auth   | Chart data               |
| GET    | /api/dashboard/filters   | Auth   | Filter options           |

### Audit
| Method | Endpoint                    | Access | Description              |
| ------ | --------------------------- | ------ | ------------------------ |
| GET    | /api/audit                  | Admin  | All audit logs           |
| GET    | /api/audit/entity/:entityId | Auth   | Entity audit timeline    |

## Reconciliation Rules

Defined in `server/config/reconciliation.js` (configurable):

1. **Exact Match** — Transaction ID + Amount match exactly
2. **Partial Match** — Reference Number matches + Amount within ±2% tolerance
3. **Duplicate** — Same Transaction ID appears more than once in uploaded data
4. **Unmatched** — No match found in system records

## Database Collections & Indexes

| Collection            | Indexes                                    |
| --------------------- | ------------------------------------------ |
| Users                 | email (unique)                             |
| UploadJobs            | fileHash, uploadedBy                       |
| Records               | transactionId, referenceNumber, uploadJobId|
| ReconciliationResults | uploadJobId, status, uploadedRecordId      |
| AuditLogs             | entityId, userId, timestamp                |

## Key Design Decisions

1. **Idempotency**: SHA-256 hash of file content. Re-uploading same file returns existing job.
2. **Async Processing**: Bull queue + Redis. Frontend polls `/status` endpoint. No WebSockets needed.
3. **Configurable Rules**: Matching rules in config file with adjustable thresholds.
4. **Audit Immutability**: Mongoose pre-hooks block all update/delete operations on AuditLogs.
5. **Batch Inserts**: Records inserted in batches of 1,000 for performance.
6. **Streaming Parse**: PapaParse streaming mode for CSV avoids loading entire file in memory.

## Assumptions

- System records are pre-seeded and represent the "source of truth"
- Each uploaded file is treated as a batch of transactions to reconcile
- Column mapping is required before processing starts
- Reconciliation runs per-upload-job, not across multiple jobs
- Audit logs are append-only and cannot be modified or deleted

## Trade-offs & Limitations

- **No WebSocket**: Polling is used for upload status instead of real-time WebSocket updates
- **No file cleanup**: Uploaded files remain on disk; a cron job could be added for cleanup
- **Single sheet**: Excel files only parse the first sheet
- **No pagination on large exports**: Results are paginated but no CSV export feature
- **Redis required**: Bull queue requires Redis; without Redis, file processing won't work

## Sample Data

Sample CSV files are in the `sample-data/` directory:
- `transactions_sample.csv` — 21 records with matched, unmatched, partial, and duplicate scenarios

To run the project
Make sure MongoDB and Redis are running locally
cd smart-recon && npm run install:all
npm run seed (creates users + system records)
npm run dev (starts both servers)
Open http://localhost:3000 and login with admin@smartrecon.com / admin123
