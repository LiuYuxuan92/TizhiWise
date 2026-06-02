import { describe, expect, it } from 'vitest';
import { ConfigKind } from '@tizhice/shared';
import { InMemoryConfigVersionRepository } from './in-memory-config-version.repository';
import { ConfigVersionService } from './config-version.service';

describe('ConfigVersionService', () => {
  it('publishes immutable versions and keeps exactly one active version per kind', async () => {
    const service = new ConfigVersionService(new InMemoryConfigVersionRepository());

    const v1 = await service.publish(ConfigKind.ALGORITHM, { threshold: 1 }, 'admin-a');
    const v2 = await service.publish(ConfigKind.ALGORITHM, { threshold: 2 }, 'admin-b');

    expect(v1.version).toBe('v1');
    expect(v2.version).toBe('v2');
    await expect(service.getActive(ConfigKind.ALGORITHM)).resolves.toMatchObject({
      kind: ConfigKind.ALGORITHM,
      version: 'v2',
      active: true,
      immutable: true,
      payload: { threshold: 2 },
    });
    await expect(service.getVersion(ConfigKind.ALGORITHM, 'v1')).resolves.toMatchObject({
      version: 'v1',
      active: false,
      immutable: true,
      payload: { threshold: 1 },
    });
  });

  it('does not allow mutation of a published immutable payload through returned objects', async () => {
    const service = new ConfigVersionService(new InMemoryConfigVersionRepository());
    await service.publish(ConfigKind.REPORT_TEMPLATE, { sections: ['original'] }, 'admin');

    const active = await service.getActive(ConfigKind.REPORT_TEMPLATE);
    (active.payload as { sections: string[] }).sections.push('mutated');

    await expect(service.getActive(ConfigKind.REPORT_TEMPLATE)).resolves.toMatchObject({
      payload: { sections: ['original'] },
      immutable: true,
    });
  });

  it('locks session snapshots to versions active at session creation', async () => {
    const service = new ConfigVersionService(new InMemoryConfigVersionRepository());
    await service.publish(ConfigKind.QUESTION_BANK, { questions: ['q1'] }, 'admin');
    await service.publish(ConfigKind.ALGORITHM, { threshold: 1 }, 'admin');

    const snapshot = await service.snapshotForSession('session-1', [
      ConfigKind.QUESTION_BANK,
      ConfigKind.ALGORITHM,
    ]);

    await service.publish(ConfigKind.QUESTION_BANK, { questions: ['q2'] }, 'admin');
    await service.publish(ConfigKind.ALGORITHM, { threshold: 2 }, 'admin');

    await expect(
      service.snapshotForSession('session-1', [ConfigKind.QUESTION_BANK, ConfigKind.ALGORITHM]),
    ).resolves.toEqual(snapshot);
    expect(snapshot).toEqual({ QUESTION_BANK: 'v1', ALGORITHM: 'v1' });
  });
});
