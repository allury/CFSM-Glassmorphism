# CFSM-Glassmorphism

CFSM-Glassmorphism is a Vue 3, TypeScript and Vite port of Komari Glassmorphism for the public third-party-theme APIs of CF-Server-Monitor.

The project currently includes the engineering foundation and a visually restored home dashboard backed by real CFSM REST and WebSocket data. It loads `/api/config` and `/api/servers`, opens one source-owned `/api/ws?subscribe=all` connection per API base, merges partial `batchUpdate` samples without erasing the REST snapshot, and uses bounded reconnect backoff plus a low-frequency REST fallback when realtime transport is unavailable. The responsive Glassmorphism experience includes card, compact, mini and list layouts; truthful overview metrics; grouping and multi-term search; sorting; source-owned favorites; offline-last ordering; light/dark/system themes; a dynamic CSS background; and a current-snapshot quick view. Detail charts, the complete theme settings UI, Earth/Map and advanced tools intentionally remain for later rounds.

## Authority and attribution

- CFSM theme permissions and protocol: CF-Server-Monitor theme-develop.md.
- Runtime behavior reference: the current CFSM src/frontend implementation.
- CFSM integration patterns: CFSM-Theme-LuminaPlus.
- Visual and interaction source: sanrokamlan-prog/komari-theme-Glassmorphism.

This project is based on Komari Glassmorphism and adapts it for CF-Server-Monitor. It does not claim the original visual design as its own. See LICENSE and docs/compatibility-matrix.md.

## Development

Use Bun from the repository root:

~~~bash
bun install
bun run dev
bun run lint
bun run typecheck
bun run test
bun run build
bun run validate:dist
~~~

Production code must use real CFSM data or a truthful empty/error state. Test fixtures may exist only under tests or an explicit development-only mock boundary.

## Formal build

Pushes to main, pull requests and manual workflow dispatch run:

~~~text
frozen install
-> lint
-> typecheck
-> unit tests
-> build
-> dist validation
-> ZIP packaging
-> artifact upload
~~~

The workflow uploads `CFSM-Glassmorphism-build-<short-sha>.zip`. Its root contains only `index.html` and `assets/`. Generated dist directories and ZIP files are not committed.

## Documentation

- docs/CODEX_SPEC.md: immutable full project specification supplied by the project owner.
- AGENTS.md: concise, durable implementation rules.
- docs/compatibility-matrix.md: audited feature feasibility.
- docs/api-mapping.md: public endpoint ownership and source references.
- docs/architecture.md: target layers and data flow.
- docs/theme-settings.md: all 48 upstream settings and their CFSM disposition.
- docs/visual-validation.md: Round 3 breakpoint, scale and interaction verification.
