import type { ConfigKind, ConfigVersion } from '@tizhice/shared';

export interface ConfigSnapshotStore {
  get(sessionId: string): Promise<Partial<Record<ConfigKind, string>> | undefined>;
  set(sessionId: string, snapshot: Partial<Record<ConfigKind, string>>): Promise<void>;
}

export interface ConfigVersionRepository {
  publish(record: ConfigVersion): Promise<void>;
  deactivateActive(kind: ConfigKind): Promise<void>;
  getActive(kind: ConfigKind): Promise<ConfigVersion | undefined>;
  getVersion(kind: ConfigKind, version: string): Promise<ConfigVersion | undefined>;
  countByKind(kind: ConfigKind): Promise<number>;
}

export class ConfigVersionService {
  constructor(
    private readonly repository: ConfigVersionRepository,
    private readonly snapshots: ConfigSnapshotStore = new InMemoryConfigSnapshotStore(),
  ) {}

  async publish(
    kind: ConfigKind,
    payload: unknown,
    operator: string,
  ): Promise<{ version: string }> {
    const nextVersion = `v${(await this.repository.countByKind(kind)) + 1}`;
    const record: ConfigVersion = {
      kind,
      version: nextVersion,
      payload: deepClone(payload),
      publishedBy: operator,
      publishedAt: new Date(),
      active: true,
      immutable: true,
    };

    await this.repository.deactivateActive(kind);
    await this.repository.publish(record);
    return { version: nextVersion };
  }

  async getActive(kind: ConfigKind): Promise<ConfigVersion> {
    const record = await this.repository.getActive(kind);
    if (!record) {
      throw new Error(`No active config version for kind ${kind}`);
    }
    return deepClone(record);
  }

  async getVersion(kind: ConfigKind, version: string): Promise<ConfigVersion> {
    const record = await this.repository.getVersion(kind, version);
    if (!record) {
      throw new Error(`Config version not found: ${kind}/${version}`);
    }
    return deepClone(record);
  }

  async snapshotForSession(
    sessionId: string,
    kinds: readonly ConfigKind[],
  ): Promise<Record<ConfigKind, string>> {
    const existing = await this.snapshots.get(sessionId);
    if (existing) {
      return pickSnapshot(existing, kinds);
    }

    const snapshot: Partial<Record<ConfigKind, string>> = {};
    for (const kind of kinds) {
      snapshot[kind] = (await this.getActive(kind)).version;
    }
    await this.snapshots.set(sessionId, snapshot);
    return pickSnapshot(snapshot, kinds);
  }
}

export class InMemoryConfigSnapshotStore implements ConfigSnapshotStore {
  private readonly snapshots = new Map<string, Partial<Record<ConfigKind, string>>>();

  async get(sessionId: string): Promise<Partial<Record<ConfigKind, string>> | undefined> {
    const snapshot = this.snapshots.get(sessionId);
    return snapshot ? { ...snapshot } : undefined;
  }

  async set(sessionId: string, snapshot: Partial<Record<ConfigKind, string>>): Promise<void> {
    this.snapshots.set(sessionId, { ...snapshot });
  }
}

function pickSnapshot(
  snapshot: Partial<Record<ConfigKind, string>>,
  kinds: readonly ConfigKind[],
): Record<ConfigKind, string> {
  const picked = {} as Record<ConfigKind, string>;
  for (const kind of kinds) {
    const version = snapshot[kind];
    if (!version) {
      throw new Error(`Session snapshot is missing config kind ${kind}`);
    }
    picked[kind] = version;
  }
  return picked;
}

export function deepClone<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
