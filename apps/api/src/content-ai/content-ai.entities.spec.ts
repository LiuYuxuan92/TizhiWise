import { describe, expect, it } from 'vitest';
import { getMetadataArgsStorage } from 'typeorm';
import {
  AgentWorkflowConfigEntity,
  ContentGenTaskEntity,
  KnowledgeEntryEntity,
} from './content-ai.entities';

describe('content AI entities', () => {
  it('map workflow, knowledge and generation task tables', () => {
    expect(tableName(AgentWorkflowConfigEntity)).toBe('agent_workflow_configs');
    expect(tableName(KnowledgeEntryEntity)).toBe('knowledge_entries');
    expect(tableName(ContentGenTaskEntity)).toBe('content_gen_tasks');
    expect(columnNames(ContentGenTaskEntity)).toEqual(
      expect.arrayContaining([
        'operatorId',
        'platforms',
        'topic',
        'status',
        'workflowVersion',
        'modelVersionsJson',
        'promptVersionsJson',
        'outputsJson',
      ]),
    );
  });
});

type EntityConstructor = new (...args: never[]) => unknown;

function tableName(target: EntityConstructor): string | undefined {
  return getMetadataArgsStorage().tables.find((candidate) => candidate.target === target)?.name;
}

function columnNames(target: EntityConstructor): string[] {
  return getMetadataArgsStorage()
    .columns.filter((candidate) => candidate.target === target)
    .map((column) => column.propertyName);
}
