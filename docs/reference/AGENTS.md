# Repository Guidelines

## Project Structure & Module Organization

Core code lives in `backend/` (Express + SQLite API) and `frontend/` (React dashboard); reference material stays in `docs/`. Backend routes delegate to `backend/services/`, with guards in `backend/middleware/`, helpers in `backend/utils/`, and scheduled jobs in `backend/scripts/`. React components sit in `frontend/src/components/`, data hooks in `frontend/src/services/`, and shared helpers in `frontend/src/utils/`. Keep tests colocated inside `__tests__/` folders and treat `reports/` plus `PRPs/` as generated artefacts.

## Build, Test, and Development Commands

Run `npm install` once at the root to hydrate both workspaces. Start the API with `npm run dev --prefix backend` (Nodemon on port 3001) and the client with `npm start --prefix frontend` (React Scripts on port 3000). Use `npm run backtest` and `npm run compare` for strategy experiments, then finish pre-commit checks with `npm test`, `npm run lint`, and `npm run format:check`.

## Coding Style & Naming Conventions

JavaScript and JSX use 2-space indentation, semicolons, and single quotes. Follow `camelCase` for functions, `PascalCase` for React components, and uppercase snake case for environment keys such as `ALPHA_VANTAGE_API_KEY`. ESLint (`npm run lint`) enforces the rule set, including `no-unused-vars` and accessibility checks, while Prettier (`npm run format:check`) normalises whitespace and imports.

## Testing Guidelines

Backend logic is covered by Jest; name specs `*.test.js`, keep them beside the code, and verify coverage with `npm run test:coverage --prefix backend`. Frontend tests rely on React Testing Library; assert via `screen.getByRole` and run `npm run test:coverage --prefix frontend` when UI behaviour changes. Avoid live API calls in tests—prefer fixtures stored next to the suite.

## Commit & Pull Request Guidelines

Commits follow short, imperative subjects (e.g., “Add comprehensive deployment guide”) and should group a single logical change. PRs need a summary, linked issues or PRP references, a checklist of commands executed (`npm test`, key backtests), and screenshots whenever UI elements shift. Request review only after automated checks succeed.

## Environment & Security Notes

Copy `backend/.env.example` to `backend/.env`, add your Alpha Vantage key, and exclude `.env` files, keys, and the SQLite database from commits. When configuration changes, update `docs/ENVIRONMENT_CONFIGURATION.md` and reflect operational tweaks in `restart_server.sh` to keep runbooks current.
