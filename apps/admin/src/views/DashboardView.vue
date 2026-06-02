<script setup lang="ts">
import { computed, reactive } from 'vue';
import { AdminPermission, ContentStatus, QuestionType } from '@tizhice/shared';
import { useAdminStore, type AdminQuestionDraft } from '@/stores/admin';

const store = useAdminStore();
const stats = computed(() => store.dashboard);
const questionForm = reactive<AdminQuestionDraft>({
  id: 'cq-new',
  channel: 'CONSTITUTION',
  text: '你是否容易口干？',
  type: QuestionType.LIKERT_5,
  required: true,
  mapping: 'YINXU',
});
const algorithmDraft = reactive({ yes: 40, tendency: 30, pinghe: 60, weight: 1 });
const reportTemplate = reactive({
  disclaimer: '本报告仅用于健康参考，非医疗诊断。',
  constitution: '按体质维护片段',
  pain: '按痛症维护片段',
});
const workflow = reactive({ model: 'mock-copy-v1', maxRetries: 2, timeoutMs: 1000 });
const orderId = computed(() => 'order-demo-1');

function can(permission: AdminPermission) {
  return store.can(permission);
}
</script>

<template>
  <main class="dashboard-page">
    <section id="dashboard" class="hero panel">
      <div>
        <p class="eyebrow">Operations cockpit</p>
        <h1>配置、内容和增长漏斗在一个屏幕里闭环。</h1>
      </div>
      <div class="hero__metrics">
        <div>
          <b>{{ stats.completedAssessments }}</b
          ><span>测评完成</span>
        </div>
        <div>
          <b>{{ stats.paidConversion }}</b
          ><span>付费转化</span>
        </div>
        <div>
          <b>{{ stats.topConstitution }}</b
          ><span>体质分布 Top</span>
        </div>
        <div>
          <b>{{ stats.topSource }}</b
          ><span>渠道来源 Top</span>
        </div>
      </div>
    </section>

    <section id="question-bank" class="panel module">
      <header>
        <div>
          <p class="eyebrow">R11.1</p>
          <h2>题库管理</h2>
        </div>
        <button
          class="primary"
          :disabled="!can(AdminPermission.QUESTION_BANK_WRITE)"
          @click="store.publishVersion('QUESTION_BANK', `${store.questions.length} 道题`)"
        >
          发布题库版本
        </button>
      </header>
      <div class="editor-grid">
        <label>题目 ID<input v-model="questionForm.id" /></label>
        <label
          >通道<select v-model="questionForm.channel">
            <option>CONSTITUTION</option>
            <option>PAIN</option>
          </select></label
        >
        <label>题型<input v-model="questionForm.type" /></label>
        <label>映射<input v-model="questionForm.mapping" /></label>
        <label class="wide">题干<input v-model="questionForm.text" /></label>
      </div>
      <button
        class="ghost"
        :disabled="!can(AdminPermission.QUESTION_BANK_WRITE)"
        @click="store.upsertQuestion({ ...questionForm })"
      >
        保存题目
      </button>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>通道</th>
            <th>题干</th>
            <th>映射</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="question in store.questions" :key="question.id">
            <td>{{ question.id }}</td>
            <td>{{ question.channel }}</td>
            <td>{{ question.text }}</td>
            <td>{{ question.mapping }}</td>
            <td>
              <button
                class="danger"
                :disabled="!can(AdminPermission.QUESTION_BANK_WRITE)"
                @click="store.deleteQuestion(question.id)"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section id="algorithm" class="panel module">
      <header>
        <div>
          <p class="eyebrow">R11.2</p>
          <h2>算法配置</h2>
        </div>
        <button
          class="primary"
          :disabled="!can(AdminPermission.ALGORITHM_WRITE)"
          @click="
            store.publishVersion(
              'ALGORITHM',
              `YES ${algorithmDraft.yes} / TENDENCY ${algorithmDraft.tendency}`,
            )
          "
        >
          发布算法
        </button>
      </header>
      <div class="config-strip">
        <label>偏颇 YES 阈值<input v-model.number="algorithmDraft.yes" type="number" /></label>
        <label>偏颇倾向阈值<input v-model.number="algorithmDraft.tendency" type="number" /></label>
        <label>平和阈值<input v-model.number="algorithmDraft.pinghe" type="number" /></label>
        <label
          >默认权重<input v-model.number="algorithmDraft.weight" type="number" step="0.1"
        /></label>
      </div>
    </section>

    <section id="report-template" class="panel module">
      <header>
        <div>
          <p class="eyebrow">R11.4</p>
          <h2>报告模板与片段</h2>
        </div>
        <button
          class="primary"
          :disabled="!can(AdminPermission.REPORT_TEMPLATE_WRITE)"
          @click="store.publishVersion('REPORT_TEMPLATE', reportTemplate.disclaimer)"
        >
          发布模板
        </button>
      </header>
      <div class="editor-grid">
        <label class="wide"
          >免责声明<textarea v-model="reportTemplate.disclaimer"></textarea>
        </label>
        <label>体质片段<textarea v-model="reportTemplate.constitution"></textarea></label>
        <label>痛症片段<textarea v-model="reportTemplate.pain"></textarea></label>
      </div>
      <p class="hint">免责声明字段不可移除；发布按钮会保留审计记录。</p>
    </section>

    <section id="agent-workflow" class="panel module">
      <header>
        <div>
          <p class="eyebrow">R11.5 / R7.10</p>
          <h2>AI Agent 工作流</h2>
        </div>
        <button
          class="primary"
          :disabled="!can(AdminPermission.AGENT_WORKFLOW_WRITE)"
          @click="
            store.publishVersion(
              'AGENT_WORKFLOW',
              `${workflow.model} retries=${workflow.maxRetries}`,
            )
          "
        >
          发布工作流
        </button>
      </header>
      <div class="dag">
        <span>选题</span><i>→</i><span>撰写</span><i>→</i><span>合规审核</span><i>→</i
        ><span>素材建议</span>
      </div>
      <div class="config-strip">
        <label>模型<input v-model="workflow.model" /></label>
        <label>重试<input v-model.number="workflow.maxRetries" type="number" /></label>
        <label>超时(ms)<input v-model.number="workflow.timeoutMs" type="number" /></label>
      </div>
    </section>

    <section id="content" class="panel module">
      <header>
        <div>
          <p class="eyebrow">R8</p>
          <h2>内容草稿管理与发布</h2>
        </div>
      </header>
      <div class="draft-grid">
        <article v-for="draft in store.contentDrafts" :key="draft.id" class="draft-card">
          <span>{{ draft.platform }}</span>
          <h3>{{ draft.title }}</h3>
          <p>
            {{ draft.tags.join(' / ') }} · {{ draft.status }} <b v-if="draft.risk">风险需确认</b>
          </p>
          <div>
            <button
              class="ghost"
              :disabled="
                !can(AdminPermission.CONTENT_APPROVE) || draft.status === ContentStatus.PUBLISHED
              "
              @click="store.approveDraft(draft.id)"
            >
              审批通过
            </button>
            <button
              class="primary"
              :disabled="
                !can(AdminPermission.CONTENT_PUBLISH) || draft.status !== ContentStatus.APPROVED
              "
              @click="store.publishDraft(draft.id)"
            >
              发布/导出
            </button>
          </div>
        </article>
      </div>
    </section>

    <section id="analytics" class="panel module">
      <header>
        <div>
          <p class="eyebrow">R10</p>
          <h2>运营看板与聚合导出</h2>
        </div>
        <button class="ghost" @click="store.exportAggregate()">导出聚合数据</button>
      </header>
      <div class="chart-row">
        <span style="height: 42%"></span><span style="height: 68%"></span
        ><span style="height: 88%"></span><span style="height: 54%"></span
        ><span style="height: 76%"></span>
      </div>
      <p class="hint">小样本分组默认抑制，避免从运营报表反推个人。</p>
    </section>

    <section id="audit-refund" class="panel module">
      <header>
        <div>
          <p class="eyebrow">R6.10 / R11.6</p>
          <h2>审计日志与退款</h2>
        </div>
        <button
          class="danger"
          :disabled="!can(AdminPermission.ORDER_REFUND)"
          @click="store.refund(orderId)"
        >
          退款并回收权限
        </button>
      </header>
      <p class="hint">{{ orderId }}：{{ store.refundStatus[orderId] ?? 'PAID' }}</p>
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>操作人</th>
            <th>动作</th>
            <th>资源</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="audit in store.audits.slice(0, 12)" :key="audit.id">
            <td>{{ new Date(audit.occurredAt).toLocaleString() }}</td>
            <td>{{ audit.operator }}</td>
            <td>{{ audit.action }}</td>
            <td>{{ audit.resource }}</td>
            <td>{{ audit.ip }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>

<style scoped>
.dashboard-page {
  display: grid;
  gap: 18px;
  padding: 26px;
}
.hero,
.module {
  padding: 24px;
}
.hero {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 24px;
  align-items: end;
  min-height: 320px;
  background: linear-gradient(135deg, rgba(13, 32, 48, 0.92), rgba(21, 55, 82, 0.82));
}
.eyebrow {
  margin: 0 0 10px;
  color: var(--cyan);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-size: 12px;
}
h1 {
  margin: 0;
  max-width: 680px;
  font-size: clamp(42px, 6vw, 82px);
  line-height: 0.92;
  letter-spacing: -0.07em;
}
h2 {
  margin: 0;
  font-size: 28px;
  letter-spacing: -0.04em;
}
.hero__metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.hero__metrics div,
.draft-card {
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
}
.hero__metrics b {
  display: block;
  color: var(--gold);
  font-size: 28px;
}
.hero__metrics span,
.hint,
td,
th {
  color: rgba(232, 242, 255, 0.7);
}
.module {
  display: grid;
  gap: 18px;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}
.editor-grid,
.config-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.editor-grid .wide {
  grid-column: 1 / -1;
}
label {
  display: grid;
  gap: 8px;
  color: rgba(232, 242, 255, 0.78);
}
input,
select,
textarea {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 11px 12px;
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}
textarea {
  min-height: 88px;
  resize: vertical;
}
table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 18px;
}
th,
td {
  border-top: 1px solid var(--line);
  padding: 12px;
  text-align: left;
}
.dag {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.dag span {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 10px 14px;
  background: rgba(98, 216, 255, 0.08);
}
.dag i {
  color: var(--cyan);
  font-style: normal;
}
.draft-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.draft-card h3 {
  margin: 10px 0;
  font-size: 22px;
}
.draft-card span {
  color: var(--cyan);
}
.draft-card p {
  color: rgba(232, 242, 255, 0.7);
}
.draft-card b {
  color: var(--red);
}
.draft-card div {
  display: flex;
  gap: 8px;
}
.chart-row {
  display: flex;
  align-items: end;
  gap: 14px;
  height: 180px;
  border: 1px solid var(--line);
  border-radius: 22px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.04);
}
.chart-row span {
  flex: 1;
  border-radius: 12px 12px 0 0;
  background: linear-gradient(to top, var(--blue), var(--cyan));
}
button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
@media (max-width: 1100px) {
  .hero,
  .draft-grid {
    grid-template-columns: 1fr;
  }
  .editor-grid,
  .config-strip {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 680px) {
  .dashboard-page {
    padding: 16px;
  }
  .editor-grid,
  .config-strip,
  .hero__metrics {
    grid-template-columns: 1fr;
  }
  header {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
