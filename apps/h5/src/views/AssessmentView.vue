<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { AssessmentChannel, useJourneyStore, type H5Question } from '@/stores/journey';

const route = useRoute();
const router = useRouter();
const store = useJourneyStore();
const channel = computed(() =>
  String(route.params.channel).toLowerCase() === 'pain'
    ? AssessmentChannel.PAIN
    : AssessmentChannel.CONSTITUTION,
);
const session = computed(() => store.startSession(channel.value));
const questions = computed(() => store.questionsFor(session.value.channel));
const currentIndex = computed(() => session.value.currentIndex);
const current = computed(() => questions.value[currentIndex.value]);
const progress = computed(() => {
  const answered = questions.value.filter(
    (question) => session.value.answers[question.id] !== undefined,
  ).length;
  return Math.round((answered / questions.value.length) * 100);
});
const localValue = ref<number | string | string[]>(1);
const profileReady = computed(() =>
  session.value.channel === AssessmentChannel.PAIN
    ? true
    : Boolean(session.value.profile.gender && session.value.profile.ageBand),
);

watchEffect(() => {
  const value = current.value ? session.value.answers[current.value.id] : undefined;
  localValue.value = value ?? defaultValue(current.value);
});

function saveProfile(key: 'gender' | 'ageBand', value: string) {
  store.saveProfile(session.value.id, { [key]: value });
}

function answerAndNext() {
  if (!current.value) return;
  store.answer(session.value.id, current.value.id, localValue.value);
  const nextMissing = questions.value.findIndex(
    (question) => session.value.answers[question.id] === undefined,
  );
  store.jumpTo(
    session.value.id,
    nextMissing >= 0 ? nextMissing : Math.min(currentIndex.value + 1, questions.value.length - 1),
  );
}

function chooseOption(question: H5Question, option: string) {
  if (question.kind === 'multi' || question.kind === 'body') {
    const set = new Set(Array.isArray(localValue.value) ? localValue.value.map(String) : []);
    if (set.has(option)) set.delete(option);
    else set.add(option);
    localValue.value = [...set];
  } else {
    localValue.value = option;
  }
}

function finalize() {
  try {
    const report = store.finalize(session.value.id);
    router.push(`/report/${report.id}`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : '请先完成必答题');
  }
}

function defaultValue(question?: H5Question) {
  if (!question) return '';
  if (question.kind === 'multi' || question.kind === 'body') return [];
  if (question.kind === 'scale') return 3;
  if (question.kind === 'likert') return 3;
  return question.options?.[0] ?? '';
}

function selected(option: string): boolean {
  return Array.isArray(localValue.value)
    ? localValue.value.map(String).includes(option)
    : localValue.value === option;
}
</script>

