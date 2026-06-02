<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { AssessmentChannel, useJourneyStore } from '@/stores/journey';

const router = useRouter();
const store = useJourneyStore();
const active = computed(() => store.activeSession);

function start(channel: AssessmentChannel) {
  const session = store.startSession(channel);
  router.push(`/assessment/${session.channel.toLowerCase()}`);
}

function resume() {
  if (!active.value) return;
  router.push(`/assessment/${active.value.channel.toLowerCase()}`);
}
</script>

<template>
  <main class="shell home-shell">
    <section class="hero card">
      <div class="hero__mark">知体智评</div>
      <p class="pill">TCM constitution · pain triage · food-first guidance</p>
      <h1>先把身体讲清楚，<br />再谈怎么调。</h1>
      <p class="hero__copy">
        体质与痛症双通道测评，围绕“先进厨房，后进药房”生成健康参考建议。
        全程标注非医疗诊断，不替代医生诊疗。
      </p>
      <button v-if="active" class="danger-button hero__resume" @click="resume">
        继续上次{{ active.channel === AssessmentChannel.CONSTITUTION ? '体质' : '痛症' }}测评
      </button>
    </section>

    <section class="entry-grid" aria-label="测评入口">
      <button class="entry-card entry-card--green" @click="start(AssessmentChannel.CONSTITUTION)">
        <span>01</span>
        <strong>体质测评</strong>
        <em>五级量表 · 基础信息 · 可返回修改</em>
      </button>
      <button class="entry-card entry-card--gold" @click="start(AssessmentChannel.PAIN)">
        <span>02</span>
        <strong>痛症测评</strong>
        <em>部位 / 性质 / 强度 · 红旗征提示</em>
      </button>
    </section>

    <section class="proof card">
      <div>
        <b>3 秒首屏目标</b>
        <small>路由级代码分割 + Suspense 骨架屏</small>
      </div>
      <div>
        <b>微信 H5 优先</b>
        <small>分享、授权、支付均预留接入点</small>
      </div>
      <div>
        <b>非移动端兼容</b>
        <small>桌面端保持完整功能与居中宽度</small>
      </div>
    </section>

    <nav class="bottom-nav" aria-label="底部导航">
      <div class="bottom-nav__inner">
        <router-link to="/">首页</router-link>
        <router-link to="/mine">我的</router-link>
        <router-link :to="active ? `/assessment/${active.channel.toLowerCase()}` : '/mine'"
          >继续</router-link
        >
      </div>
    </nav>
  </main>
</template>

<style scoped>
.home-shell {
  display: grid;
  gap: 18px;
}

.hero {
  position: relative;
  overflow: hidden;
  padding: 30px 24px;
}

.hero::after {
  content: '';
  position: absolute;
  right: -48px;
  bottom: -52px;
  width: 190px;
  height: 190px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(116, 147, 111, 0.38), transparent 66%);
}

.hero__mark {
  margin-bottom: 14px;
  color: var(--gold);
  font-size: 13px;
  letter-spacing: 0.42em;
}

.hero h1 {
  margin: 24px 0 14px;
  font-size: clamp(34px, 11vw, 56px);
  line-height: 0.98;
  letter-spacing: -0.08em;
}

.hero__copy {
  position: relative;
  z-index: 1;
  max-width: 32em;
  color: var(--muted);
  line-height: 1.85;
}

.hero__resume {
  position: relative;
  z-index: 1;
  margin-top: 12px;
  width: 100%;
}

.entry-grid {
  display: grid;
  gap: 14px;
}

.entry-card {
  min-height: 138px;
  border-radius: 28px;
  padding: 22px;
  text-align: left;
  color: #fffaf1;
  box-shadow: var(--shadow);
}

.entry-card span {
  display: block;
  opacity: 0.62;
  font-size: 12px;
  letter-spacing: 0.2em;
}

.entry-card strong {
  display: block;
  margin: 18px 0 8px;
  font-size: 28px;
  letter-spacing: -0.04em;
}

.entry-card em {
  display: block;
  font-style: normal;
  opacity: 0.78;
}

.entry-card--green {
  background:
    linear-gradient(135deg, rgba(36, 77, 53, 0.98), rgba(85, 113, 59, 0.92)),
    radial-gradient(circle at 88% 18%, rgba(255, 255, 255, 0.24), transparent 30%);
}

.entry-card--gold {
  background:
    linear-gradient(135deg, rgba(165, 102, 42, 0.98), rgba(199, 143, 57, 0.92)),
    radial-gradient(circle at 90% 16%, rgba(255, 255, 255, 0.22), transparent 30%);
}

.proof {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.proof div {
  display: grid;
  gap: 4px;
  border-left: 3px solid rgba(49, 95, 67, 0.28);
  padding-left: 12px;
}

.proof small {
  color: var(--muted);
}

@media (min-width: 760px) {
  .entry-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
