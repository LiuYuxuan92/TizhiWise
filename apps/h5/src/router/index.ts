import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/assessment/:channel',
    name: 'assessment',
    component: () => import('@/views/AssessmentView.vue'),
  },
  {
    path: '/report/:id',
    name: 'report',
    component: () => import('@/views/ReportView.vue'),
  },
  {
    path: '/mine',
    name: 'mine',
    component: () => import('@/views/MineView.vue'),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});
