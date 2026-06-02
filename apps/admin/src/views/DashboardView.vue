<script setup lang="ts">
import { SHARED_PACKAGE_VERSION } from '@tizhice/shared';

const appTitle = import.meta.env.VITE_APP_TITLE ?? '知体管理后台';
</script>

<template>
  <div class="dashboard">
    <h1>{{ appTitle }} · 管理后台</h1>
    <p>题库 / 算法配置 / 报告模板 / 内容工作流 管理入口（脚手架占位）。</p>
    <p class="dashboard__meta">shared v{{ SHARED_PACKAGE_VERSION }}</p>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 32px;
}

.dashboard__meta {
  color: #999;
  font-size: 12px;
}
</style>
