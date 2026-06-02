import { defineStore } from 'pinia';
import {
  AssessmentChannel,
  ConstitutionType,
  EventType,
  ReportTier,
  type AssessmentChannel as AssessmentChannelType,
  type ConstitutionType as ConstitutionTypeType,
  type EventType as EventTypeType,
} from '@tizhice/shared';

export interface H5Question {
  id: string;
  text: string;
  kind: 'likert' | 'single' | 'multi' | 'body' | 'scale' | 'text';
  required: boolean;
  options?: string[];
}

export interface H5Session {
  id: string;
  channel: AssessmentChannelType;
  profile: {
    gender?: 'M' | 'F' | 'OTHER';
    ageBand?: string;
  };
  answers: Record<string, number | string | string[]>;
  currentIndex: number;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  redFlag?: string;
  createdAt: string;
  submittedAt?: string;
  reportId?: string;
}

export interface H5Report {
  id: string;
  sessionId: string;
  channel: AssessmentChannelType;
  primary?: ConstitutionTypeType;
  painScore?: number;
  basicSections: Array<{ title: string; body: string }>;
  deepSections: Array<{ title: string; body: string }>;
  unlocked: boolean;
  imageJobId?: string;
  shareToken?: string;
  createdAt: string;
}

export interface TrackingEvent {
  id: string;
  type: EventTypeType;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

interface H5State {
  anonymousId: string;
  userId: string | null;
  userName: string | null;
  sessions: H5Session[];
  reports: H5Report[];
  events: TrackingEvent[];
}

const STORAGE_KEY = 'tizhiwise-h5-demo-state-v1';

const constitutionQuestions: H5Question[] = [
  {
    id: 'cq-profile-energy',
    text: '你是否容易疲乏、气短，活动后更明显？',
    kind: 'likert',
    required: true,
  },
  { id: 'cq-cold', text: '你是否比别人更怕冷，手脚偏凉？', kind: 'likert', required: true },
  { id: 'cq-sleep', text: '你最近一周的睡眠恢复感如何？', kind: 'likert', required: true },
  {
    id: 'cq-digestion',
    text: '你是否容易腹胀、口黏或大便黏滞？',
    kind: 'likert',
    required: true,
  },
  { id: 'cq-mood', text: '你是否容易胸闷、叹气或情绪郁结？', kind: 'likert', required: true },
];

const painQuestions: H5Question[] = [
  {
    id: 'pq-body',
    text: '请选择主要疼痛部位',
    kind: 'body',
    required: true,
    options: ['颈肩', '腰背', '膝踝', '头面', '手臂'],
  },
  {
    id: 'pq-nature',
    text: '疼痛性质更接近哪一种？',
    kind: 'single',
    required: true,
    options: ['酸胀', '刺痛', '隐痛', '灼热', '麻木'],
  },
  {
    id: 'pq-duration',
    text: '这次疼痛持续多久了？',
    kind: 'single',
    required: true,
    options: ['少于24小时', '1-3天', '超过3天', '超过2周'],
  },
  {
    id: 'pq-trigger',
    text: '诱发或缓解因素',
    kind: 'multi',
    required: false,
    options: ['久坐', '受凉', '运动后', '热敷缓解', '休息缓解'],
  },
  { id: 'pq-intensity', text: '请给当前疼痛强度打分（0-10）', kind: 'scale', required: true },
  {
    id: 'pq-red',
    text: '是否伴随夜间痛醒、麻木无力或进行性加重？',
    kind: 'multi',
    required: false,
    options: ['夜间痛醒', '麻木无力', '进行性加重', '没有'],
  },
];

export const useJourneyStore = defineStore('journey', {
  state: (): H5State => loadState(),
  getters: {
    activeSession(state): H5Session | undefined {
      return [...state.sessions].reverse().find((session) => session.status === 'IN_PROGRESS');
    },
    myReports(state): H5Report[] {
      return [...state.reports].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
    },
  },
  actions: {
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state));
    },
    track(type: EventTypeType, metadata?: Record<string, unknown>) {
      this.events.push({
        id: `evt-${Date.now()}-${this.events.length + 1}`,
        type,
        occurredAt: new Date().toISOString(),
        metadata,
      });
      this.persist();
    },
    questionsFor(channel: AssessmentChannelType): H5Question[] {
      return channel === AssessmentChannel.CONSTITUTION ? constitutionQuestions : painQuestions;
    },
    startSession(channel: AssessmentChannelType): H5Session {
      const existing = [...this.sessions]
        .reverse()
        .find((session) => session.status === 'IN_PROGRESS' && session.channel === channel);
      if (existing) return existing;
      const session: H5Session = {
        id: `sess-${Date.now()}`,
        channel,
        profile: {},
        answers: {},
        currentIndex: 0,
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
      };
      this.sessions.push(session);
      this.track(EventType.ENTER_ASSESSMENT, { channel });
      this.persist();
      return session;
    },
    getSession(sessionId: string): H5Session | undefined {
      return this.sessions.find((session) => session.id === sessionId);
    },
    saveProfile(sessionId: string, profile: H5Session['profile']) {
      const session = this.requireSession(sessionId);
      session.profile = { ...session.profile, ...profile };
      this.persist();
    },
    answer(sessionId: string, questionId: string, value: number | string | string[]) {
      const session = this.requireSession(sessionId);
      session.answers[questionId] = Array.isArray(value) ? [...value] : value;
      const nextMissing = this.questionsFor(session.channel).findIndex(
        (question) => question.required && session.answers[question.id] === undefined,
      );
      session.currentIndex =
        nextMissing >= 0
          ? nextMissing
          : Math.min(
              Object.keys(session.answers).length,
              this.questionsFor(session.channel).length - 1,
            );
      session.redFlag = detectRedFlag(session);
      this.persist();
    },
    jumpTo(sessionId: string, index: number) {
      const session = this.requireSession(sessionId);
      session.currentIndex = Math.max(
        0,
        Math.min(index, this.questionsFor(session.channel).length - 1),
      );
      this.persist();
    },
    finalize(sessionId: string): H5Report {
      const session = this.requireSession(sessionId);
      const missing = this.questionsFor(session.channel).find(
        (question) => question.required && session.answers[question.id] === undefined,
      );
      if (missing) throw new Error(`请先完成必答题：${missing.text}`);
      session.status = 'SUBMITTED';
      session.submittedAt = new Date().toISOString();
      session.redFlag = detectRedFlag(session);
      const report = buildReport(session);
      session.reportId = report.id;
      this.reports.push(report);
      this.track(EventType.COMPLETE_ASSESSMENT, { channel: session.channel, reportId: report.id });
      this.persist();
      return report;
    },
    unlockReport(reportId: string) {
      const report = this.requireReport(reportId);
      report.unlocked = true;
      this.track(EventType.INITIATE_PAYMENT, { reportId });
      this.track(EventType.PAYMENT_SUCCESS, { reportId, mock: true });
      this.persist();
    },
    shareReport(reportId: string) {
      const report = this.requireReport(reportId);
      report.shareToken = report.shareToken ?? `share-${report.id}-${Date.now()}`;
      this.track(EventType.SHARE, { reportId, shareToken: report.shareToken });
      this.persist();
      return report.shareToken;
    },
    exportReportImage(reportId: string) {
      const report = this.requireReport(reportId);
      report.imageJobId = report.imageJobId ?? `img-${report.id}-${Date.now()}`;
      this.track(EventType.VIEW_REPORT, { reportId, exportImage: true });
      this.persist();
      return report.imageJobId;
    },
    loginWithWechatMock() {
      this.userId = 'wx-user-demo';
      this.userName = '微信用户';
      this.track(EventType.VIEW_REPORT, {
        action: 'wechat_login_merge',
        anonymousId: this.anonymousId,
      });
      this.persist();
    },
    requireSession(sessionId: string): H5Session {
      const session = this.getSession(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);
      return session;
    },
    requireReport(reportId: string): H5Report {
      const report = this.reports.find((candidate) => candidate.id === reportId);
      if (!report) throw new Error(`Report not found: ${reportId}`);
      return report;
    },
  },
});

