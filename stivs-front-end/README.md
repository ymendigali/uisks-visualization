# React + TypeScript + Vite

## Requirements

- Node.js 24.x
- npm 11+

## Backend Integration (STIVS API)

Frontend now uses REST endpoints from your backend (`/api/auth`, `/api/projects`, `/api/employees`, `/api/publications`, `/api/finances`).

Use environment-based config files in the project root:

- `.env.development` — for local run (`npm run dev`)
- `.env.production` — for production build (`npm run build`)

Required variables:

- `VITE_API_BASE_URL` — backend base URL
- `VITE_APP_ENV` — project mode: `local` or `prod`

Example:

```env
VITE_APP_ENV=local
VITE_API_BASE_URL=http://localhost:3000
```

If this variable is not set, the app defaults to `http://localhost:3000`.

## UISKS Assistant Chat

The `/assistant` route hosts a chat UI that dispatches prompts to your server-side LLM worker and listens for webhook callbacks that contain the generation status and a link to the produced file. Configure the integration via the following environment variables (e.g. in `.env.local`):

| Variable | Description |
| --- | --- |
| `VITE_LLM_CHAT_ENDPOINT` | HTTPS endpoint that accepts `POST { prompt, locale, callbackUrl }` to enqueue generation. |
| `VITE_LLM_STATUS_ENDPOINT` | Optional polling endpoint used as a fallback when callbacks are unavailable. Must return `{ requestId, status, fileUrl? }`. |
| `VITE_LLM_CALLBACK_STREAM_BASE` | Optional base URL for SSE channels. When provided, the UI subscribes to `${base}/stream/{requestId}`. |
| `VITE_LLM_CALLBACK_PROXY` | Explicit callback URL that your backend will hit. Defaults to `window.location.origin/api/llm/callback` if omitted. |

Once configured, every prompt shows in the chat timeline, pending requests appear in the status column, and completed callbacks automatically inject download links for the generated brief.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
