# FinAlly — AI Trading Workstation

## Project Specification

## 1. Vision

FinAlly (Finance Ally) is a visually stunning AI-powered trading workstation that streams live market data, lets users trade a simulated portfolio, and integrates an LLM chat assistant that can analyze positions and execute trades on the user's behalf. It looks and feels like a modern Bloomberg terminal with an AI copilot.

This is the capstone project for an agentic AI coding course. It is built entirely by Coding Agents demonstrating how orchestrated AI agents can produce a production-quality full-stack application. Agents interact through files in `planning/`.

## 2. User Experience

### First Launch

The user runs a single Docker command (or a provided start script). A browser opens to `http://localhost:8000`. No login, no signup. They immediately see:

- A watchlist of 10 default tickers with live-updating prices in a grid
- $10,000 in virtual cash
- A dark, data-rich trading terminal aesthetic
- An AI chat panel ready to assist

### What the User Can Do

- **Watch prices stream** — prices flash green (uptick) or red (downtick) with subtle CSS animations that fade
- **View sparkline mini-charts** — price action beside each ticker in the watchlist, accumulated on the frontend from the SSE stream since page load (sparklines fill in progressively)
- **Click a ticker** to see a larger detailed chart in the main chart area
- **Buy and sell shares** — market orders only, instant fill at current price, no fees, no confirmation dialog
- **Monitor their portfolio** — a heatmap (treemap) showing positions sized by weight and colored by P&L, plus a P&L chart tracking total portfolio value over time
- **View a positions table** — ticker, quantity, average cost, current price, unrealized P&L, % change
- **Chat with the AI assistant** — ask about their portfolio, get analysis, and have the AI execute trades and manage the watchlist through natural language
- **Manage the watchlist** — add/remove tickers manually or via the AI chat

### Visual Design

- **Dark theme**: backgrounds around `#0d1117` or `#1a1a2e`, muted gray borders, no pure black
- **Price flash animations**: brief green/red background highlight on price change, fading over ~500ms via CSS transitions
- **Connection status indicator**: a small colored dot (green = connected, yellow = reconnecting, red = disconnected) visible in the header
- **Professional, data-dense layout**: inspired by Bloomberg/trading terminals — every pixel earns its place
- **Responsive but desktop-first**: optimized for wide screens, functional on tablet

### Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)

## 3. Architecture Overview

### Single Container, Single Port

```
┌─────────────────────────────────────────────────┐
│  Docker Container (port 8000)                   │
│                                                 │
│  FastAPI (Python/uv)                            │
│  ├── /api/*          REST endpoints             │
│  ├── /api/stream/*   SSE streaming              │
│  └── /*              Static file serving         │
│                      (Next.js export)            │
│                                                 │
│  SQLite database (volume-mounted)               │
│  Background task: market data polling/sim        │
└─────────────────────────────────────────────────┘
```

- **Frontend**: Next.js with TypeScript, built as a static export (`output: 'export'`), served by FastAPI as static files
- **Backend**: FastAPI (Python), managed as a `uv` project
- **Database**: SQLite, single file at `db/finally.db`, volume-mounted for persistence
- **Real-time data**: Server-Sent Events (SSE) — simpler than WebSockets, one-way server→client push, works everywhere
- **AI integration**: OpenAI using the GPT-5.4 mini model, with structured outputs for trade execution
- **Market data**: Environment-variable driven — simulator by default, real data via Massive API if key provided

### Why These Choices

| Decision | Rationale |
|---|---|
| SSE over WebSockets | One-way push is all we need; simpler, no bidirectional complexity, universal browser support |
| Static Next.js export | Single origin, no CORS issues, one port, one container, simple deployment |
| SQLite over Postgres | No auth = no multi-user = no need for a database server; self-contained, zero config |
| Single Docker container | Students run one command; no docker-compose for production, no service orchestration |
| uv for Python | Fast, modern Python project management; reproducible lockfile; what students should learn |
| Market orders only | Eliminates order book, limit order logic, partial fills — dramatically simpler portfolio math |

---

## 4. Directory Structure