function loadState(): H5State {
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw) as H5State;
  return {
    anonymousId: `anon-${Math.random().toString(36).slice(2, 10)}`,
    userId: null,
    userName: null,
    sessions: [],
    reports: [],
    events: [],
  };
}

function detectRedFlag(session: H5Session): string | undefined {
  if (session.channel !== AssessmentChannel.PAIN) return undefined;
  const intensity = Number(session.answers['pq-intensity'] ?? 0);
  const red = new Set(asStringArray(session.answers['pq-red']));
  const duration = String(session.answers['pq-duration'] ?? '');
  if (
    intensity >= 8 ||
    red.has('夜间痛醒') ||
    red.has('麻木无力') ||
    red.has('进行性加重') ||
    duration === '超过2周'
  ) {
    return '已命中红旗征：本提示为非医疗诊断，请优先线下就医或咨询专业医生，避免自行强行训练。';
  }
  return undefined;
}

function buildReport(session: H5Session): H5Report {
  if (session.channel === AssessmentChannel.CONSTITUTION) {
    const primary = inferConstitution(session);
    return {
      id: `report-${Date.now()}`,
      sessionId: session.id,
      channel: session.channel,
      primary,
      unlocked: false,
      createdAt: new Date().toISOString(),
      basicSections: [
        {
          title: `${labelConstitution(primary)} 概览`,
          body: '你的作答显示该体质特征更突出，建议先从饮食、作息和轻运动做稳定调整。',
        },
        { title: '先进厨房', body: '早餐规律、少生冷油腻，观察一周内精神、睡眠和消化变化。' },
        {
          title: '非医疗诊断声明',
          body: '本报告仅用于健康参考与生活方式建议，不构成医疗诊断、治疗方案或用药建议。',
        },
      ],
      deepSections: [
        {
          title: '深度饮食方案',
          body: '按 7 天为周期记录食材、饥饿感和精神恢复，逐步筛选更适合你的主食、蛋白和蔬菜组合。',
        },
        {
          title: '节律与复测建议',
          body: '建议 14-30 天后复测，比较体质倾向变化；若症状持续影响生活，应咨询专业人士。',
        },
      ],
    };
  }
  const score = Number(session.answers['pq-intensity'] ?? 0);
  return {
    id: `report-${Date.now()}`,
    sessionId: session.id,
    channel: session.channel,
    painScore: score,
    unlocked: false,
    createdAt: new Date().toISOString(),
    basicSections: [
      {
        title: '痛症风险概览',
        body: session.redFlag ?? `当前疼痛强度 ${score}/10，可先记录诱因、缓解因素和持续时间。`,
      },
      { title: '生活方式提示', body: '疼痛明显时避免强行拉伸或负重，优先休息、观察和必要时就医。' },
      {
        title: '非医疗诊断声明',
        body: '本报告仅用于健康参考与生活方式建议，不构成医疗诊断、治疗方案或用药建议。',
      },
    ],
    deepSections: [
      {
        title: '疼痛记录模板',
        body: '每天记录部位、强度、持续时间、活动量、睡眠和缓解方式，便于复盘趋势。',
      },
      {
        title: '分阶段恢复建议',
        body: '红旗征排除前不做高强度训练；缓解后从低强度活动逐步恢复。',
      },
    ],
  };
}

function inferConstitution(session: H5Session): ConstitutionTypeType {
  const energy = Number(session.answers['cq-profile-energy'] ?? 1);
  const cold = Number(session.answers['cq-cold'] ?? 1);
  const digestion = Number(session.answers['cq-digestion'] ?? 1);
  const mood = Number(session.answers['cq-mood'] ?? 1);
  if (cold >= 4) return ConstitutionType.YANGXU;
  if (digestion >= 4) return ConstitutionType.TANSHI;
  if (mood >= 4) return ConstitutionType.QIYU;
  if (energy >= 4) return ConstitutionType.QIXU;
  return ConstitutionType.PINGHE;
}

function labelConstitution(type: ConstitutionTypeType): string {
  const labels: Record<ConstitutionTypeType, string> = {
    PINGHE: '平和质',
    QIXU: '气虚质',
    YANGXU: '阳虚质',
    YINXU: '阴虚质',
    TANSHI: '痰湿质',
    SHIRE: '湿热质',
    XUEYU: '血瘀质',
    QIYU: '气郁质',
    TEBING: '特禀质',
  };
  return labels[type];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export { AssessmentChannel, ReportTier };
