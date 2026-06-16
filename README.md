# Shopify AI Copywriter — Frontend

Next.js 14 frontend embedded inside Shopify Admin via App Bridge.
Connects to the NestJS backend API for all AI operations.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: Shopify OAuth → JWT (stored in sessionStorage)
- **Data Fetching**: SWR (stale-while-revalidate)
- **HTTP Client**: Axios with auto token injection
- **Styling**: Custom CSS (design tokens, no Tailwind)
- **Typography**: Inter (body) + JetBrains Mono (code)

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                 # Root layout — AuthProvider
│   ├── page.tsx                   # Root redirect → /dashboard
│   ├── dashboard/page.tsx         # Overview — stats, quick actions, recent jobs
│   ├── rewrite/page.tsx           # Single product rewriter
│   ├── bulk/page.tsx              # Bulk rewrite — up to 50 products
│   ├── email/page.tsx             # Email copy generator (5 types)
│   ├── ad-copy/page.tsx           # Ad copy — 3 A/B variants × 4 platforms
│   ├── history/page.tsx           # Paginated job history with slide-in drawer
│   ├── settings/page.tsx          # Preferences + store info
│   └── upgrade/page.tsx           # Pricing plans
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx           # Auth gate + sidebar layout wrapper
│   │   └── Sidebar.tsx            # Dark sidebar — nav, usage bar, shop info
│   └── ui/
│       ├── Toast.tsx              # Toast notification system (context + provider)
│       ├── ToneSelector.tsx       # 6-tone grid selector (reusable)
│       ├── PageHeader.tsx         # Consistent page title + subtitle + action
│       └── CopyResultBox.tsx      # AI output box with one-click copy
├── hooks/
│   ├── useAuth.tsx                # Auth context — token verify, shop state
│   └── useData.ts                 # SWR hooks — usage stats, job history, products
├── lib/
│   └── api.ts                     # Axios instance + all API calls (auth/copywriter/products)
├── types/
│   └── index.ts                   # All shared TypeScript types
└── styles/
    └── globals.css                # Full design token system + component CSS
```

---

## Design System

### Color Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg` | `#F8F9FB` | Page background |
| `--color-surface` | `#FFFFFF` | Cards |
| `--color-accent` | `#4F46E5` | Electric indigo — CTAs, active states |
| `--color-text-primary` | `#0F1523` | Sidebar background + headings |
| `--color-success` | `#059669` | Completed status |
| `--color-error` | `#DC2626` | Errors |

### Typography
- **Body/UI**: Inter — weights 400, 500, 600, 700
- **Code/mono**: JetBrains Mono — token counts, product IDs, meta

### Component Classes (from globals.css)
- `.btn .btn-primary .btn-secondary .btn-ghost .btn-danger`
- `.card .card-body .card-header .card-footer`
- `.badge .badge-accent .badge-success .badge-error .badge-warning`
- `.form-input .form-textarea .form-select .form-label .form-group`
- `.tone-grid .tone-option`
- `.usage-bar-track .usage-bar-fill`
- `.skeleton` (shimmer loading)
- `.animate-fade-in .animate-slide-in`

---

## Setup

### 1. Install

```bash
cd frontend
npm install
cp .env.example .env.local
```

### 2. Configure .env.local

```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api/v1
NEXT_PUBLIC_SHOPIFY_API_KEY=your_shopify_api_key
```

### 3. Run dev

```bash
npm run dev
# App runs on http://localhost:3000
```

### 4. Build for production

```bash
npm run build
npm run start
```

---

## Auth Flow

```
Merchant installs app
        ↓
GET /api/v1/auth/install?shop=store.myshopify.com
        ↓
Shopify OAuth consent screen
        ↓
GET /api/v1/auth/callback?code=...&shop=...&hmac=...
        ↓
Backend: exchange code → access token → upsert shop → issue JWT
        ↓
Redirect to /dashboard?token=<jwt>&shop=<domain>
        ↓
Frontend: token → sessionStorage → useAuth validates → shop state loaded
        ↓
All API calls: Authorization: Bearer <token>
```

---

## Pages

| Route | Page | Key Features |
|-------|------|-------------|
| `/dashboard` | Dashboard | Stats grid, usage bar, quick actions, recent jobs |
| `/rewrite` | Product Rewriter | Form + tone selector + live result + Shopify push |
| `/bulk` | Bulk Rewrite | Product selector from live store, batch settings |
| `/email` | Email Copy | 5 email types, tone, discount, full email preview |
| `/ad-copy` | Ad Copy | 4 platforms, 3 A/B variants per generate |
| `/history` | Job History | Paginated table, slide-in drawer with full result |
| `/upgrade` | Pricing | 4 plan cards, Shopify billing note |
| `/settings` | Settings | Store info, default preferences, danger zone |

---

## Data Flow

```
Component
  → useData hook (SWR)
    → lib/api.ts (Axios + auto-auth)
      → NestJS Backend API
        → Claude API / Shopify API
```

---

## Nginx Config (EC2)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    # Allow Shopify iframe embedding
    add_header Content-Security-Policy "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com";

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Production with PM2
npm run build
pm2 start npm --name "ai-copywriter-frontend" -- start
pm2 save
```
