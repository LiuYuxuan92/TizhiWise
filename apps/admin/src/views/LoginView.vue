<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAdminStore } from '@/stores/admin';

const store = useAdminStore();
const router = useRouter();
const username = ref('admin');
const password = ref('secret');
const error = ref('');

function submit() {
  try {
    store.login(username.value, password.value);
    router.push('/dashboard');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '登录失败';
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-card panel">
      <p class="eyebrow">TizhiWise Admin</p>
      <h1>默认拒绝，显式授权。</h1>
      <p>输入 admin/secret 获得全权限；输入 viewer/secret 仅可查看审计，用于验证菜单权限控制。</p>
      <label>
        账号
        <input v-model="username" autocomplete="username" />
      </label>
      <label>
        密码
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>
      <button class="primary" @click="submit">进入后台</button>
      <small v-if="error">{{ error }}</small>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
}

.login-card {
  display: grid;
  gap: 16px;
  width: min(100%, 460px);
  padding: 34px;
}

.eyebrow {
  color: var(--cyan);
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 42px;
  line-height: 0.96;
  letter-spacing: -0.06em;
}

p {
  color: rgba(232, 242, 255, 0.72);
  line-height: 1.7;
}
label {
  display: grid;
  gap: 8px;
  color: rgba(232, 242, 255, 0.78);
}
input {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 13px 14px;
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}
small {
  color: var(--red);
}
</style>
