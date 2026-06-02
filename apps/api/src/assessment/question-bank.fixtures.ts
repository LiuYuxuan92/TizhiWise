import {
  AssessmentChannel,
  ConstitutionType,
  QuestionType,
  type AlgorithmConfig,
  type Question,
} from '@tizhice/shared';

export interface QuestionBankConfig {
  version: string;
  constitutionQuestions: Question[];
  painQuestions: Question[];
}

export function defaultQuestionBank(algorithmConfig: AlgorithmConfig): QuestionBankConfig {
  return {
    version: 'v1',
    constitutionQuestions: algorithmConfig.questionMapping.map((mapping) => ({
      id: mapping.questionId,
      type: QuestionType.LIKERT_5,
      required: true,
      text: constitutionQuestionText(mapping.constitution),
      options: [
        { id: 'never', label: '没有', score: 1 },
        { id: 'rarely', label: '很少', score: 2 },
        { id: 'sometimes', label: '有时', score: 3 },
        { id: 'often', label: '经常', score: 4 },
        { id: 'always', label: '总是', score: 5 },
      ],
      meta: { constitutionTag: mapping.constitution },
    })),
    painQuestions: [
      {
        id: 'pain_area',
        type: QuestionType.BODY_PART,
        required: true,
        text: '请选择疼痛部位',
        meta: { painDimension: 'area' },
      },
      {
        id: 'pain_nature',
        type: QuestionType.MULTI,
        required: true,
        text: '请选择疼痛性质',
        options: [
          { id: 'sharp', label: '刺痛' },
          { id: 'dull', label: '钝痛' },
          { id: 'burning', label: '灼痛' },
        ],
        meta: { painDimension: 'nature' },
      },
      {
        id: 'pain_duration',
        type: QuestionType.SINGLE,
        required: true,
        text: '疼痛持续时间',
        options: [
          { id: 'under_24h', label: '24 小时内' },
          { id: '24_72h', label: '24-72 小时' },
          { id: 'over_72h', label: '超过 72 小时' },
        ],
        meta: { painDimension: 'duration' },
      },
      {
        id: 'pain_trigger',
        type: QuestionType.MULTI,
        required: true,
        text: '诱发或缓解因素',
        options: [
          { id: 'movement', label: '活动诱发' },
          { id: 'rest', label: '休息缓解' },
          { id: 'night', label: '夜间痛醒' },
        ],
        meta: { painDimension: 'trigger' },
      },
      {
        id: 'pain_severity',
        type: QuestionType.NUMERIC_0_10,
        required: true,
        text: '疼痛强度 0-10 分',
        meta: { painDimension: 'severity' },
      },
      {
        id: 'pain_neuro',
        type: QuestionType.MULTI,
        required: false,
        text: '是否伴随麻木或无力',
        options: [
          { id: 'numbness', label: '麻木' },
          { id: 'weakness', label: '无力' },
        ],
        meta: { painDimension: 'neurological' },
      },
    ],
  };
}

function constitutionQuestionText(type: ConstitutionType): string {
  if (type === ConstitutionType.PINGHE) {
    return '您是否精力充沛？';
  }
  return `您是否出现 ${type} 相关表现？`;
}

export const questionBankChannels = [
  AssessmentChannel.CONSTITUTION,
  AssessmentChannel.PAIN,
] as const;
