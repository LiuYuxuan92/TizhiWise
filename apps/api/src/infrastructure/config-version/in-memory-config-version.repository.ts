import type { ConfigKind, ConfigVersion } from '@tizhice/shared';
import { deepClone, type ConfigVersionRepository } from './config-version.service';

export class InMemoryConfigVersionRepository implements ConfigVersionRepository {
  private readonly records: ConfigVersion[] = [];

  async publish(record: ConfigVersion): Promise<void> {
    this.records.push(deepClone(record));
  }

  async deactivateActive(kind: ConfigKind): Promise<void> {
    for (const record of this.records) {
      if (record.kind === kind && record.active) {
        record.active = false;
      }
    }
  }

  async getActive(kind: ConfigKind): Promise<ConfigVersion | undefined> {
    const record = this.records.find((candidate) => candidate.kind === kind && candidate.active);
    return record ? deepClone(record) : undefined;
  }

  async getVersion(kind: ConfigKind, version: string): Promise<ConfigVersion | undefined> {
    const record = this.records.find(
      (candidate) => candidate.kind === kind && candidate.version === version,
    );
    return record ? deepClone(record) : undefined;
  }

  async countByKind(kind: ConfigKind): Promise<number> {
    return this.records.filter((candidate) => candidate.kind === kind).length;
  }
}
