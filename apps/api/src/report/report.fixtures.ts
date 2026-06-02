import {
  AssessmentChannel,
  ConstitutionType,
  ReportSectionKey,
  ReportTier,
  ReportType,
  type AdvicePart,
  type ReportTemplate,
} from '@tizhice/shared';

export interface ReportTemplatePayload {
  version: string;
  templates: Record<ReportType, ReportTemplate>;
  fragments: Record<string, ReportFragment>;
  deepPreview: {
    titles: string[];
    summaries: string[];
  };
}

export interface ReportFragment {
  title: string;
  summary: string;
  content: string[];
}

const DISCLAIMER = '本报告仅用于健康参考与生活方式建议，不构成医疗诊断、治疗方案或用药建议。';

export function defaultReportTemplatePayload(version = 'v1'): ReportTemplatePayload {
  return {
    version,
    templates: {
      [ReportType.CONSTITUTION]: {
        version,
        type: ReportType.CONSTITUTION,
        sections: [
          section(ReportSectionKey.OVERVIEW, ReportTier.BASIC),
          section(ReportSectionKey.INTERPRETATION, ReportTier.BASIC),
          section(ReportSectionKey.KITCHEN, ReportTier.BASIC),
          section(ReportSectionKey.LIFESTYLE, ReportTier.BASIC),
          section(ReportSectionKey.WHEN_TO_SEE_DOCTOR, ReportTier.BASIC),
          section(ReportSectionKey.DISCLAIMER, ReportTier.BASIC),
          section(ReportSectionKey.KITCHEN, ReportTier.DEEP),
          section(ReportSectionKey.LIFESTYLE, ReportTier.DEEP),
        ],
      },
      [ReportType.PAIN]: {
        version,
        type: ReportType.PAIN,
        sections: [
          section(ReportSectionKey.OVERVIEW, ReportTier.BASIC),
          section(ReportSectionKey.INTERPRETATION, ReportTier.BASIC),
          section(ReportSectionKey.KITCHEN, ReportTier.BASIC),
          section(ReportSectionKey.LIFESTYLE, ReportTier.BASIC),
          section(ReportSectionKey.WHEN_TO_SEE_DOCTOR, ReportTier.BASIC),
          section(ReportSectionKey.DISCLAIMER, ReportTier.BASIC),
          section(ReportSectionKey.LIFESTYLE, ReportTier.DEEP),
        ],
      },
    },
    fragments: buildFragments(),
    deepPreview: {
      titles: ['深度饮食调理', '深度作息与运动建议'],
      summaries: ['结合主体质与兼夹体质细化食材选择。', '提供更完整的周期化生活方式方案。'],
    },
  };
}

export function channelToReportType(channel: AssessmentChannel): ReportType {
  return channel === AssessmentChannel.CONSTITUTION ? ReportType.CONSTITUTION : ReportType.PAIN;
}

export function disclaimerText(): string {
  return DISCLAIMER;
}

function section(key: ReportSectionKey, tier: ReportTier) {
  return {
    key,
    tier,
    fragmentSelectors: [],
  };
}

function buildFragments(): Record<string, ReportFragment> {
  const fragments: Record<string, ReportFragment> = {
    disclaimer: {
      title: '免责声明',
      summary: DISCLAIMER,
      content: [DISCLAIMER],
    },
    pain_overview: {
      title: '痛症概览',
      summary: '根据疼痛部位、持续时间和强度形成基础风险概览。',
      content: ['你的疼痛信息已完成结构化整理，可作为生活方式调整参考。'],
    },
    pain_interpretation: {
      title: '痛症解读',
      summary: '结合强度与风险信号做非诊断解读。',
      content: ['若疼痛持续、加重或伴随麻木无力，应优先线下就医排查。'],
    },
    pain_kitchen: {
      title: '痛症饮食',
      summary: '以清淡均衡和减少刺激为主。',
      content: ['保持足量饮水，减少酒精与高糖摄入，优先规律三餐。'],
    },
    pain_lifestyle: {
      title: '痛症生活方式',
      summary: '避免强行活动，保留观察记录。',
      content: ['避免在疼痛明显时强行拉伸或负重，记录疼痛强度变化。'],
    },
    pain_medical: {
      title: '痛症就医提示',
      summary: '红旗征或持续加重时及时就医。',
      content: ['若出现剧烈持续疼痛、夜间痛醒、麻木或无力，请及时就医。'],
    },
    pain_deep_lifestyle: {
      title: '痛症深度生活方式',
      summary: '分阶段恢复节奏建议。',
      content: ['疼痛缓解前以保护和观察为主，缓解后逐步恢复低强度活动。'],
    },
  };

  for (const type of Object.values(ConstitutionType)) {
    fragments[`${type}_overview`] = {
      title: `${type} 概览`,
      summary: `${type} 是本次体质报告的重要观察项。`,
      content: [`本次测评显示 ${type} 相关特征需要关注。`],
    };
    fragments[`${type}_interpretation`] = {
      title: `${type} 解读`,
      summary: `围绕 ${type} 的表现进行基础解读。`,
      content: [`${type} 相关表现可从饮食、作息和运动节奏三个方面观察。`],
    };
    fragments[`${type}_kitchen`] = {
      title: `${type} 饮食建议`,
      summary: `适配 ${type} 的基础饮食建议。`,
      content: [`${type} 人群建议优先保持规律饮食，少食生冷油腻。`],
    };
    fragments[`${type}_lifestyle`] = {
      title: `${type} 生活方式`,
      summary: `适配 ${type} 的基础生活方式建议。`,
      content: [`${type} 人群建议保持规律作息，避免长期透支。`],
    };
    fragments[`${type}_medical`] = {
      title: `${type} 就医提示`,
      summary: `必要时寻求专业帮助。`,
      content: ['若症状持续影响生活，请咨询专业医生或中医师。'],
    };
    fragments[`${type}_deep_kitchen`] = {
      title: `${type} 深度饮食`,
      summary: `围绕 ${type} 的深度食材与禁忌建议。`,
      content: [`深度饮食建议：根据 ${type} 特征逐步调整食材搭配。`],
    };
    fragments[`${type}_deep_lifestyle`] = {
      title: `${type} 深度生活方式`,
      summary: `围绕 ${type} 的深度作息和运动建议。`,
      content: [`深度生活方式建议：为 ${type} 制定阶段化作息与运动计划。`],
    };
  }

  return fragments;
}

export function adviceFrom(content: string[]): AdvicePart {
  return { generic: content };
}
