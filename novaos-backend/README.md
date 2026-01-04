# NovaOS Backend

Constitutional AI assistant backend with an 8-gate pipeline.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

## Required API Keys

- **OpenAI** — General responses (default provider)
- **Gemini** — Web search / grounded responses

## Architecture

```
User Message → Intent → Shield → Tools → Stance → Capability → Response → Constitution → Memory
```

## License

MIT