```
finally/
├── frontend/                 # Next.js TypeScript project (static export)
├── backend/                  # FastAPI uv project (Python)
│   └── db/                   # Schema definitions, seed data, migration logic
├── planning/                 # Project-wide documentation for agents
│   ├── PLAN.md               # This document
│   └── ...                   # Additional agent reference docs
├── scripts/
│   ├── start_mac.sh          # Launch Docker container (macOS/Linux)
│   ├── stop_mac.sh           # Stop Docker container (macOS/Linux)
│   ├── start_windows.ps1     # Launch Docker container (Windows PowerShell)
│   └── stop_windows.ps1      # Stop Docker container (Windows PowerShell)
├── test/                     # Playwright E2E tests + docker-compose.test.yml
├── db/                       # Volume mount target (SQLite file lives here at runtime)
│   └── .gitkeep              # Directory exists in repo; finally.db is gitignored
├── Dockerfile                # Multi-stage build (Node → Python)
├── docker-compose.yml        # Optional convenience wrapper
├── .env                      # Environment variables (gitignored, .env.example committed)
└── .gitignore
```

### Key Boundaries

- **`frontend/`** is a self-contained Next.js project. It knows nothing about Python. It talks to the backend via `/api/*` endpoints and `/api/stream/*` SSE endpoints. Internal structure is up to the Frontend Engineer agent.
- **`backend/`** is a self-contained uv project with its own `pyproject.toml`. It owns all server logic including database initialization, schema, seed data, API routes, SSE streaming, market data, and LLM integration. Internal structure is up to the Backend/Market Data agents.
- **`backend/db/`** contains schema SQL definitions and seed logic. The backend lazily initializes the database on first request — creating tables and seeding default data if the SQLite file doesn't exist or is empty.
- **`db/`** at the top level is the runtime volume mount point. The SQLite file (`db/finally.db`) is created here by the backend and persists across container restarts via Docker volume.
- **`planning/`** contains project-wide documentation, including this plan. All agents reference files here as the shared contract.
- **`test/`** contains Playwright E2E tests and supporting infrastructure (e.g., `docker-compose.test.yml`). Unit tests live within `frontend/` and `backend/` respectively, following each framework's conventions.
- **`scripts/`** contains start/stop scripts that wrap Docker commands.

---

## 5. Environment Variables

```bash
# Required: OpenAI API key for LLM chat functionality
OPENAI_API_KEY=your-openai-api-key-here

# Optional: Massive (Polygon.io) API key for real market data
# If not set, the built-in market simulator is used (recommended for most users)
MASSIVE_API_KEY=

# Optional: Set to "true" for deterministic mock LLM responses (testing)
LLM_MOCK=false
```

### Behavior

- If `MASSIVE_API_KEY` is set and non-empty → backend uses Massive REST API for market data
- If `MASSIVE_API_KEY` is absent or empty → backend uses the built-in market simulator
- If `LLM_MOCK=true` → backend returns deterministic mock LLM responses (for E2E tests)
- The backend reads `.env` from the project root (mounted into the container or read via docker `--env-file`)

---

## 6. Market Data

### Two Implementations, One Interface

Both the simulator and the Massive client implement the same abstract interface. The backend selects which to use based on the environment variable. All downstream code (SSE streaming, price cache, frontend) is agnostic to the source.

### Simulator (Default)

- Generates prices using geometric Brownian motion (GBM) with configurable drift and volatility per ticker
- Updates at ~500ms intervals
- Correlated moves across tickers (e.g., tech stocks move together)
- Occasional random "events" — sudden 2-5% moves on a ticker for drama
- Starts from realistic seed prices (e.g., AAPL ~$190, GOOGL ~$175, etc.)
- Runs as an in-process background task — no external dependencies

### Massive API (Optional)

- REST API polling (not WebSocket) — simpler, works on all tiers
- Polls for the union of all watched tickers on a configurable interval
- Free tier (5 calls/min): poll every 15 seconds
- Paid tiers: poll every 2-15 seconds depending on tier
- Parses REST response into the same format as the simulator

### Shared Price Cache

- A single background task (simulator or Massive poller) writes to an in-memory price cache
- The cache holds the latest price, previous price, and timestamp for each ticker
- SSE streams read from this cache and push updates to connected clients
- This architecture supports future multi-user scenarios without changes to the data layer

### SSE Streaming

