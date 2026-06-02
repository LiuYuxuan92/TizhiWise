<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AdminPermission } from '@tizhice/shared';
import { useAdminStore } from '@/stores/admin';

const store = useAdminStore();
const route = useRoute();
const router = useRouter();
const menu = computed(() => [
  { id: 'dashboard', label: '运营看板', permission: null },
  { id: 'question-bank', label: '题库', permission: AdminPermission.QUESTION_BANK_WRITE },
  { id: 'algorithm', label: '算法', permission: AdminPermission.ALGORITHM_WRITE },
  { id: 'report-template', label: '报告模板', permission: AdminPermission.REPORT_TEMPLATE_WRITE },
  { id: 'agent-workflow', label: 'AI 工作流', permission: AdminPermission.AGENT_WORKFLOW_WRITE },
  { id: 'content', label: '内容发布', permission: AdminPermission.CONTENT_APPROVE },
  { id: 'audit-refund', label: '审计/退款', permission: AdminPermission.AUDIT_READ },
]);

function visible(permission: AdminPermission | null) {
  return !permission || store.can(permission);
}

function logout() {
  store.logout();
  router.push('/login');
}
</script>

<template>
  <router-view v-if="route.name === 'login'" />
  <div v-else class="admin-shell">
    <aside class="sidebar">
      <div class="brand">
        <span>知体</span>
        <b>TizhiWise Admin</b>
      </div>
      <nav>
        <a
          v-for="item in menu.filter((entry) => visible(entry.permission))"
          :key="item.id"
          :href="`#${item.id}`"
        >
          {{ item.label }}
        </a>
      </nav>
      <button v-if="store.isLoggedIn" class="logout" @click="logout">
        退出 {{ store.username }}
      </button>
      <router-link v-else class="logout" to="/login">登录</router-link>
    </aside>
    <router-view />
  </div>
</template>

<style>
:root {
  font-family:
    'DIN Alternate', 'Avenir Next Condensed', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #e8f2ff;
  background: #07131f;
  --bg: #07131f;
  --panel: rgba(13, 32, 48, 0.86);
  --panel-2: rgba(19, 45, 66, 0.78);
  --line: rgba(145, 207, 255, 0.16);
  --cyan: #62d8ff;
  --blue: #2f7dff;
  --gold: #ffc766;
  --red: #ff6b6b;
  --green: #6dffa8;
}

* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: radial-gradient(circle at 78% 0%, rgba(47, 125, 255, 0.22), transparent 34%), #07131f;
}
button,
input,
select,
textarea {
  font: inherit;
}
button {
  cursor: pointer;
  border: 0;
}

.admin-shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  border-right: 1px solid var(--line);
  padding: 24px;
  background: rgba(4, 14, 24, 0.92);
}

.brand {
  display: grid;
  gap: 8px;
  margin-bottom: 32px;
}
.brand span {
  color: var(--cyan);
  letter-spacing: 0.5em;
  font-size: 12px;
}
.brand b {
  font-size: 24px;
  line-height: 1;
}

.sidebar nav {
  display: grid;
  gap: 10px;
}
.sidebar a,
.logout {
  display: block;
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 12px 14px;
  color: #d8edff;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.03);
}

.logout {
  width: 100%;
  margin-top: 28px;
  text-align: left;
}

.panel {
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--panel);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.26);
}

.primary,
.ghost,
.danger {
  min-height: 38px;
  border-radius: 14px;
  padding: 0 14px;
  color: #06111c;
  background: var(--cyan);
}
.ghost {
  color: #dff4ff;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.05);
}
.danger {
  color: #fff;
  background: linear-gradient(135deg, #c94f4f, #ff8f5a);
}

@media (max-width: 900px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: static;
    height: auto;
  }
  .sidebar nav {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
