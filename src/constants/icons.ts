/**
 * 内联图标数据。
 *
 * 图标名称与 Komari Glassmorphism 完全一致（Tabler / IconPark），
 * 路径数据取自 Iconify 官方图标集并在构建期内联，
 * 因此运行时不依赖 api.iconify.design。这是自托管 CFSM 主题必须的交付方式差异：
 * 内网或严格 CSP 环境下不能依赖外部图标 CDN。
 *
 * 本文件由一次性生成器产出，请勿手工编辑单个路径。
 */
export interface InlineIcon {
  readonly viewBox: string
  readonly body: string
}

export const ICONS = {
  'icon-park-outline:memory': {
    viewBox: '0 0 48 48',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\"><path d=\"M8 6v36a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2V13.61a2 2 0 0 0-.605-1.433l-7.813-7.61A2 2 0 0 0 30.187 4H10a2 2 0 0 0-2 2Z\"/><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M40 21H8m32 8H30m10 7H30m0 8V21M18 44V21m0 12H8\"/></g>",
  },
  'icon-park-outline:switch': {
    viewBox: '0 0 48 48',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"4\" d=\"M42 19H6M30 7l12 12M6.799 29h36m-36 0l12 12\"/>",
  },
  'tabler:activity': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 12h4l3 8l4-16l3 8h4\"/>",
  },
  'tabler:activity-heartbeat': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 12h4.5L9 6l4 12l2-9l1.5 3H21\"/>",
  },
  'tabler:alert-triangle': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 9v4m-1.637-9.409L2.257 17.125a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0M12 16h.01\"/>",
  },
  'tabler:arrow-big-down-lines': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M15 12h3.586a1 1 0 0 1 .707 1.707l-6.586 6.586a1 1 0 0 1-1.414 0l-6.586-6.586A1 1 0 0 1 5.414 12H9V9h6zm0-9H9m6 3H9\"/>",
  },
  'tabler:arrow-big-up-lines': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M9 12H5.414a1 1 0 0 1-.707-1.707l6.586-6.586a1 1 0 0 1 1.414 0l6.586 6.586A1 1 0 0 1 18.586 12H15v3H9zm0 9h6m-6-3h6\"/>",
  },
  'tabler:arrow-left': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M5 12h14M5 12l6 6m-6-6l6-6\"/>",
  },
  'tabler:arrows-transfer-up-down': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M7 21v-6m13-9l-3-3l-3 3m-4 12l-3 3l-3-3M7 3v2m0 4v2m10-8v6m0 12v-2m0-4v-2\"/>",
  },
  'tabler:box-multiple': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M7 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z\"/><path d=\"M17 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2\"/></g>",
  },
  'tabler:calendar-exclamation': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M15 21H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5m-4-9v4M8 3v4m-4 4h16m-9 4h1m0 0v3m7-2v3m0 3v.01\"/>",
  },
  'tabler:cash': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M7 15H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3\"/><path d=\"M7 10a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z\"/><path d=\"M12 14a2 2 0 1 0 4 0a2 2 0 0 0-4 0\"/></g>",
  },
  'tabler:chart-histogram': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M3 3v18h18m-1-3v3m-4-5v5m-4-8v8m-4-5v5\"/><path d=\"M3 11c6 0 5-5 9-5s3 5 9 5\"/></g>",
  },
  'tabler:chart-line': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M4 19h16M4 15l4-6l4 2l4-5l4 4\"/>",
  },
  'tabler:chevron-down': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m6 9l6 6l6-6\"/>",
  },
  'tabler:chevron-right': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m9 6l6 6l-6 6\"/>",
  },
  'tabler:chevron-up': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m6 15l6-6l6 6\"/>",
  },
  'tabler:clock': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0\"/><path d=\"M12 7v5l3 3\"/></g>",
  },
  'tabler:cpu': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M5 6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z\"/><path d=\"M9 9h6v6H9zm-6 1h2m-2 4h2m5-11v2m4-2v2m7 5h-2m2 4h-2m-5 7v-2m-4 2v-2\"/></g>",
  },
  'tabler:cpu-2': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M5 6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z\"/><path d=\"M8 10V8h2m6 6v2h-2m-4 0H8v-2m8-4V8h-2M3 10h2m-2 4h2m5-11v2m4-2v2m7 5h-2m2 4h-2m-5 7v-2m-4 2v-2\"/></g>",
  },
  'tabler:device-analytics': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm4 15h10m-8-4v4m6-4v4\"/><path d=\"m8 12l3-3l2 2l3-3\"/></g>",
  },
  'tabler:device-desktop': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm4 15h10m-8-4v4m6-4v4\"/>",
  },
  'tabler:download': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5l5-5m-5-7v12\"/>",
  },
  'tabler:external-link': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6m-7 1l9-9m-5 0h5v5\"/>",
  },
  'tabler:gauge': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0\"/><path d=\"M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0m2.41-1.41L16 8m-9 4a5 5 0 0 1 5-5\"/></g>",
  },
  'tabler:hourglass': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M6.5 7h11m-11 10h11M6 20v-2a6 6 0 1 1 12 0v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1\"/><path d=\"M6 4v2a6 6 0 1 0 12 0V4a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1\"/></g>",
  },
  'tabler:list-numbers': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M11 6h9m-9 6h9m-8 6h8M4 16a2 2 0 1 1 4 0c0 .591-.5 1-1 1.5L4 20h4M6 10V4L4 6\"/>",
  },
  'tabler:map-pin': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0\"/><path d=\"M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0\"/></g>",
  },
  'tabler:moon': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 3h.393a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 2.992z\"/>",
  },
  'tabler:plug-connected': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m7 12l5 5l-1.5 1.5a3.536 3.536 0 1 1-5-5zm10 0l-5-5l1.5-1.5a3.536 3.536 0 1 1 5 5zM3 21l2.5-2.5m13-13L21 3m-11 8l-2 2m5 1l-2 2\"/>",
  },
  'tabler:plug-connected-x': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m20 16l-4 4m-9-8l5 5l-1.5 1.5a3.536 3.536 0 1 1-5-5zm10 0l-5-5l1.5-1.5a3.536 3.536 0 1 1 5 5zM3 21l2.5-2.5m13-13L21 3m-11 8l-2 2m5 1l-2 2m5 0l4 4\"/>",
  },
  'tabler:receipt-2': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2l-2 2l-2-2l-2 2l-2-2z\"/><path d=\"M14 8h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3H10m2 0v1.5m0-9V8\"/></g>",
  },
  'tabler:refresh': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4\"/>",
  },
  'tabler:search': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0m18 11l-6-6\"/>",
  },
  'tabler:server-2': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm0 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm4-7v.01M7 16v.01M11 8h6m-6 8h6\"/>",
  },
  'tabler:settings': {
    viewBox: '0 0 24 24',
    body: "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37c1 .608 2.296.07 2.572-1.065\"/><path d=\"M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0\"/></g>",
  },
  'tabler:star': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m12 17.75l-6.172 3.245l1.179-6.873l-5-4.867l6.9-1l3.086-6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z\"/>",
  },
  'tabler:star-filled': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"currentColor\" d=\"m8.243 7.34l-6.38.925l-.113.023a1 1 0 0 0-.44 1.684l4.622 4.499l-1.09 6.355l-.013.11a1 1 0 0 0 1.464.944l5.706-3l5.693 3l.1.046a1 1 0 0 0 1.352-1.1l-1.091-6.355l4.624-4.5l.078-.085a1 1 0 0 0-.633-1.62l-6.38-.926l-2.852-5.78a1 1 0 0 0-1.794 0z\"/>",
  },
  'tabler:sun': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0m-5 0h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7l-.7.7m0 11.4l.7.7m-12.1-.7l-.7.7\"/>",
  },
  'tabler:upload': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5-5l5 5m-5-5v12\"/>",
  },
  'tabler:x': {
    viewBox: '0 0 24 24',
    body: "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M18 6L6 18M6 6l12 12\"/>",
  },
} as const

export type IconName = keyof typeof ICONS