- Endpoint: `GET /api/stream/prices`
- Long-lived SSE connection; client uses native `EventSource` API
- Server pushes price updates for all tickers known to the system at a regular cadence (~500ms) — in the single-user model this is equivalent to the user's watchlist
- Each SSE event contains ticker, price, previous price, timestamp, and change direction
- Client handles reconnection automatically (EventSource has built-in retry)

---

## 7. Database

### SQLite with Lazy Initialization

The backend checks for the SQLite database on startup (or first request). If the file doesn't exist or tables are missing, it creates the schema and seeds default data. This means:

- No separate migration step
- No manual database setup
- Fresh Docker volumes start with a clean, seeded database automatically

### Schema

All tables include a `user_id` column defaulting to `"default"`. This is hardcoded for now (single-user) but enables future multi-user support without schema migration.

**users_profile** — User state (cash balance)
- `id` TEXT PRIMARY KEY (default: `"default"`)
- `cash_balance` REAL (default: `10000.0`)
- `created_at` TEXT (ISO timestamp)

**watchlist** — Tickers the user is watching
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `ticker` TEXT
- `added_at` TEXT (ISO timestamp)
- UNIQUE constraint on `(user_id, ticker)`

**positions** — Current holdings (one row per ticker per user)
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `ticker` TEXT
- `quantity` REAL (fractional shares supported)
- `avg_cost` REAL
- `updated_at` TEXT (ISO timestamp)
- UNIQUE constraint on `(user_id, ticker)`

**trades** — Trade history (append-only log)
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `ticker` TEXT
- `side` TEXT (`"buy"` or `"sell"`)
- `quantity` REAL (fractional shares supported)
- `price` REAL
- `executed_at` TEXT (ISO timestamp)

**portfolio_snapshots** — Portfolio value over time (for P&L chart). Recorded every 30 seconds by a background task, and immediately after each trade execution.
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `total_value` REAL
- `recorded_at` TEXT (ISO timestamp)

**chat_messages** — Conversation history with LLM
- `id` TEXT PRIMARY KEY (UUID)
- `user_id` TEXT (default: `"default"`)
- `role` TEXT (`"user"` or `"assistant"`)
- `content` TEXT
- `actions` TEXT (JSON — trades executed, watchlist changes made; null for user messages)
- `created_at` TEXT (ISO timestamp)

### Default Seed Data

- One user profile: `id="default"`, `cash_balance=10000.0`
- Ten watchlist entries: AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX

---

## 8. API Endpoints

### Market Data
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stream/prices` | SSE stream of live price updates |

### Portfolio
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/portfolio` | Current positions, cash balance, total value, unrealized P&L |
| POST | `/api/portfolio/trade` | Execute a trade: `{ticker, quantity, side}` |
| GET | `/api/portfolio/history` | Portfolio value snapshots over time (for P&L chart) |

