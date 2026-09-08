import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  /**
   * 与 Komari 一致：浏览器返回首页时恢复原滚动位置，
   * 正常前进导航则回到页面顶部。
   */
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/server/:id',
      name: 'server-detail',
      component: () => import('@/views/ServerDetailView.vue'),
    },
    {
      path: '/settings',
      name: 'theme-settings',
      component: () => import('@/views/ThemeSettingsView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})
