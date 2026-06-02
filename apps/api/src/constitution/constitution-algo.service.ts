import {
  BIASED_CONSTITUTION_TYPES,
  CONSTITUTION_TYPES,
  ConstitutionJudgment,
  ConstitutionType,
  type AlgorithmConfig,
  type AnswerScore,
  type ConstitutionResult,
  type ConstitutionScore,
} from '@tizhice/shared';

export interface JudgeServiceInput {
  answers: AnswerScore[];
  algorithmVersion: string;
  sessionId?: string;
}

export type PublishAlgorithmConfigInput = Omit<AlgorithmConfig, 'version' | 'publishedAt'> &
  Partial<Pick<AlgorithmConfig, 'version' | 'publishedAt'>>;

export interface AlgorithmConfigRepository {
  publish(config: AlgorithmConfig): Promise<void>;
  get(version: string): Promise<AlgorithmConfig | undefined>;
  getLatest(): Promise<AlgorithmConfig | undefined>;
  count(): Promise<number>;
}

export class ConstitutionAlgoService {
  constructor(private readonly repository: AlgorithmConfigRepository) {}

  async judge(input: JudgeServiceInput): Promise<ConstitutionResult> {
    const config = await this.getConfig(input.algorithmVersion);
    return judgeWithConfig(input.answers, config, input.sessionId ?? 'unknown-session');
  }

  async publishConfig(config: PublishAlgorithmConfigInput): Promise<{ version: string }> {
    const version = config.version || `v${(await this.repository.count()) + 1}`;
    const toPublish: AlgorithmConfig = {
      version,
      publishedAt: config.publishedAt ?? new Date(),
      thresholds: config.thresholds,
      questionMapping: config.questionMapping,
    };
    await this.repository.publish(toPublish);
    return { version };
  }

  async getConfig(version: string): Promise<AlgorithmConfig> {
    const config = await this.repository.get(version);
    if (!config) {
      throw new Error(`Algorithm config not found: ${version}`);
    }
    return cloneAlgorithmConfig(config);
  }
}

export function judgeWithConfig(
  answers: readonly AnswerScore[],
  config: AlgorithmConfig,
  sessionId: string,
): ConstitutionResult {
  validateConfig(config);
  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer.score]));
  const scores = CONSTITUTION_TYPES.map((type) =>
    calculateScore(type, config, answersByQuestionId),
  );
  const pingheScore = getScore(scores, ConstitutionType.PINGHE);
  const isPinghe =
    pingheScore.convertedScore >= config.thresholds.pinghe.selfMin &&
    BIASED_CONSTITUTION_TYPES.every(
      (type) => getScore(scores, type).convertedScore < config.thresholds.pinghe.biasedMaxExclusive,
    );

  const eligibleBiased = BIASED_CONSTITUTION_TYPES.map((type) => getScore(scores, type))
    .filter(
      (score) =>
        score.judgment === ConstitutionJudgment.YES ||
        score.judgment === ConstitutionJudgment.TENDENCY,
    )
    .sort(
      (left, right) =>
        right.convertedScore - left.convertedScore || typeOrder(left.type) - typeOrder(right.type),
    );

  const primary = isPinghe
    ? ConstitutionType.PINGHE
    : (eligibleBiased[0]?.type ??
      highestScore(scores.filter((score) => score.type !== ConstitutionType.PINGHE)).type);
  const concurrent = isPinghe
    ? []
    : eligibleBiased.filter((score) => score.type !== primary).map((score) => score.type);

  return {
    resultId: stableResultId(sessionId, config.version),
    sessionId,
    algorithmVersion: config.version,
    scores,
    primary,
    concurrent,
    isPinghe,
    computedAt: new Date(0),
  };
}

function calculateScore(
  type: ConstitutionType,
  config: AlgorithmConfig,
  answersByQuestionId: ReadonlyMap<string, number>,
): ConstitutionScore {
  const mappings = config.questionMapping.filter((mapping) => mapping.constitution === type);
  if (mappings.length === 0) {
    throw new Error(`Algorithm config ${config.version} has no mapping for ${type}`);
  }

  let weightedRaw = 0;
  let weightSum = 0;
  for (const mapping of mappings) {
    const score = answersByQuestionId.get(mapping.questionId);
    if (score === undefined) {
      throw new Error(`Missing answer for question ${mapping.questionId}`);
    }
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new Error(`Answer score for ${mapping.questionId} must be an integer in [1,5]`);
    }
    const normalizedScore = mapping.reverseScore ? 6 - score : score;
    weightedRaw += normalizedScore * mapping.weight;
    weightSum += mapping.weight;
  }

  const rawScore = roundScore(weightedRaw);
  const itemCount = roundScore(weightSum);
  const convertedScore = roundScore(((weightedRaw - weightSum) / (weightSum * 4)) * 100);

  return {
    type,
    rawScore,
    itemCount,
    convertedScore,
    judgment: judgeBiased(type, convertedScore, config),
  };
}

function judgeBiased(
  type: ConstitutionType,
  convertedScore: number,
  config: AlgorithmConfig,
): ConstitutionJudgment {
  if (type === ConstitutionType.PINGHE) {
    return convertedScore >= config.thresholds.pinghe.selfMin
      ? ConstitutionJudgment.YES
      : ConstitutionJudgment.NO;
  }
  if (convertedScore >= config.thresholds.biased.yes) {
    return ConstitutionJudgment.YES;
  }
  if (convertedScore >= config.thresholds.biased.tendency) {
    return ConstitutionJudgment.TENDENCY;
  }
  return ConstitutionJudgment.NO;
}

function validateConfig(config: AlgorithmConfig): void {
  if (config.thresholds.biased.yes <= config.thresholds.biased.tendency) {
    throw new Error('Algorithm config requires biased.yes > biased.tendency');
  }
  for (const mapping of config.questionMapping) {
    if (mapping.weight <= 0) {
      throw new Error(`Question mapping ${mapping.questionId} must have positive weight`);
    }
  }
}

function getScore(scores: readonly ConstitutionScore[], type: ConstitutionType): ConstitutionScore {
  const score = scores.find((candidate) => candidate.type === type);
  if (!score) {
    throw new Error(`Missing constitution score for ${type}`);
  }
  return score;
}

function highestScore(scores: readonly ConstitutionScore[]): ConstitutionScore {
  return [...scores].sort(
    (left, right) =>
      right.convertedScore - left.convertedScore || typeOrder(left.type) - typeOrder(right.type),
  )[0]!;
}

function typeOrder(type: ConstitutionType): number {
  return CONSTITUTION_TYPES.indexOf(type);
}

function roundScore(value: number): number {
  return Number(value.toFixed(10));
}

function stableResultId(sessionId: string, algorithmVersion: string): string {
  return `constitution:${sessionId}:${algorithmVersion}`;
}

function cloneAlgorithmConfig(config: AlgorithmConfig): AlgorithmConfig {
  return {
    ...config,
    publishedAt: new Date(config.publishedAt),
    thresholds: {
      pinghe: { ...config.thresholds.pinghe },
      biased: { ...config.thresholds.biased },
    },
    questionMapping: config.questionMapping.map((mapping) => ({ ...mapping })),
  };
}
