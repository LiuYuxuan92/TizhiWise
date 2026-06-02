import type { ConfigKind, ConfigVersion } from '@tizhice/shared';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { ConfigVersionEntity } from './config-version.entity';
import { deepClone, type ConfigVersionRepository } from './config-version.service';

@Injectable()
export class TypeOrmConfigVersionRepository implements ConfigVersionRepository {
  constructor(
    @InjectRepository(ConfigVersionEntity)
    private readonly repository: Repository<ConfigVersionEntity>,
  ) {}

  async publish(record: ConfigVersion): Promise<void> {
    await this.repository.save(
      this.repository.create({
        kind: record.kind,
        version: record.version,
        payloadJson: deepClone(record.payload),
        publishedBy: record.publishedBy,
        publishedAt: record.publishedAt,
        active: record.active,
        immutable: record.immutable,
      }),
    );
  }

  async deactivateActive(kind: ConfigKind): Promise<void> {
    await this.repository.update({ kind, active: true }, { active: false });
  }

  async getActive(kind: ConfigKind): Promise<ConfigVersion | undefined> {
    const entity = await this.repository.findOne({ where: { kind, active: true } });
    return entity ? this.toDomain(entity) : undefined;
  }

  async getVersion(kind: ConfigKind, version: string): Promise<ConfigVersion | undefined> {
    const entity = await this.repository.findOne({ where: { kind, version } });
    return entity ? this.toDomain(entity) : undefined;
  }

  async countByKind(kind: ConfigKind): Promise<number> {
    return this.repository.count({ where: { kind } });
  }

  private toDomain(entity: ConfigVersionEntity): ConfigVersion {
    return {
      kind: entity.kind,
      version: entity.version,
      payload: deepClone(entity.payloadJson),
      publishedBy: entity.publishedBy,
      publishedAt: entity.publishedAt,
      active: entity.active,
      immutable: true,
    };
  }
}
