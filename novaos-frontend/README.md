# Novaux Frontend

A production-grade React PWA for NovaOS — Your Shield, Lens, and Sword.

## 🎨 Design

- **Home**: Pillowtalk-inspired dashboard with Overview/Lessons tabs
- **Chat**: Grok-style chat interface (Novaux 1)
- **Modules**: Finance, Health, Calendar, Reminders, Weather, Email

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🔗 Backend

The frontend connects to your NovaOS backend at `http://localhost:3000`.

API endpoints used:
- `POST /api/v1/auth/register` — Auto-register on first load
- `GET /api/v1/auth/status` — Check auth status
- `POST /api/v1/chat` — Send messages

## 📁 Project Structure

```
src/
├── app/                    # App shell
├── features/
│   ├── home/               # Pillowtalk dashboard
│   ├── chat/               # Grok-style chat
│   ├── modules/            # Module screens
│   ├── skills/             # Skills (placeholder)
│   └── settings/           # Settings page
├── shared/
│   ├── api/                # HTTP client
│   ├── components/         # UI components
│   ├── hooks/              # Custom hooks
│   ├── stores/             # Zustand stores
│   ├── types/              # TypeScript types
│   └── utils/              # Utilities
└── styles/                 # Global CSS
```

## 🛠 Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand

## 📲 PWA

Install on iPhone:
1. Open in Safari
2. Tap Share → Add to Home Screen
3. Tap Add

## 📄 License

Private — NovaOS Project
