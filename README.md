# MangaCMS — Universal Manga Reader, Headless CMS & Public API Integration Platform

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-Dark--First-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.19-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-47%20Passing-success?style=flat-square)]()

A complete, self-hostable, production-grade manga reading platform featuring an advanced reading engine, a headless Content Management System (CMS), and a universal external REST API connector engine that allows administrators to aggregate content from arbitrary public manga APIs without writing code.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Subsystem 1: Universal Manga Reader](#2-subsystem-1-universal-manga-reader)
3. [Subsystem 2: Headless Content Management System](#3-subsystem-2-headless-content-management-system)
4. [Subsystem 3: Universal Public API Connector Engine](#4-subsystem-3-universal-public-api-connector-engine)
5. [Security & Infrastructure Architecture](#5-security--infrastructure-architecture)
6. [Data Model & Prisma Schema](#6-data-model--prisma-schema)
7. [Technology Stack](#7-technology-stack)
8. [Installation & Quick Start](#8-installation--quick-start)
9. [Docker Deployment](#9-docker-deployment)
10. [Configuration & Environment Variables](#10-configuration--environment-variables)
11. [Automated Testing](#11-automated-testing)
12. [Default Credentials](#12-default-credentials)

---

## 1. Architecture Overview

MangaCMS is built using clean domain-driven modularity. It maintains a strict separation between external provider schemas and the normalized internal domain:

```text
src/
├── app/
│   ├── (auth)/                  # Authentication routes (login, register)
│   ├── (public)/                # Public reader & browsing portal
│   │   ├── page.tsx             # Homepage (hero carousel, trending, popular, updates)
│   │   ├── browse/page.tsx      # Multi-filter search & directory
│   │   ├── manga/[slug]/        # Manga detail view, chapters, rating, library
│   │   ├── read/[chapterId]/    # Advanced reading engine
│   │   └── library/             # User library & reading history
│   ├── admin/                   # CMS & Provider Management Portal
│   │   ├── page.tsx             # Operational dashboard & KPI metrics
│   │   ├── manga/               # Manga CRUD & metadata editor
│   │   ├── chapters/            # Chapter editor & ZIP archive ingestion
│   │   ├── providers/           # Universal API Provider Management
│   │   │   └── [id]/test/       # Interactive API Test Console & Visual Mapper
│   │   ├── imports/             # Background import jobs & execution logs
│   │   ├── media/               # Media asset manager
│   │   ├── genres/              # Genre taxonomy editor
│   │   ├── reports/             # Community moderation review
│   │   ├── audit-logs/          # Administrative activity trail
│   │   └── settings/            # Site configuration
│   └── api/                     # REST API Route Handlers
├── modules/
│   ├── api-providers/           # Generic REST provider adapter, JSON mapper & pagination
│   ├── import-engine/           # Duplicate-safe synchronizer & background job tracker
│   ├── manga/                   # Manga querying, filtering & statistics
│   ├── chapters/                # Chapter retrieval, page sequencing & ZIP extraction
│   ├── library/                 # User library status, bookmarks & progress tracking
│   └── cms/                     # Dashboard analytics & audit logging
├── lib/
│   ├── database/                # Prisma client & dual PostgreSQL/PGlite driver abstraction
│   ├── security/                # AES-256-GCM encryption, SSRF protection & JWT RBAC
│   ├── storage/                 # Local filesystem & S3-compatible storage driver
│   └── store/                   # Client Zustand state stores (reader & auth)
└── components/
    ├── ui/                      # Reusable design system primitives
    ├── reader/                  # Manga reader canvas, overlays & shortcut listener
    ├── manga/                   # Hero carousel, manga cards & chapter listings
    └── navigation/              # Header, footer & admin sidebar
```

---

## 2. Subsystem 1: Universal Manga Reader

The reader engine delivers a responsive, app-like reading experience tailored for manga, manhwa, manhua, and webtoons.

### 2.1 Reading Modes & Layouts
- **Webtoon Continuous Mode:** Vertical infinite scroll with configurable page gaps.
- **Single-Page Mode:** Focused one-page-at-a-time reading.
- **Double-Page Mode:** Book-spread simulation with automatic left/right pairing.
- **Reading Directions:**
  - `Right-to-Left (RTL)`: Traditional Japanese manga format.
  - `Left-to-Right (LTR)`: Standard western comic format.
  - `Vertical`: Continuous downward scroll.
- **Image Scaling:**
  - `Fit Width`: Expands page to viewport width while preserving aspect ratio.
  - `Fit Height`: Restricts height to viewport height for desktop display.
  - `Original Dimensions`: Displays raw source resolution with pan/zoom.

### 2.2 Reader Controls & Performance
- **Adjacent Page Preloading:** Silently preloads surrounding images (previous 2 and next 3 pages) in background memory.
- **Debounced Progress Synchronization:** Syncs reading progress (`chapterId`, `pageNumber`, `percentRead`) to the database without degrading frame rate.
- **Keyboard Shortcuts:**
  - `Left/Right Arrow`: Turn page based on reading direction.
  - `Up/Down Arrow`: Smooth vertical scrolling.
  - `A` / `D`: Jump to previous / next chapter.
  - `F`: Toggle native fullscreen.
  - `H`: Hide/reveal reader control overlays.
  - Shortcuts automatically ignore keystrokes inside text input elements.
- **Reading Preferences Persistence:** Remembers user settings (mode, direction, scaling, background theme) across sessions.

---

## 3. Subsystem 2: Headless Content Management System

A comprehensive administrative control plane for complete editorial and catalog management.

### 3.1 Content Operations
- **Manga Management:** Full CRUD operations, slug generation, alternative titles, publication status toggling (`DRAFT`, `PUBLISHED`, `ARCHIVED`), and genre tagging.
- **Chapter Ingestion with Automated ZIP Processing:**
  - Upload chapter archives (`.zip`).
  - Safe extraction with path traversal guards.
  - Natural numerical file sorting (`page-1.jpg`, `page-2.jpg`, `page-10.jpg`).
  - Storage driver saving and automatic `ChapterPage` database record generation.
- **Media Asset Library:** Tracks uploaded files, covers, and page images with storage provider indicators (`LOCAL` or `S3`).
- **Audit Logs:** Immutable audit log tracking administrative mutations (who, what entity, action, timestamp, and IP address).
- **Community Moderation:** Review user reports on incorrect metadata, broken images, or inappropriate content.

---

## 4. Subsystem 3: Universal Public API Connector Engine

The core aggregating capability: connect arbitrary external public REST manga APIs by URL, configure field mappings, and synchronize content without modifying codebase logic.

```mermaid
flowchart LR
    A[Admin Inputs API URL] --> B[Server Proxy with SSRF Protection]
    B --> C[Inspect JSON Response Shape]
    C --> D[Visual JSON Field Mapper]
    D --> E[Multi-Endpoint Configuration]
    E --> F[Duplicate-Safe Import Engine]
    F --> G[(Normalized PostgreSQL Database)]
```

### 4.1 Server-Side Proxy with Strict SSRF Defense
All outbound requests to third-party APIs pass through an isolated server-side proxy (`safeFetch`):
- **DNS Resolution Pre-flight:** Performs DNS resolution before making socket connections.
- **IP Range Enforcement:** Immediately rejects:
  - Loopback addresses (`127.0.0.0/8`, `::1`).
  - Private RFC 1918 networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - IPv6 Unique Local (`fc00::/7`) and Link-Local (`fe80::/10`).
  - Cloud metadata endpoints (`169.254.169.254` for AWS, GCP, Azure, and DigitalOcean).
- **Redirect Re-validation:** Inspects and re-validates each redirect destination URL before following.
- **Hard Resource Caps:** Enforces a 10MB response buffer limit and strict timeouts to prevent memory exhaustion and slowloris attacks.

### 4.2 Flexible JSON Mapping & Transformations
Map arbitrary nested JSON schemas into MangaCMS domain models using dot-notation or JSONPath (`data.items[*].title`):
- **Built-in Transformations:**
  - `to_string`: Coerces numeric or boolean IDs to string.
  - `to_number` / `to_integer`: Converts string values to numeric representations.
  - `uppercase` / `lowercase`: Normalizes status codes (e.g., `"ongoing"` $\to$ `"ONGOING"`).
  - `split_comma`: Splits comma-separated genre strings into array elements.
  - `first_element`: Extracts the first item from an array.
  - `join_comma`: Flattens an array of strings into a single string.
  - `trim`: Strips leading and trailing whitespace.
- **Heuristic Auto-Mapping:** Automatically scans response payloads and recommends mapping configurations for common properties (`id`, `title`, `description`, `cover_url`, `status`, `release_year`, etc.).

### 4.3 Pagination Extractors
Supports diverse third-party pagination strategies:
- `PAGE`: Traditional page-number query parameters (`?page=2`).
- `OFFSET`: Offset and limit parameters (`?offset=20&limit=20`).
- `CURSOR`: Opaque cursor-based pagination tokens (`?cursor=eyJpZCI6MTB9`).
- `LINK`: RFC 5988 HTTP `Link` response headers.
- `LIMIT`: Fetch up to maximum count.

### 4.4 Duplicate Handling & Import Engine
- **Idempotent Upserts:** Identifies duplicates using a composite unique constraint `(providerId, externalId)`.
- **Configurable Conflict Strategies:**
  - `SKIP`: Ignores existing manga and imports only new titles.
  - `UPDATE`: Updates metadata while preserving existing local chapters.
  - `OVERWRITE`: Completely synchronizes metadata and chapters with external state.
- **Job Tracking:** Records every execution in `APIImportJob` and `APIImportRecord` tables with detailed logs, duration metrics, and status (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`).

---

## 5. Global Content Exclusion Policy — Strict Genre Ban

MangaCMS enforces a platform-wide, mandatory content exclusion policy executed on the server side prior to data persistence or public display.

### 5.1 Prohibited Core Categories
The following 11 core categories and their variants are banned globally and cannot be disabled:
- **Yaoi** (aliases: `yaoi`, `801`, `danmei`)
- **BL (Boys' Love)** (aliases: `bl`, `boys love`, `boy's love`, `boyslove`, `shounen-ai`)
- **Shounen Ai** (aliases: `shounen ai`, `shonen ai`, `shounen-ai`)
- **Yuri** (aliases: `yuri`, `baihe`)
- **GL (Girls' Love)** (aliases: `gl`, `girls love`, `girl's love`, `girlslove`, `shoujo-ai`)
- **Shoujo Ai** (aliases: `shoujo ai`, `shojo ai`, `shoujo-ai`)
- **Smut** (aliases: `smut`, `smutty`, `adult smut`)
- **Explicit Sexual Content** (aliases: `explicit sexual content`, `explicit`, `nsfw`, `adult`, `r18`, `18+`)
- **Erotica** (aliases: `erotica`, `erotic`)
- **Hentai** (aliases: `hentai`, `doujinshi hentai`)
- **Pornographic Content** (aliases: `pornographic content`, `pornographic`, `pornography`, `hardcore`)

### 5.2 Server-Side Filtering & Normalized Matching
Centralized in `ContentPolicyService`:
- **Normalized Token Matching:** Uses Unicode NFKD normalization, lowercasing, and regex word boundaries (`\b`) to prevent false positives (e.g. `boy` or `schoolboy` will NOT falsely match `BL`, and `glass` or `global` will NOT falsely match `GL`).
- **Comprehensive Source Inspection:** Evaluates genre names, genre slugs, tags, alternative titles, explicit rating fields (`isNsfw`, `isAdult`, `ageRating >= 18`), and provider-specific tag mappings.
- **Strict Ingestion Rejection:** Any violating title is completely rejected: no manga record is created, no chapters are fetched, and rejection reasons are logged to `APIImportRecord` and `AuditLog`.
- **Configurable Unknown-Genre Quarantine:** Content with missing or uninterpretable genre metadata enters a `QUARANTINE` state (`publicationStatus = PENDING_REVIEW`) hidden from public view until reviewed by an administrator.
- **Retroactive Database Audit:** Scans existing records and automatically quarantines or archives violations with an audit trail.

---

## 6. Security & Infrastructure Architecture

- **Credential Encryption:** All API keys, basic auth passwords, and custom header tokens are encrypted at rest using **AES-256-GCM** with a unique 96-bit initialization vector (IV) per record.
- **Authentication & RBAC:**
  - Bcrypt password hashing (12 salt rounds).
  - Signed HTTP-only session cookies (`manga_session_token`) via JWT.
  - Role-based authorization layers: `GUEST`, `USER`, `MODERATOR`, `ADMIN`, `SUPER_ADMIN`.
- **Storage Abstraction:**
  - Pluggable storage interface supporting both local filesystem storage (`/uploads/`) and S3-compatible cloud object storage (Cloudflare R2, AWS S3, MinIO).
- **Dual-Engine Database Layer:**
  - Works out of the box with standard PostgreSQL 16.
  - Automatically falls back to an embedded WASM PostgreSQL engine (`@electric-sql/pglite`) in offline or development environments without requiring Docker or a local database daemon.

---

## 6. Data Model & Prisma Schema

The application schema comprises 25 relational models:

```mermaid
erDiagram
    User ||--o{ UserLibrary : maintains
    User ||--o{ ReadingHistory : records
    User ||--o{ ContentReport : submits
    User ||--o{ AuditLog : executes
    User ||--o| ReaderPreference : configures
    Manga ||--o{ Chapter : contains
    Manga ||--o{ MangaGenre : categorizes
    Manga ||--o{ UserLibrary : referenced_by
    Chapter ||--o{ ChapterPage : contains
    Genre ||--o{ MangaGenre : groups
    APIProvider ||--o{ APIEndpoint : declares
    APIProvider ||--o{ APIFieldMapping : maps
    APIProvider ||--o{ APIImportJob : executes
    APIImportJob ||--o{ APIImportRecord : tracks
```

---

## 7. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript (strict), Tailwind CSS, Lucide Icons |
| **State & Data** | TanStack Query v5, Zustand, React Hook Form, Zod |
| **Backend** | Next.js Server Actions & Route Handlers, Node.js 20 |
| **Database** | PostgreSQL 16, Prisma ORM 6.19, `@electric-sql/pglite` |
| **Security** | AES-256-GCM, Bcrypt, JWT, SSRF safe-fetch engine |
| **Storage** | Local Filesystem, AWS S3 / Cloudflare R2 SDK (`@aws-sdk/client-s3`), `adm-zip` |
| **Testing** | Vitest, TypeScript Typecheck (`tsc`), ESLint |
| **DevOps** | Multi-stage Dockerfile, Docker Compose |

---

## 8. Installation & Quick Start

### Prerequisites
- Node.js 20.x or higher
- npm 10.x or higher

### Local Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url> mangacms
   cd mangacms
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   *(Note: Leaving `DATABASE_URL` unset or empty will automatically boot the embedded zero-setup PostgreSQL engine in `data/pgdata`)*.

3. **Initialize database & seed sample data:**
   ```bash
   npx prisma generate
   npm run seed
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

---

## 9. Docker Deployment

Deploy the complete stack (Next.js Application + PostgreSQL 16 Database) using Docker Compose:

```bash
# Build images and start containers
docker-compose up -d --build

# Run database migrations and seed data inside container
docker exec -it mangacms_app npx prisma db push
docker exec -it mangacms_app npm run seed
```

View running services:
```bash
docker-compose ps
```

Stop services:
```bash
docker-compose down
```

---

## 10. Configuration & Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/mangacms` |
| `APP_SECRET` | 32-character encryption key for credentials | `your-32-char-app-secret-here` |
| `JWT_SECRET` | Secret key for signing JWT cookies | `your-jwt-signing-secret-here` |
| `STORAGE_PROVIDER` | Active asset storage driver (`local` or `s3`) | `local` |
| `LOCAL_STORAGE_PATH` | Directory path for local uploads | `/app/uploads` |
| `S3_REGION` | S3 region | `auto` |
| `S3_ENDPOINT` | S3 endpoint URL (e.g., Cloudflare R2) | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | S3 bucket name | `manga-assets` |
| `S3_ACCESS_KEY_ID` | S3 Access Key | `your-access-key` |
| `S3_SECRET_ACCESS_KEY`| S3 Secret Key | `your-secret-key` |
| `ALLOW_PRIVATE_NETWORK`| Allow internal IP requests (testing only) | `false` |

---

## 11. Automated Testing

Run the automated test suite powered by Vitest:

```bash
# Run all unit and integration tests
npm test

# Run tests with coverage
npx vitest run --coverage

# Run TypeScript strict type verification
npx tsc --noEmit

# Run Next.js production build verification
npm run build
```

### Test Coverage Highlights
- `tests/unit/safe-fetch.test.ts`: SSRF protections, loopback blocking, RFC1918 filtering, AWS metadata prevention, IPv6 ULA restriction.
- `tests/unit/json-mapper.test.ts`: Path extraction, JSONPath traversal, field mapping, heuristic auto-mapping.
- `tests/unit/pagination.test.ts`: Page, offset, cursor, and link pagination detection and computation.
- `tests/unit/encryption.test.ts`: AES-256-GCM encryption/decryption round-trip, tampered ciphertext detection.
- `tests/integration/manga-domain.test.ts`: Manga filtering, search queries, natural page ordering, library status, and debounced progress recording.
- `tests/integration/provider-import.test.ts`: Generic REST provider instantiation, external payload normalization, and duplicate-safe import tracking.

---

## 12. Default Credentials

The database seeder provisions the following accounts:

### Super Administrator
- **Username:** `admin`
- **Email:** `admin@mangacms.local`
- **Password:** `AdminPassword123!`
- **Access:** Complete CMS dashboard, Manga/Chapter CRUD, API Providers, Field Mappings, and Imports.

### Test Reader User
- **Username:** `otaku_reader`
- **Email:** `reader@mangacms.local`
- **Password:** `ReaderPassword123!`
- **Access:** Reading history, personal library collections, custom bookmarks, ratings, and reader preferences.

### Seeded Mock API Provider
- **Provider Name:** Global Manga REST Simulator
- **Endpoints Configured:** Search (`/api/mock-provider/manga`), Detail (`/api/mock-provider/manga/{id}`), Chapters (`/api/mock-provider/manga/{id}/chapters`), Pages (`/api/mock-provider/chapter/{id}/pages`).
- **Preconfigured Field Mappings:** Title, description, status, release year, content type, chapter number, page URLs.
- **Test URL for Mapper Console:** `http://localhost:3000/api/mock-provider/manga`

---

## License

MIT License. Designed and engineered for production-grade manga reading and content aggregation.
