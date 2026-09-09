# CFSM-Glassmorphism

CFSM-Glassmorphism is a Vue 3, TypeScript and Vite port of Komari Glassmorphism for the public third-party-theme APIs of CF-Server-Monitor.

The project currently includes the engineering foundation, a visually restored home dashboard, a real `/#/server/:id` detail experience, a centralized `/#/settings` theme editor, three Earth/Map renderers, and authenticated advanced tools. The home page loads `/api/config` and `/api/servers`, while detail uses the owning source's `/api/server`, `/api/history/all` and single-node `/api/ws?subscribe=<id>` connection. Partial `batchUpdate` samples merge without erasing REST state; reconnects use bounded backoff and low-frequency REST fallback. Theme settings resolve defaults, backend `theme_options` and browser overrides in one strict store; authenticated saves use only `POST /api/theme_options`, send a complete snapshot, and re-fetch config without a reload. Earth placement uses only explicit country/region centers, while health, value, snapshot and classification-topology tools consume the same normalized real-data model.

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

The workflow uploads `CFSM-Glassmorphism-build-<short-sha>.zip`. Its root contains only `index.html` and `assets/`. `bun run validate:dist` also scans for forbidden Komari runtime markers and enforces release size budgets (JavaScript 3328 KiB, CSS 128 KiB, total assets 6656 KiB — sized for the upstream Earth renderers, their textures and the echarts chart family), failing the build when exceeded. Generated dist directories and ZIP files are not committed.

## Documentation

- docs/CODEX_SPEC.md: immutable full project specification supplied by the project owner.
- AGENTS.md: concise, durable implementation rules.
- docs/compatibility-matrix.md: audited feature feasibility.
- docs/api-mapping.md: public endpoint ownership and source references.
- docs/architecture.md: target layers and data flow.
- docs/theme-settings.md: all 48 upstream settings and their CFSM disposition.
- docs/visual-validation.md: current breakpoint, renderer and interaction verification.
- docs/fidelity-audit.md: item-by-item comparison against upstream Komari Glassmorphism, with P0/P1/P2 priorities.

## UI authority

Komari Glassmorphism is the single source of truth for the released UI and UX. The existing implementation here records which CFSM features already work; it is not the visual truth. Differences are aligned to Komari unless they are required CFSM platform differences, and every audited difference is tracked in docs/fidelity-audit.md. The three Earth renderers are the upstream implementations (globe.gl + three, cobe, and the real tiled earth map) rather than imitations; three and globe.gl load lazily and only for the realistic renderer. Icons use the same Tabler and IconPark names as upstream, with their paths inlined at build time so the theme never calls an icon CDN at runtime. Flags and OS icons come from the CFSM default skin (`/flags/<code>.svg`, `/os-icons/<filename>`) and are not bundled. History charts run on the same echarts and vue-echarts stack as upstream, with `connectNulls: false` so timeouts and missing samples stay gaps rather than zeros, and UI primitives (tooltip, tabs, badge, toasts) are built on reka-ui and vue-sonner.
