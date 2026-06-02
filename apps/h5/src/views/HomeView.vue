<script setup lang="ts">
import { SHARED_PACKAGE_VERSION } from '@tizhice/shared';

const appTitle = import.meta.env.VITE_APP_TITLE ?? '知体';
</script>

<template>
  <div class="home">
    <h1 class="home__title">{{ appTitle }}</h1>
    <p class="home__slogan">先进厨房，后劲药房</p>
    <p class="home__disclaimer">本平台内容为健康参考，非医疗诊断。</p>
    <p class="home__meta">shared v{{ SHARED_PACKAGE_VERSION }}</p>
  </div>
</template>

<style scoped>
.home {
  padding: 48px 24px;
  text-align: center;
}

.home__title {
  font-size: 28px;
  margin-bottom: 8px;
}

.home__slogan {
  color: #323233;
  font-size: 16px;
}

.home__disclaimer {
  color: #969799;
  font-size: 12px;
  margin-top: 24px;
}

.home__meta {
  color: #c8c9cc;
  font-size: 11px;
}
</style>
