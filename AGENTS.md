# CFSM Glassmorphism Agent Guide

## Scope and sources

- Read this file and `docs/CODEX_SPEC.md` before changing the project. The latter is the complete product specification and wins on scope or detail.
- Treat upstream repositories as read-only references. Do not modify files below `work/upstreams/` and do not develop through a GitHub web editor.
- Resolve conflicts in this order: current user task, `docs/CODEX_SPEC.md`, CFSM `theme-develop.md`, CFSM frontend behavior, LuminaPlus CFSM integration, then Komari Glassmorphism visual behavior.
- Preserve the current round boundary. Finish, test, and document the requested phase before starting a later one.

## Non-negotiable behavior

- Truthful data beats visual completeness. Never invent production metrics, history, IPs, ASN, provider, city, price, or location. `ip_v4` and `ip_v6` are reachability flags, not address strings.
- Use only public CFSM theme endpoints. The sole theme write endpoint is `POST /api/theme_options`; authenticated administration belongs at `/admin#admin`.
- Keep transport, parsing/adapters, stores, and UI separate. Components must not issue ad-hoc requests or reinterpret wire payloads.
- Model wire data as `unknown`, validate it at the adapter boundary, and keep TypeScript strict. Avoid `any`, unchecked casts, and hidden fallbacks.
- Preserve API-base ownership for every server. Multi-source data, WebSocket updates, detail requests, and history requests must return to the owning base.
- When WebSocket work is in scope, subscribe explicitly, merge partial updates, keep a five-minute online threshold, and close or reconnect on page visibility changes as specified.
- History periods are limited to CFSM-supported values. Surface 401, 409, and 503 truthfully; do not synthesize history.
- Theme settings have three layers: defaults, backend `theme_options`, and local overrides. Backend saves send a complete snapshot and local-only settings never masquerade as server state.
- Keep the Komari Glassmorphism visual language recognizable while adapting all runtime behavior to CFSM.
- Use the upstream icon names (Tabler / IconPark) through `AppIcon`, with paths inlined at build time in `src/constants/icons.ts`; never call an icon CDN at runtime. Flags and OS icons come from the CFSM default skin (`/flags/<code>.svg`, `/os-icons/<filename>`) and are never bundled into the theme.
- Charts run on the upstream `echarts` + `vue-echarts` stack (registered once in `src/utils/echarts.ts`), and UI primitives on `reka-ui` + `vue-sonner`. Do not replace an upstream renderer or primitive with a hand-written imitation to reduce dependencies or bundle size. Charts must keep `connectNulls: false` and must never turn a probe `false`/`null` into `0`.
- **Komari Glassmorphism is the single source of truth for the released UI and UX.** Its current default-branch code, components, styles, layout, animation, routing behavior and browser output define what this theme must look like and how it must behave. The existing CFSM-Glassmorphism implementation records which CFSM features already work; it is *not* the visual truth and is never a protected baseline. Where the two differ, align to Komari unless the difference is a required CFSM platform difference (REST/WebSocket/history/`theme_options`/multi-apiBase/JWT/Turnstile/dist rules/missing CFSM fields/hash routing/truthful degradation). "Better UX", "fits CFSM better" and "simpler code" are not valid reasons to diverge, and renderers Komari actually uses must not be swapped for imitations to reduce dependencies or bundle size. Record every audited difference in `docs/fidelity-audit.md` with a P0/P1/P2 priority.

## Delivery discipline

- Bun is the package manager. Do not mix npm, pnpm, or yarn lockfiles into the repository.
- Do not commit generated `dist/`, dependency directories, audit clones, or scratch output.
- Before handing off a code change, run `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`, and `bun run validate:dist`.
- A development round is complete only after lint, typecheck, test, build, and dist validation all pass and that round's work is committed and pushed to the target repository. Never enter the next round before the current round has been pushed successfully.
- CI must use a frozen Bun install and validate that the release archive contains only `index.html` plus `assets/` at its root.
- Release notes under `docs/releases/` must be written in Chinese for v1.0.0 and all subsequent versions.
- Update the compatibility matrix, API mapping, architecture notes, and settings audit whenever a relevant contract changes.
