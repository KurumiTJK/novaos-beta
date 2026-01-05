# NovaOS Frontend v2

A feature-based React PWA for NovaOS — Your Shield, Lens, and Sword.

## 🏗️ Architecture

This project uses a **feature-based architecture** for scalability:

```
src/
├── features/           # Feature modules (self-contained)
│   ├── auth/           # Authentication
│   │   ├── authApi.ts
│   │   ├── authStore.ts
│   │   └── index.ts
│   ├── chat/           # Chat functionality
│   │   ├── chatApi.ts
│   │   ├── chatStore.ts
│   │   ├── ChatPage.tsx
│   │   ├── components/
│   │   │   └── MessageBubble.tsx
│   │   └── index.ts
│   ├── control/        # Crisis mode
│   │   ├── controlStore.ts
│   │   ├── ControlPage.tsx
│   │   ├── components/
│   │   └── index.ts
│   ├── sword/          # Learning mode
│   │   ├── swordStore.ts
│   │   ├── SwordPage.tsx
│   │   └── index.ts
│   ├── dashboard/      # Dashboard
│   │   ├── DashboardPage.tsx
│   │   └── index.ts
│   └── modules/        # Domain modules
│       ├── ModulePage.tsx
│       └── index.ts
├── shared/             # Shared code
│   ├── api/            # HTTP client
│   ├── components/     # UI primitives
│   ├── hooks/          # Custom hooks
│   ├── types/          # TypeScript types
│   └── utils/          # Helpers & theme
├── styles/             # Global CSS
├── App.tsx             # Root component
└── main.tsx            # Entry point
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 18 |
| Language | TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Server State | React Query |
| Animations | Framer Motion |
| Routing | React Router |
| PWA | Vite PWA Plugin |

## 📱 Features

### Stances (Constitutional AI Modes)

| Stance | Color | Purpose |
|--------|-------|---------|
| 🛑 Control | Red | Crisis stabilization |
| 🛡️ Shield | Amber | Protection from harm |
| 🔍 Lens | Blue | Clarity and understanding |
| ⚔️ Sword | Green | Forward progress |

### Screens

1. **Dashboard** — Home screen with quick actions
2. **Chat** — Main Nova conversation interface
3. **Control** — Crisis mode with vitals, location, action plan
4. **Sword** — Structured learning paths
5. **Modules** — Domain-specific interfaces (Finance, Health, etc.)

## 🐳 Docker Deployment

```bash
# Full stack (frontend + backend + redis)
docker-compose up -d

# Frontend only
docker build -t novaos-frontend .
docker run -p 80:80 novaos-frontend
```

## 📦 API Integration

The frontend integrates with the NovaOS backend API:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/chat` | Send message, get response |
| `POST /api/v1/parse-command` | Preview intent |
| `GET /api/v1/conversations` | List conversations |
| `POST /api/v1/auth/register` | Auto-register user |

## 🎨 Design System

### Colors

- **Gray 950**: `#0a0a0a` (OLED black)
- **Control**: `#ef4444` (Red 500)
- **Shield**: `#f59e0b` (Amber 500)
- **Lens**: `#3b82f6` (Blue 500)
- **Sword**: `#10b981` (Emerald 500)

### Typography

SF Pro Display / System fonts for native feel.

## 📲 PWA Installation

**iOS Safari:**
1. Open the app in Safari
2. Tap Share → Add to Home Screen
3. Tap Add

**Android Chrome:**
1. Open the app in Chrome
2. Tap menu → Install app
3. Tap Install

## 🔧 Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint
```

## 📄 License

Private — Anthropic / NovaOS Project