### Watchlist
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/watchlist` | Current watchlist tickers with latest prices |
| POST | `/api/watchlist` | Add a ticker: `{ticker}` |
| DELETE | `/api/watchlist/{ticker}` | Remove a ticker |

### Chat
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send a message, receive complete JSON response (message + executed actions) |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (for Docker/deployment) |

---

## 9. LLM Integration

When writing code to make calls to LLMs, use OpenAI and the GPT-5.4 mini model. Structured Outputs should be used to interpret the results.

There is an `OPENAI_API_KEY` in the `.env` file in the project root.

### How It Works

When the user sends a chat message, the backend:

1. Loads the user's current portfolio context (cash, positions with P&L, watchlist with live prices, total portfolio value)
2. Loads recent conversation history from the `chat_messages` table
3. Constructs a prompt with a system message, portfolio context, conversation history, and the user's new message
4. Calls the LLM via OpenAI with the GPT-5.4 mini model, requesting structured output
5. Parses the complete structured JSON response
6. Auto-executes any trades or watchlist changes specified in the response
7. Stores the message and executed actions in `chat_messages`
8. Returns the complete JSON response to the frontend (no token-by-token streaming — a loading indicator is sufficient)

### Structured Output Schema

The LLM is instructed to respond with JSON matching this schema:

```json
{
  "message": "Your conversational response to the user",
  "trades": [
    {"ticker": "AAPL", "side": "buy", "quantity": 10}
  ],
  "watchlist_changes": [
    {"ticker": "PYPL", "action": "add"}
  ]
}
```

- `message` (required): The conversational text shown to the user
- `trades` (optional): Array of trades to auto-execute. Each trade goes through the same validation as manual trades (sufficient cash for buys, sufficient shares for sells)
- `watchlist_changes` (optional): Array of watchlist modifications

### Auto-Execution

Trades specified by the LLM execute automatically — no confirmation dialog. This is a deliberate design choice:
- It's a simulated environment with fake money, so the stakes are zero
- It creates an impressive, fluid demo experience
- It demonstrates agentic AI capabilities — the core theme of the course

If a trade fails validation (e.g., insufficient cash), the error is included in the chat response so the LLM can inform the user.

### System Prompt Guidance

The LLM should be prompted as "FinAlly, an AI trading assistant" with instructions to:
- Analyze portfolio composition, risk concentration, and P&L
- Suggest trades with reasoning
- Execute trades when the user asks or agrees
- Manage the watchlist proactively
- Be concise and data-driven in responses
- Always respond with valid structured JSON

### LLM Mock Mode

When `LLM_MOCK=true`, the backend returns deterministic mock responses instead of calling OpenAI. This enables:
- Fast, free, reproducible E2E tests
- Development without an API key
- CI/CD pipelines

---

## 10. Frontend Design

### Layout

The frontend is a single-page application with a dense, terminal-inspired layout. The specific component architecture and layout system is up to the Frontend Engineer, but the UI should include these elements:

- **Watchlist panel** — grid/table of watched tickers with: ticker symbol, current price (flashing green/red on change), daily change %, and a sparkline mini-chart (accumulated from SSE since page load)
- **Main chart area** — larger chart for the currently selected ticker, with at minimum price over time. Clicking a ticker in the watchlist selects it here.
- **Portfolio heatmap** — treemap visualization where each rectangle is a position, sized by portfolio weight, colored by P&L (green = profit, red = loss)
- **P&L chart** — line chart showing total portfolio value over time, using data from `portfolio_snapshots`
- **Positions table** — tabular view of all positions: ticker, quantity, avg cost, current price, unrealized P&L, % change
- **Trade bar** — simple input area: ticker field, quantity field, buy button, sell button. Market orders, instant fill.
- **AI chat panel** — docked/collapsible sidebar. Message input, scrolling conversation history, loading indicator while waiting for LLM response. Trade executions and watchlist changes shown inline as confirmations.
- **Header** — portfolio total value (updating live), connection status indicator, cash balance

### Technical Notes

- Use `EventSource` for SSE connection to `/api/stream/prices`
- Canvas-based charting library preferred (Lightweight Charts or Recharts) for performance
- Price flash effect: on receiving a new price, briefly apply a CSS class with background color transition, then remove it
- All API calls go to the same origin (`/api/*`) — no CORS configuration needed
- Tailwind CSS for styling with a custom dark theme

---

## 11. Docker & Deployment

### Multi-Stage Dockerfile

```
Stage 1: Node 20 slim
  - Copy frontend/
  - npm install && npm run build (produces static export)

Stage 2: Python 3.12 slim
  - Install uv
  - Copy backend/
  - uv sync (install Python dependencies from lockfile)
  - Copy frontend build output into a static/ directory
  - Expose port 8000
  - CMD: uvicorn serving FastAPI app
```

FastAPI serves the static frontend files and all API routes on port 8000.

### Docker Volume

The SQLite database persists via a named Docker volume:

```bash
docker run -v finally-data:/app/db -p 8000:8000 --env-file .env finally
```

The `db/` directory in the project root maps to `/app/db` in the container. The backend writes `finally.db` to this path.

### Start/Stop Scripts

**`scripts/start_mac.sh`** (macOS/Linux):
- Builds the Docker image if not already built (or if `--build` flag passed)
- Runs the container with the volume mount, port mapping, and `.env` file
- Prints the URL to access the app
- Optionally opens the browser

**`scripts/stop_mac.sh`** (macOS/Linux):
- Stops and removes the running container
- Does NOT remove the volume (data persists)

**`scripts/start_windows.ps1`** / **`scripts/stop_windows.ps1`**: PowerShell equivalents for Windows.

All scripts should be idempotent — safe to run multiple times.

### Optional Cloud Deployment

The container is designed to deploy to AWS App Runner, Render, or any container platform. A Terraform configuration for App Runner may be provided in a `deploy/` directory as a stretch goal, but is not part of the core build.

---

## 12. Testing Strategy

### Unit Tests (within `frontend/` and `backend/`)

**Backend (pytest)**:
- Market data: simulator generates valid prices, GBM math is correct, Massive API response parsing works, both implementations conform to the abstract interface
- Portfolio: trade execution logic, P&L calculations, edge cases (selling more than owned, buying with insufficient cash, selling at a loss)
- LLM: structured output parsing handles all valid schemas, graceful handling of malformed responses, trade validation within chat flow
- API routes: correct status codes, response shapes, error handling

**Frontend (React Testing Library or similar)**:
- Component rendering with mock data
- Price flash animation triggers correctly on price changes
- Watchlist CRUD operations
- Portfolio display calculations
- Chat message rendering and loading state

### E2E Tests (in `test/`)

**Infrastructure**: A separate `docker-compose.test.yml` in `test/` that spins up the app container plus a Playwright container. This keeps browser dependencies out of the production image.

**Environment**: Tests run with `LLM_MOCK=true` by default for speed and determinism.

**Key Scenarios**:
- Fresh start: default watchlist appears, $10k balance shown, prices are streaming
- Add and remove a ticker from the watchlist
- Buy shares: cash decreases, position appears, portfolio updates
- Sell shares: cash increases, position updates or disappears
- Portfolio visualization: heatmap renders with correct colors, P&L chart has data points
- AI chat (mocked): send a message, receive a response, trade execution appears inline
- SSE resilience: disconnect and verify reconnection

---

## 13. Agent Build Status (as of 2026-05-07)

This section tracks implementation progress by the AI agent team. Updated after each work session.

### Team Members
- **database-engineer** — SQLite schema, initialization, repository
- **backend-engineer** — FastAPI main app, portfolio/watchlist API endpoints (complete)
- **frontend-engineer** — Tasks #3, #7, #8 complete; Task #9 (ChatPanel) next
- **llm-engineer** — OpenAI chat endpoint (complete — Task #6 done)
- **devops-engineer** — Docker, scripts (scripts done; Dockerfile unblocked, ready for Task #10)
- **integration-tester** — Playwright E2E tests (waiting on Docker + frontend)

### Component Status

| Section | Component | Status | Files Created |
|---------|-----------|--------|---------------|
| §7 Database | Schema (all 6 tables) | **DONE** | `backend/app/db/schema.py` |
| §7 Database | DB init + seed (user + 10 tickers) | **DONE** | `backend/app/db/init_db.py` |
| §7 Database | Repository CRUD layer | **DONE** | `backend/app/db/repository.py` |
| §7 Database | DB unit tests (32 passing) | **DONE** | `backend/tests/db/test_init_db.py`, `test_repository.py` |
| §6 Market Data | Simulator, cache, SSE stream, Massive client | **DONE** (pre-existing) | `backend/app/market/` |
| §8 API — System | `GET /api/health` | **DONE** | `backend/app/main.py` |
| §8 API — Market | `GET /api/stream/prices` (SSE) | **DONE** | `backend/app/main.py` + `market/stream.py` |
| §8 API — Portfolio | `GET /api/portfolio` | **DONE** | `backend/app/api/portfolio.py` |
| §8 API — Portfolio | `POST /api/portfolio/trade` | **DONE** | `backend/app/api/portfolio.py` |
| §8 API — Portfolio | `GET /api/portfolio/history` | **DONE** | `backend/app/api/portfolio.py` |
| §8 API — Watchlist | `GET /api/watchlist` | **DONE** | `backend/app/api/watchlist.py` |
| §8 API — Watchlist | `POST /api/watchlist` | **DONE** | `backend/app/api/watchlist.py` |
| §8 API — Watchlist | `DELETE /api/watchlist/{ticker}` | **DONE** | `backend/app/api/watchlist.py` |
| §8 API — Chat | `POST /api/chat` | **DONE** | `backend/app/api/chat.py` |
| §9 LLM Integration | OpenAI structured outputs + auto-execute | **DONE** | `backend/app/api/chat.py` |
| §10 Frontend | Next.js project bootstrap | **DONE** | `frontend/next.config.ts`, `app/layout.tsx`, `app/globals.css` (Tailwind v4 `@theme`), `app/page.tsx` (full terminal layout shell), `postcss.config.mjs`; build produces `out/` |
| §10 Frontend | SSE hook + types + API lib | **DONE** | `frontend/lib/types.ts`, `frontend/lib/api.ts`, `frontend/lib/useSSE.ts` |
| §10 Frontend | Header + WatchlistPanel + Sparkline | **DONE** | `frontend/components/Header.tsx`, `frontend/components/Sparkline.tsx`, `frontend/components/WatchlistPanel.tsx` |
| §10 Frontend | PortfolioHeatmap + PnLChart + PositionsTable + TradeBar + MainChart | **DONE** | `frontend/components/PortfolioHeatmap.tsx`, `PnLChart.tsx`, `PositionsTable.tsx`, `TradeBar.tsx`, `MainChart.tsx` |
| §10 Frontend | ChatPanel | **NOT STARTED** | — |
| §11 Docker | `Dockerfile` (multi-stage) | **NOT STARTED** | — |
| §11 Docker | `docker-compose.yml` | **NOT STARTED** | — |
| §11 Docker | Start/stop scripts | **DONE** | `scripts/start_windows.ps1`, `stop_windows.ps1`, `start_mac.sh`, `stop_mac.sh` |
| §11 Docker | `.env.example` | **DONE** | `.env.example` |
| §11 Docker | `db/.gitkeep` | **DONE** | `db/.gitkeep` |
| §12 Testing | Backend DB unit tests | **DONE** | `backend/tests/db/` |
| §12 Testing | Backend market unit tests | **DONE** (pre-existing) | `backend/tests/market/` |
| §12 Testing | Backend API unit tests (chat) | **DONE** | `backend/tests/api/test_chat.py` |
| §12 Testing | E2E Playwright tests | **NOT STARTED** | — |

### Task Definitions

Each numbered task below maps to the agent task list in `finally-team`. Tasks are listed in dependency order.

---

#### Task #1 — SQLite schema, initialization, and seed data
**Owner**: database-engineer | **Status**: DONE

- `backend/app/db/schema.py` — `CREATE TABLE IF NOT EXISTS` for all 6 tables (§7)
- `backend/app/db/init_db.py` — `init_db(db_path)`: creates tables, seeds default user ($10k cash), seeds 10 default watchlist tickers. Idempotent. Exposes `get_default_db_path()` reading `DB_PATH` env.
- `backend/app/db/__init__.py` — re-exports `init_db`, `get_default_db_path`
- `backend/tests/db/test_init_db.py` — 7 pytest tests (fresh init, idempotency, seed data)

---

#### Task #2 — FastAPI main application skeleton
**Owner**: backend-engineer | **Status**: DONE

- `backend/app/main.py` — FastAPI app with lifespan: calls `init_db`, starts market data background task via `create_market_data_source()`, stops on shutdown. Registers SSE router (`/api/stream/prices`). Mounts `backend/static/` as static files at `/`. `GET /api/health` → `{"status":"ok"}`.

---

#### Task #3 — Next.js frontend project bootstrap
**Owner**: frontend-engineer | **Status**: DONE

- `frontend/next.config.ts` — `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true`
- `frontend/postcss.config.mjs` — `@tailwindcss/postcss` plugin (Tailwind v4)
- `frontend/app/globals.css` — Tailwind v4 `@import "tailwindcss"` + `@theme` with full dark color palette, flash-up/flash-down keyframe animations, scrollbar styling
- `frontend/app/layout.tsx` — Geist fonts, metadata, `h-full` body
- `frontend/app/page.tsx` — full terminal layout shell: fixed header (logo, total value, cash, connection dot), left watchlist sidebar, center column (chart + trade bar + heatmap/P&L/positions), right AI chat sidebar; all regions labeled with placeholder content
- `frontend/lib/types.ts` — TypeScript interfaces: `PriceUpdate`, `WatchlistEntry`, `Position`, `Portfolio`, `TradeRequest`, `Trade`, `PortfolioSnapshot`, `ChatMessage`, `ChatActions`, `WatchlistChange`, `ChatRequest`
- `frontend/lib/api.ts` — typed fetch wrappers for all 7 REST endpoints
- `frontend/components/` — directory created
- `npm run build` passes; `out/` static export confirmed

---

#### Task #4 — Database access layer (repository)
**Owner**: database-engineer | **Status**: DONE

- `backend/app/db/repository.py` — all CRUD functions taking `sqlite3.Connection` as first arg:
  - `get_user_profile`, `update_cash_balance`
  - `get_watchlist`, `add_to_watchlist`, `remove_from_watchlist`
  - `get_positions`, `get_position`, `upsert_position`, `delete_position`
  - `add_trade`, `get_trades`
  - `add_portfolio_snapshot`, `get_portfolio_snapshots`
  - `add_chat_message`, `get_chat_messages`
- `backend/tests/db/test_repository.py` — 25 pytest tests

---

#### Task #5 — Portfolio and watchlist REST API endpoints
**Owner**: backend-engineer | **Status**: DONE
**Blocked by**: Tasks #2, #4

- `backend/app/api/deps.py` — `get_db()` FastAPI dependency yielding `sqlite3.Connection`
- `backend/app/api/portfolio.py` — `APIRouter(prefix="/api/portfolio")`:
  - `GET /api/portfolio` — cash, positions with live prices/P&L from `PriceCache`, total value
  - `POST /api/portfolio/trade` — body `{ticker, quantity, side}`. Validates cash (buys) and shares (sells). Updates cash, upserts position (weighted avg cost), logs trade, takes snapshot.
  - `GET /api/portfolio/history` — snapshot list for P&L chart
- `backend/app/api/watchlist.py` — `APIRouter(prefix="/api/watchlist")`:
  - `GET /api/watchlist` — tickers with current prices from cache
  - `POST /api/watchlist` — `{ticker}` adds to watchlist
  - `DELETE /api/watchlist/{ticker}` — removes ticker
- Portfolio snapshot background task (every 30 s) added to lifespan in `main.py`
- Routers wired into `main.py`
- `backend/tests/api/` — FastAPI TestClient unit tests

---

#### Task #6 — LLM chat endpoint (`POST /api/chat`)
**Owner**: llm-engineer | **Status**: DONE
**Blocked by**: ~~Task #5~~ — UNBLOCKED

- `backend/app/api/chat.py` — `APIRouter(prefix="/api/chat")`:
  - `POST /api/chat` body `{message: str}`
  - Builds portfolio context + last 20 chat messages as LLM prompt
  - Calls OpenAI (`gpt-4o-mini`) with structured output: `{message, trades?, watchlist_changes?}`
  - Auto-executes trades (same validation as `/api/portfolio/trade`)
  - Auto-applies watchlist changes
  - Stores user + assistant messages in `chat_messages` table
  - Returns `{message, trades_executed, watchlist_changes_applied, errors}`
- **LLM mock mode**: `LLM_MOCK=true` env → skip OpenAI, return deterministic mock response
- `openai` package added via `uv add openai`
- Router wired into `main.py`
- `backend/tests/api/test_chat.py` — tests using `LLM_MOCK=true`

---

#### Task #7 — Frontend: SSE hook, Header, WatchlistPanel, Sparkline
**Owner**: frontend-engineer | **Status**: DONE

- `frontend/lib/types.ts` — updated: `PriceUpdate` uses `previous_price` matching `to_dict()`; `WatchlistEntry` matches `/api/watchlist` response shape
- `frontend/lib/api.ts` — typed fetch wrappers for all endpoints
- `frontend/lib/useSSE.ts` — `EventSource` hook; parses batch `{ticker: PriceUpdate}` SSE events; maintains `Map<ticker, PriceUpdate>` and sparkline history `Map<ticker, number[]>` (last 60 pts); exposes `connected | reconnecting | disconnected` status
- `frontend/components/Header.tsx` — brand "FinAlly" (accent yellow), live total portfolio value, cash balance, connection status dot (green/yellow/red)
- `frontend/components/Sparkline.tsx` — small SVG line chart from `number[]`
- `frontend/components/WatchlistPanel.tsx` — ticker grid with price flash animation (CSS class applied for ~500ms on price change), sparkline per row, click to select ticker
- `frontend/app/page.tsx` updated to show Header + WatchlistPanel
- `npm run build` must pass

---

#### Task #8 — Frontend: portfolio views (heatmap, P&L chart, positions table, trade bar, main chart)
**Owner**: frontend-engineer | **Status**: DONE
**Blocked by**: Task #7

- `frontend/components/PortfolioHeatmap.tsx` — treemap of positions sized by portfolio weight, colored by P&L %
- `frontend/components/PnLChart.tsx` — portfolio value over time from `/api/portfolio/history` (lightweight-charts or recharts, dark theme)
- `frontend/components/PositionsTable.tsx` — positions table with live price updates; P&L column colored green/red
- `frontend/components/TradeBar.tsx` — ticker + qty inputs; Buy (blue `#209dd7`) + Sell (purple `#753991`) buttons; calls `POST /api/portfolio/trade`; shows inline error on failure
- `frontend/components/MainChart.tsx` — larger price chart for selected ticker using accumulated SSE history
- Full trading terminal layout in `app/page.tsx`: header top, watchlist left panel (~280 px), main chart center-top, heatmap center-bottom, positions + trade bar bottom, chat sidebar right
- `npm run build` must pass

---

#### Task #9 — Frontend: AI chat panel
**Owner**: frontend-engineer | **Status**: NOT STARTED
**Blocked by**: Tasks #6, #8

- `frontend/components/ChatPanel.tsx` — collapsible right sidebar:
  - Scrolling message history (user right-aligned, assistant left-aligned)
  - Loading spinner while awaiting LLM response
  - Trade execution + watchlist change confirmation cards inline
  - Text input + Send button (purple `#753991`)
  - Calls `POST /api/chat`; refreshes portfolio data after AI executes trades
- Chat toggle button in Header
- `npm run build` must pass

---

#### Task #10 — Dockerfile, docker-compose, and deployment artifacts
**Owner**: devops-engineer | **Status**: NOT STARTED (scripts already done)
**Blocked by**: ~~Tasks #3, #5~~ — UNBLOCKED

- `Dockerfile` — multi-stage: Stage 1 Node 20 slim builds `frontend/out/`; Stage 2 Python 3.12 slim installs uv, runs `uv sync --no-dev`, copies frontend export to `/app/backend/static/` (matches `main.py` path resolution), exposes 8000, CMD `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`
- `docker-compose.yml` — single service, port 8000, volume `finally-data:/app/db`, `env_file: .env`
- **Already done**: `scripts/start_windows.ps1`, `scripts/stop_windows.ps1`, `scripts/start_mac.sh`, `scripts/stop_mac.sh`, `.env.example`, `db/.gitkeep`
- Validate with `docker build .`

---

#### Task #11 — Playwright E2E tests
**Owner**: integration-tester | **Status**: NOT STARTED
**Blocked by**: Tasks #9, #10

- `test/package.json` + `test/playwright.config.ts` — Playwright setup targeting `http://localhost:8000`
- `test/docker-compose.test.yml` — spins up app with `LLM_MOCK=true`, health check on `/api/health`
- `test/tests/smoke.spec.ts` — 10 tickers visible, $10k cash in header, prices changing within 5 s, green connection dot
- `test/tests/watchlist.spec.ts` — add ticker (PYPL appears), remove ticker (disappears)
- `test/tests/trading.spec.ts` — buy 10 AAPL (cash decreases, position appears), sell 5 AAPL (quantity updates)
- `test/tests/chat.spec.ts` — send message, response appears within 10 s, loading indicator shown then hidden
- `test/run_tests.ps1` — starts `docker-compose.test.yml`, waits for health, runs Playwright, tears down, exits with test exit code
- Run tests and report results; any failures fed back to responsible engineer

---

### What Remains

Resume in this priority order:

1. **frontend-engineer**: Task #9 — ChatPanel (unblocked — Tasks #6 and #8 done)
2. **devops-engineer**: Task #10 — Dockerfile + docker-compose.yml (unblocked)
3. **integration-tester**: Task #11 — Playwright E2E tests (blocked by #9 and #10)

### Resume Instructions

Tasks #3, #5, #6, #7, and #8 are complete. Tasks #9 and #10 are unblocked and ready to start.

- Task #9 (ready) → frontend-engineer
- Task #10 (ready) → devops-engineer
- Task #11 (blocked by #9 and #10) → integration-tester
- Task #11 (blocked by #9 and #10) → integration-tester