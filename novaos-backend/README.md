# NovaOS Backend

Constitutional AI assistant backend with Shield (protection), Lens (clarity), and Sword (action).

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-org/novaos-backend.git
cd novaos-backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Run development server
npm run dev
```

## Prerequisites

- **Node.js** 20+ 
- **npm** 10+
- **Docker** (optional, for containerized development)

## Environment Setup

### Required API Keys

| Service | Purpose | Get it from |
|---------|---------|-------------|
| OpenAI | LLM (pipeline + generation) | [platform.openai.com](https://platform.openai.com/api-keys) |
| JWT Secret | Authentication | Generate: `openssl rand -hex 32` |

### Optional (Recommended)

| Service | Purpose | Get it from |
|---------|---------|-------------|
| Gemini | Grounded responses | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Supabase | PostgreSQL database | [supabase.com](https://supabase.com) |
| Upstash | Redis (sessions/cache) | [upstash.com](https://upstash.com) |
| Google CSE | Web search for lessons | [programmablesearchengine.google.com](https://programmablesearchengine.google.com/) |

## Development

```bash
# Start development server (hot reload)
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

## Docker Development

```bash
# Start with Docker Compose (includes Redis)
docker-compose up

# Rebuild after changes
docker-compose up --build

# View logs
docker-compose logs -f novaos
```

## Project Structure

```
src/
├── api/              # Express routes
│   ├── routes.ts     # Main router
│   ├── sword-routes.ts
│   └── shield-routes.ts
├── core/             # Core business logic
│   └── memory/       # Working memory
├── db/               # Database (Supabase)
├── gates/            # 8-Gate Pipeline
│   ├── intent_gate/
│   ├── shield_gate/
│   ├── response_gate/
│   └── constitution_gate/
├── pipeline/         # Execution pipeline
├── security/         # Auth, rate limiting
├── services/         # Business services
│   ├── shield/       # Protection system
│   └── sword/        # Learning system
├── storage/          # Redis storage
└── server.ts         # Entry point
```

## API Endpoints

### Health
- `GET /health` - Health check
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe

### Auth
- `POST /api/v1/auth/register` - Get token
- `POST /api/v1/auth/refresh` - Refresh tokens
- `POST /api/v1/auth/logout` - Logout

### Chat
- `POST /api/v1/chat` - Main chat endpoint

### Shield (Protection)
- `GET /api/v1/shield/status` - Check crisis status
- `POST /api/v1/shield/confirm` - Confirm warning
- `POST /api/v1/shield/safe` - Confirm safety

### Sword (Learning)
- `GET /api/v1/sword` - Full state
- `GET /api/v1/sword/today` - Today's content
- `POST /api/v1/sword/spark` - Generate spark
- See full API in [server.ts](./src/server.ts) startup banner

## Production Deployment

### AWS Lightsail Setup

1. **Create Lightsail instance** (Ubuntu 22.04, 2GB RAM minimum)

2. **Install Docker**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker ubuntu
   ```

3. **Clone and configure**
   ```bash
   sudo mkdir -p /opt/novaos
   sudo chown ubuntu:ubuntu /opt/novaos
   cd /opt/novaos
   git clone https://github.com/your-org/novaos-backend.git .
   cp .env.example .env.production
   # Edit .env.production with production values
   ```

4. **Deploy**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

5. **Configure Cloudflare**
   - Point DNS to Lightsail IP
   - Enable SSL (Full strict)
   - Enable WAF

### GitHub Actions Deployment

1. Add secrets to GitHub:
   - `LIGHTSAIL_HOST` - Server IP
   - `LIGHTSAIL_USER` - SSH user (ubuntu)
   - `LIGHTSAIL_SSH_KEY` - Private SSH key

2. Push to `main` → auto-deploys to staging

3. Manual deploy to production via Actions tab

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/tests/gates/shield_gate/shield-gate.test.ts

# Run with coverage
npm run test:coverage

# Interactive UI
npm run test:ui
```

## Architecture

### 8-Gate Pipeline

```
User Message
     │
     ▼
┌─────────────┐
│ Gate 1:     │ Intent classification
│ INTENT      │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Gate 2:     │ Safety/crisis detection
│ SHIELD      │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Gate 3:     │ Tool routing
│ TOOLS       │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Gate 4:     │ Stance selection
│ STANCE      │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Gate 5:     │ Live data fetching
│ CAPABILITY  │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Gate 6:     │ LLM response generation
│ RESPONSE    │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Gate 7:     │ Constitution validation
│ CONSTITUTION│
└─────────────┘
     │
     ▼
┌─────────────┐
│ Gate 8:     │ Memory storage
│ MEMORY      │
└─────────────┘
     │
     ▼
  Response
```

### Operational Modes

| Mode | Color | Purpose |
|------|-------|---------|
| CONTROL | Red | Safety/crisis (highest priority) |
| SHIELD | Blue | Protection |
| LENS | Purple | Clarity |
| SWORD | Green | Forward motion |

## License

Proprietary - All rights reserved
