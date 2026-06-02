<script setup lang="ts">
import { computed } from 'vue';
import { showToast } from 'vant';
import { AssessmentChannel, useJourneyStore } from '@/stores/journey';

const store = useJourneyStore();
const paidCount = computed(() => store.reports.filter((report) => report.unlocked).length);

function login() {
  store.loginWithWechatMock();
  showToast('已模拟微信授权，匿名测评记录已归并到当前用户');
}
</script>

<template>
  <main class="shell mine-shell">
    <header class="mine-hero card">
      <router-link class="pill" to="/">← 首页</router-link>
      <h1>我的中心</h1>
      <p>微信授权登录、匿名记录归并、历史报告和订单状态在这里聚合展示。</p>
      <button v-if="!store.userId" class="primary-button" @click="login">模拟微信授权登录</button>
      <div v-else class="user-chip">{{ store.userName }} · {{ store.userId }}</div>
    </header>

    <section class="stats">
      <div class="card stat">
        <b>{{ store.sessions.length }}</b
        ><span>测评记录</span>
      </div>
      <div class="card stat">
        <b>{{ store.reports.length }}</b
        ><span>报告</span>
      </div>
      <div class="card stat">
        <b>{{ paidCount }}</b
        ><span>已解锁</span>
      </div>
    </section>

    <section class="card reports">
      <h2>历史报告</h2>
      <article v-for="report in store.myReports" :key="report.id" class="report-row">
        <div>
          <b>{{ report.channel === AssessmentChannel.CONSTITUTION ? '体质报告' : '痛症报告' }}</b>
          <small>{{ new Date(report.createdAt).toLocaleString() }}</small>
          <small>{{ report.unlocked ? '深度报告已解锁' : '基础报告 · 深度待解锁' }}</small>
        </div>
        <router-link class="ghost-button" :to="`/report/${report.id}`">查看</router-link>
      </article>
      <p v-if="store.myReports.length === 0" class="empty">暂无报告，先完成一次测评。</p>
    </section>

    <section class="card events">
      <h2>关键行为埋点</h2>
      <ol>
        <li v-for="event in store.events.slice(-8).reverse()" :key="event.id">
          <span>{{ event.type }}</span>
          <small>{{ new Date(event.occurredAt).toLocaleTimeString() }}</small>
        </li>
      </ol>
    </section>
  </main>
</template>

<style scoped>
.mine-shell {
  display: grid;
  gap: 16px;
}

.mine-hero,
.reports,
.events {
  padding: 22px;
}

.mine-hero h1,
.reports h2,
.events h2 {
  margin: 14px 0 10px;
  font-size: 30px;
  letter-spacing: -0.05em;
}

.mine-hero p,
.empty {
  color: var(--muted);
  line-height: 1.75;
}

.user-chip {
  border-radius: 18px;
  padding: 12px 14px;
  color: #fffaf1;
  background: var(--green);
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.stat {
  display: grid;
  gap: 4px;
  padding: 16px 10px;
  text-align: center;
}

.stat b {
  color: var(--green);
  font-size: 28px;
}

.stat span,
.report-row small,
.events small {
  color: var(--muted);
  font-size: 12px;
}

.report-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  border-top: 1px solid var(--line);
  padding: 14px 0;
}

.report-row div {
  display: grid;
  gap: 4px;
}

.report-row a {
  min-height: 38px;
  text-decoration: none;
}

.events ol {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.events li {
  display: flex;
  justify-content: space-between;
  border-radius: 16px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.48);
}
</style>
