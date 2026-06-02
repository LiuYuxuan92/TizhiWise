import type { AlgorithmConfig } from '@tizhice/shared';
import type { AlgorithmConfigRepository } from './constitution-algo.service';

export class InMemoryAlgorithmConfigRepository implements AlgorithmConfigRepository {
  private readonly configs = new Map<string, AlgorithmConfig>();
  private latestVersion: string | undefined;

  constructor(initialConfigs: readonly AlgorithmConfig[] = []) {
    for (const config of initialConfigs) {
      this.configs.set(config.version, cloneConfig(config));
      this.latestVersion = config.version;
    }
  }

  async publish(config: AlgorithmConfig): Promise<void> {
    if (this.configs.has(config.version)) {
      throw new Error(`Algorithm config ${config.version} already exists and is immutable`);
    }
    this.configs.set(config.version, cloneConfig(config));
    this.latestVersion = config.version;
  }

  async get(version: string): Promise<AlgorithmConfig | undefined> {
    const config = this.configs.get(version);
    return config ? cloneConfig(config) : undefined;
  }

  async getLatest(): Promise<AlgorithmConfig | undefined> {
    return this.latestVersion ? this.get(this.latestVersion) : undefined;
  }

  async count(): Promise<number> {
    return this.configs.size;
  }
}

function cloneConfig(config: AlgorithmConfig): AlgorithmConfig {
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
