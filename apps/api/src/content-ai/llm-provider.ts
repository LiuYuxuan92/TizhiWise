import { AgentRole, Platform } from '@tizhice/shared';
import { platformLabel } from './content-ai.fixtures';

export interface LlmGenerateInput {
  role: AgentRole;
  model: string;
  prompt: string;
  topic: string;
  platform?: Platform;
  attempt: number;
}

export interface LlmGenerateOutput {
  text: string;
  modelVersion: string;
}

export interface LlmProvider {
  generate(input: LlmGenerateInput): Promise<LlmGenerateOutput>;
}

export class DeterministicLlmProvider implements LlmProvider {
  private readonly failurePlan = new Map<string, number>();

  failTimes(role: AgentRole, platform: Platform | 'GLOBAL', times: number): void {
    this.failurePlan.set(key(role, platform), times);
  }

  async generate(input: LlmGenerateInput): Promise<LlmGenerateOutput> {
    const failureKey = key(input.role, input.platform ?? 'GLOBAL');
    const remainingFailures = this.failurePlan.get(failureKey) ?? 0;
    if (remainingFailures > 0) {
      this.failurePlan.set(failureKey, remainingFailures - 1);
      throw new LlmProviderError('model_error', `${input.role} planned failure`);
    }

    return {
      text: deterministicText(input),
      modelVersion: `${input.model}@deterministic`,
    };
  }
}

export class LlmProviderError extends Error {
  constructor(
    readonly code: 'timeout' | 'rate_limit' | 'model_error',
    message: string,
  ) {
    super(message);
  }
}

function deterministicText(input: LlmGenerateInput): string {
  switch (input.role) {
    case AgentRole.TOPIC_PICKER:
      return `选题角度：${input.topic} 与日常调理`;
    case AgentRole.COPYWRITER:
      return `${platformLabel(input.platform ?? Platform.MOMENTS)}文案：${input.topic}，先进厨房后进药房。内容为健康科普，非医疗诊断。`;
    case AgentRole.COMPLIANCE_REVIEWER:
      return hasComplianceRisk(input.prompt) ? 'RISK:医疗功效或绝对化用语' : 'PASS';
    case AgentRole.VISUAL_ADVISOR:
      return `${platformLabel(input.platform ?? Platform.MOMENTS)}素材建议：温暖厨房、草本食材、轻运动场景`;
    default:
      input.role satisfies never;
      return '';
  }
}

export function hasComplianceRisk(text: string): boolean {
  return ['治疗', '治愈', '根治', '100% 有效', '100%有效', '最好', '必须', '一定能'].some((word) =>
    text.includes(word),
  );
}

function key(role: AgentRole, platform: Platform | 'GLOBAL'): string {
  return `${role}:${platform}`;
}