<template>
  <main class="shell assessment-shell">
    <header class="assessment-head card">
      <router-link class="pill" to="/">← 返回首页</router-link>
      <h1>{{ session.channel === AssessmentChannel.CONSTITUTION ? '体质测评' : '痛症测评' }}</h1>
      <p>
        {{
          session.channel === AssessmentChannel.CONSTITUTION
            ? '先采集基础信息，再用五级量表逐题作答。'
            : '结构化记录疼痛部位、性质、持续时间和强度。'
        }}
      </p>
      <div class="progress" aria-label="测评进度">
        <span :style="{ width: `${progress}%` }"></span>
      </div>
      <small>{{ progress }}% 已完成 · 可点击下方题号返回修改</small>
    </header>

    <section
      v-if="session.channel === AssessmentChannel.CONSTITUTION && !profileReady"
      class="profile card"
    >
      <h2>基础信息</h2>
      <p>仅用于体质建议分层展示，服务端应加密存储。</p>
      <div class="choice-row">
        <button
          :class="{ active: session.profile.gender === 'M' }"
          @click="saveProfile('gender', 'M')"
        >
          男
        </button>
        <button
          :class="{ active: session.profile.gender === 'F' }"
          @click="saveProfile('gender', 'F')"
        >
          女
        </button>
        <button
          :class="{ active: session.profile.gender === 'OTHER' }"
          @click="saveProfile('gender', 'OTHER')"
        >
          其他
        </button>
      </div>
      <div class="choice-row choice-row--wrap">
        <button
          v-for="age in ['18-25', '26-35', '36-45', '46-60', '60+']"
          :key="age"
          :class="{ active: session.profile.ageBand === age }"
          @click="saveProfile('ageBand', age)"
        >
          {{ age }}
        </button>
      </div>
    </section>

    <section v-else-if="current" class="question card">
      <div class="question__index">第 {{ currentIndex + 1 }} / {{ questions.length }} 题</div>
      <h2>{{ current.text }} <span v-if="current.required">*</span></h2>

      <div v-if="current.kind === 'likert'" class="scale-options">
        <button
          v-for="score in [1, 2, 3, 4, 5]"
          :key="score"
          :class="{ active: localValue === score }"
          @click="localValue = score"
        >
          {{ score }}
          <small>{{ ['没有', '很少', '有时', '经常', '总是'][score - 1] }}</small>
        </button>
      </div>

      <div v-else-if="current.kind === 'scale'" class="range-box">
        <input v-model.number="localValue" type="range" min="0" max="10" />
        <b>{{ localValue }}/10</b>
      </div>

      <div v-else class="choice-row choice-row--wrap">
        <button
          v-for="option in current.options"
          :key="option"
          :class="{ active: selected(option) }"
          @click="chooseOption(current, option)"
        >
          {{ option }}
        </button>
      </div>

      <p v-if="session.redFlag" class="redflag">{{ session.redFlag }}</p>

      <div class="actions">
        <button
          class="ghost-button"
          :disabled="currentIndex === 0"
          @click="store.jumpTo(session.id, currentIndex - 1)"
        >
          上一题
        </button>
        <button class="primary-button" @click="answerAndNext">保存并继续</button>
      </div>
    </section>

    <section class="question-map card">
      <button
        v-for="(question, index) in questions"
        :key="question.id"
        :class="{
          answered: session.answers[question.id] !== undefined,
          active: index === currentIndex,
        }"
        @click="store.jumpTo(session.id, index)"
      >
        {{ index + 1 }}
      </button>
    </section>

    <button class="danger-button submit" @click="finalize">提交并生成基础报告</button>
  </main>
</template>

<style scoped>
.assessment-shell {
  display: grid;
  gap: 16px;
}

.assessment-head,
.profile,
.question,
.question-map {
  padding: 20px;
}

.assessment-head h1,
.profile h2,
.question h2 {
  margin: 14px 0 8px;
  font-size: 30px;
  letter-spacing: -0.05em;
}

.assessment-head p,
.profile p {
  color: var(--muted);
  line-height: 1.7;
}

.progress {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(49, 95, 67, 0.12);
}

.progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--green), var(--gold));
  transition: width 0.25s ease;
}

.choice-row,
.scale-options,
.actions {
  display: flex;
  gap: 10px;
}

.choice-row--wrap,
.scale-options {
  flex-wrap: wrap;
}

.choice-row button,
.scale-options button,
.question-map button {
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 12px 14px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.58);
}

.choice-row button.active,
.scale-options button.active,
.question-map button.active {
  color: #fffaf1;
  background: var(--green);
}

.scale-options button {
  flex: 1 1 72px;
  display: grid;
  gap: 4px;
  min-height: 74px;
}

.scale-options small {
  color: inherit;
  opacity: 0.72;
}

.question__index {
  color: var(--gold);
  letter-spacing: 0.15em;
  font-size: 12px;
}

.question h2 span {
  color: var(--red);
}

.range-box {
  display: grid;
  gap: 14px;
  text-align: center;
}

.range-box input {
  width: 100%;
  accent-color: var(--green);
}

.range-box b {
  font-size: 34px;
  color: var(--green);
}

.redflag {
  border-radius: 20px;
  padding: 14px;
  color: #fffaf1;
  background: linear-gradient(135deg, var(--red), #c66f36);
  line-height: 1.65;
}

.actions {
  margin-top: 18px;
}

.actions button {
  flex: 1;
}

.question-map {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.question-map button.answered {
  border-color: rgba(49, 95, 67, 0.38);
  box-shadow: inset 0 -3px 0 rgba(49, 95, 67, 0.18);
}

.submit {
  width: 100%;
}
</style>
