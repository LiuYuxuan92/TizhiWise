import {
  AgentRole,
  KnowledgeCategory,
  Platform,
  type AgentWorkflowConfig,
  type KnowledgeEntry,
} from '@tizhice/shared';

export function defaultAgentWorkflow(version = 'v1'): AgentWorkflowConfig {
  return {
    version,
    publishedAt: new Date('2026-06-01T00:00:00.000Z'),
    agents: [
      agent(AgentRole.TOPIC_PICKER, 'mock-topic-v1', '围绕 {{topic}} 生成选题角度。'),
      agent(AgentRole.COPYWRITER, 'mock-copy-v1', '为 {{platform}} 撰写 {{topic}} 文案。'),
      agent(
        AgentRole.COMPLIANCE_REVIEWER,
        'mock-compliance-v1',
        '审核 {{platform}} 文案是否含医疗功效宣称。',
      ),
      agent(AgentRole.VISUAL_ADVISOR, 'mock-visual-v1', '为 {{platform}} 提供素材建议。'),
    ],
    orchestration: [
      { agent: AgentRole.TOPIC_PICKER, dependsOn: [] },
      { agent: AgentRole.COPYWRITER, dependsOn: [AgentRole.TOPIC_PICKER], parallel: true },
      { agent: AgentRole.COMPLIANCE_REVIEWER, dependsOn: [AgentRole.COPYWRITER], parallel: true },
      {
        agent: AgentRole.VISUAL_ADVISOR,
        dependsOn: [AgentRole.COMPLIANCE_REVIEWER],
        parallel: true,
      },
    ],
  };
}

export function defaultKnowledgeBase(): KnowledgeEntry[] {
  return [
    {
      id: 'brand-1',
      category: KnowledgeCategory.BRAND,
      content: '品牌主张：先进厨房，后进药房。',
      active: true,
    },
    {
      id: 'compliance-1',
      category: KnowledgeCategory.COMPLIANCE_RULES,
      content: '禁止治疗、治愈、根治、100%有效、最好、必须、一定能等表述。',
      active: true,
    },
  ];
}

export function platformLabel(platform: Platform): string {
  switch (platform) {
    case Platform.XIAOHONGSHU:
      return '小红书';
    case Platform.VIDEO_CHANNEL:
      return '视频号';
    case Platform.MOMENTS:
      return '朋友圈';
    default:
      platform satisfies never;
      return platform;
  }
}

function agent(role: AgentRole, model: string, promptTemplate: string) {
  return {
    role,
    model,
    promptTemplate,
    maxRetries: 2,
    timeoutMs: 1_000,
  };
}
