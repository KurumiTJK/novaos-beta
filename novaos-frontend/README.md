# NovaOS Frontend

A React-based Progressive Web App (PWA) optimized for iPhone, serving as the official frontend for the NovaOS constitutional AI backend.

## Features

- **7 Core Screens**
  - Dashboard — Home with modules grid and recent conversations
  - Chat (Lens) — Default conversation mode with confidence/freshness indicators
  - Shield Warning — Protection alerts with Interest Stack conflicts
  - Control Crisis Mode — Persistent crisis resolution with vitals, location, threats
  - Module Sessions — Finance, Health, Calendar, Weather, etc.
  - Sword Lesson Generator — Goal → Quest → Lesson path creation
  - Sword Daily Lesson — Active learning with progress tracking

- **Stance-Based Design System**
  - 🔴 Control (Red) — Crisis/halt mode
  - 🟡 Shield (Amber) — Protection warnings
  - 🔵 Lens (Blue) — Clarity/information (default)
  - 🟢 Sword (Green) — Action/progress

- **PWA Optimized**
  - Installable on iOS home screen
  - Offline-capable with service worker
  - Native-like experience

## Tech Stack

- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Zustand (state management)
- React Query (server state)
- Framer Motion (animations)
- React Router (navigation)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (connects to backend at localhost:3001)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3001/api/v1
```

## Project Structure

```
src/
├── api/                 # API client and endpoints
│   ├── client.ts       # HTTP client with auth
│   ├── auth.ts         # Auth endpoints
│   └── chat.ts         # Chat endpoints
├── components/
│   ├── ui/             # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── StatusBar.tsx
│   └── chat/           # Chat-specific components
│       └── MessageBubble.tsx
├── pages/              # Route pages
│   ├── DashboardPage.tsx
│   ├── ChatPage.tsx
│   ├── ControlPage.tsx
│   ├── SwordPage.tsx
│   └── ModulePage.tsx
├── stores/             # Zustand stores
│   ├── authStore.ts
│   ├── chatStore.ts
│   ├── appStore.ts
│   ├── controlStore.ts
│   └── swordStore.ts
├── types/              # TypeScript types
│   └── index.ts
├── utils/              # Utilities
│   ├── theme.ts        # Stance colors
│   └── index.ts
├── styles/
│   └── index.css       # Tailwind + custom styles
├── App.tsx             # Main app with routing
└── main.tsx            # Entry point
```

## Docker Deployment

### Full Stack (Frontend + Backend + Redis)

```bash
# Set your OpenAI API key
export OPENAI_API_KEY=your_key_here

# Build and run
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Frontend Only

```bash
# Build image
docker build -t novaos-frontend .

# Run (assumes backend at backend:3001)
docker run -p 80:80 novaos-frontend
```

## API Integration

The frontend connects to the NovaOS backend API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/chat` | POST | Send message (auto-manages conversations) |
| `/api/v1/conversations` | GET | List conversations |
| `/api/v1/conversations/:id` | GET | Get conversation with messages |
| `/api/v1/auth/register` | POST | Register and get token |
| `/api/v1/auth/verify` | GET | Verify token |
| `/api/v1/health` | GET | Health check |

## Constitutional Modes

### Control Mode (Crisis)

Triggered when `safety_signal: 'high'` is detected in Shield Gate. Pipeline halts and enters persistent crisis resolution session with:

- Live vitals from health devices
- GPS location with nearby emergency services
- Threat scan from web/news
- Step-by-step action plan

### Sword Mode (Learning)

Triggered when `learning_intent: true` + `stance: 'sword'`. Creates structured learning paths:

- **Goal** → User's learning objective
- **Quest** → Themed collection (2-4 weeks)
- **Lesson** → Single day's session
- **Spark** → Minimal action for momentum

## PWA Installation

### iOS (iPhone)

1. Open in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. Name it "Nova"

### Android

1. Open in Chrome
2. Tap menu (⋮)
3. Select "Install app"

## Development

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Format (if prettier configured)
npm run format
```

## License

MIT
