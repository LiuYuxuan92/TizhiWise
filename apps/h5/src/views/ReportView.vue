<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { showToast } from 'vant';
import { AssessmentChannel, useJourneyStore } from '@/stores/journey';

const route = useRoute();
const store = useJourneyStore();
const report = computed(() => store.reports.find((item) => item.id === String(route.params.id)));

function unlock() {
  if (!report.value) return;
  store.unlockReport(report.value.id);
  showToast('模拟微信支付成功，深度报告已解锁');
}

function share() {
  if (!report.value) return;
  const token = store.shareReport(report.value.id);
  showToast(`分享链接已生成：${token}`);
}

function exportImage() {
  if (!report.value) return;
  const job = store.exportReportImage(report.value.id);
  showToast(`报告图片导出任务：${job}`);
}
</script>

<template>
  <main class="shell report-shell">
    <template v-if="report">
      <header class="report-hero card">
        <router-link class="pill" to="/">← 首页</router-link>
        <p class="report-hero__type">
          {{ report.channel === AssessmentChannel.CONSTITUTION ? '体质报告' : '痛症报告' }}
        </p>
        <h1>
          {{
            report.channel === AssessmentChannel.CONSTITUTION
              ? '你的体质画像已生成'
              : '你的痛症记录已整理'
          }}
        </h1>
        <p>基础报告完整展示；深度内容由服务端权限控制，本页用本地状态模拟付费解锁刷新。</p>
      </header>

      <section class="section-list">
        <article
          v-for="section in report.basicSections"
          :key="section.title"
          class="card report-card"
        >
          <span>Basic</span>
          <h2>{{ section.title }}</h2>
          <p>{{ section.body }}</p>
        </article>
      </section>

      <section class="deep card">
        <div class="deep__head">
          <div>
            <span class="pill">Deep report</span>
            <h2>深度报告</h2>
          </div>
          <button v-if="!report.unlocked" class="primary-button" @click="unlock">支付解锁</button>
        </div>

        <article
          v-for="section in report.deepSections"
          :key="section.title"
          :class="['deep-item', { locked: !report.unlocked }]"
        >
          <h3>{{ section.title }}</h3>
          <p>
            {{
              report.unlocked ? section.body : '深度内容预览：解锁后查看完整饮食、节律和复测建议。'
            }}
          </p>
        </article>
      </section>

      <section class="toolbox card">
        <button class="ghost-button" @click="share">微信分享</button>
        <button class="ghost-button" @click="exportImage">保存报告图片</button>
        <router-link class="primary-button" to="/mine">查看我的中心</router-link>
      </section>
    </template>

    <section v-else class="card empty">
      <h1>报告不存在</h1>
      <p>请先完成一次测评。</p>
      <router-link class="primary-button" to="/">返回首页</router-link>
    </section>
  </main>
</template>

<style scoped>
.report-shell {
  display: grid;
  gap: 16px;
}

.report-hero,
.report-card,
.deep,
.toolbox,
.empty {
  padding: 22px;
}

.report-hero__type,
.report-card span {
  color: var(--gold);
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.report-hero h1,
.deep h2,
.empty h1 {
  margin: 14px 0 10px;
  font-size: 32px;
  line-height: 1.08;
  letter-spacing: -0.06em;
}

.report-hero p,
.report-card p,
.deep-item p,
.empty p {
  color: var(--muted);
  line-height: 1.75;
}

.section-list {
  display: grid;
  gap: 14px;
}

.report-card h2 {
  margin: 8px 0;
  font-size: 22px;
}

.deep__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.deep-item {
  margin-top: 14px;
  border-radius: 22px;
  border: 1px solid var(--line);
  padding: 16px;
  background: rgba(255, 255, 255, 0.48);
}

.deep-item.locked {
  position: relative;
  overflow: hidden;
}

.deep-item.locked::after {
  content: '付费后可见';
  position: absolute;
  inset: auto 14px 14px auto;
  border-radius: 999px;
  padding: 6px 10px;
  color: #fffaf1;
  background: var(--green);
  font-size: 12px;
}

.toolbox {
  display: grid;
  gap: 10px;
}

.toolbox a {
  text-decoration: none;
}
</style>
