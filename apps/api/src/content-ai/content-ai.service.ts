import {
  AgentRole,
  ContentStatus,
  Platform,
  TaskStatus,
  type AgentDefinition,
  type AgentWorkflowConfig,
  type ContentDraft,
  type ContentGenTask,
  type CreateContentTaskInput,
  type KnowledgeEntry,
} from '@tizhice/shared';
import { defaultAgentWorkflow, defaultKnowledgeBase, platformLabel } from './content-ai.fixtures';
import { InMemoryContentAiRepository } from './in-memory-content-ai.repository';
import {
  hasComplianceRisk,
  LlmProviderError,
  type LlmGenerateInput,
  type LlmProvider,
} from './llm-provider';

interface ContentAiServiceDependencies {
  repository: InMemoryContentAiRepository;
  llm: LlmProvider;
}

export class ContentAIService {
  constructor(private readonly dependencies: ContentAiServiceDependencies) {}

  async bootstrapDefaults(): Promise<void> {
    if (!(await this.dependencies.repository.getActiveWorkflow())) {
      await this.dependencies.repository.publishWorkflow(defaultAgentWorkflow('v1'));
    }
    await this.dependencies.repository.updateKnowledgeBase(defaultKnowledgeBase());
  }

  async createTask(input: CreateContentTaskInput): Promise<{ taskId: string }> {
    const workflow = await this.getActiveWorkflowOrBootstrap();
    const task: ContentGenTask = {
      id: this.dependencies.repository.nextTaskId(),
      operatorId: input.operatorId,
      platforms: [...input.platforms],
      topic: input.topic,
      status: TaskStatus.QUEUED,
      workflowVersion: workflow.version,
      modelVersions: modelVersionsOf(workflow),
      promptVersions: promptVersionsOf(workflow),
      startedAt: new Date(),
      outputs: [],
    };
    await this.dependencies.repository.saveTask(task);
    await this.processTask(task.id, input.additionalContext);
    return { taskId: task.id };
  }

  async getTaskStatus(taskId: string): Promise<ContentGenTask> {
    return this.dependencies.repository.getTaskOrThrow(taskId);
  }

  async publishWorkflow(
    config: Omit<AgentWorkflowConfig, 'version'>,
  ): Promise<{ version: string }> {
    const version = this.dependencies.repository.nextWorkflowVersion();
    await this.dependencies.repository.publishWorkflow({
      ...config,
      version,
      publishedAt: config.publishedAt ?? new Date(),
    });
    return { version };
  }

  async getWorkflow(version: string): Promise<AgentWorkflowConfig> {
    const workflow = await this.dependencies.repository.getWorkflow(version);
    if (!workflow) {
      throw new Error(`Agent workflow not found: ${version}`);
    }
    return workflow;
  }

  async updateKnowledgeBase(entries: KnowledgeEntry[]): Promise<void> {
    await this.dependencies.repository.updateKnowledgeBase(entries);
  }

  async getDraft(draftId: string): Promise<ContentDraft> {
    return this.dependencies.repository.getDraftOrThrow(draftId);
  }

  async processTask(taskId: string, additionalContext = ''): Promise<void> {
    const task = await this.dependencies.repository.getTaskOrThrow(taskId);
    const workflow = await this.getWorkflow(task.workflowVersion);
    const knowledge = await this.dependencies.repository.getActiveKnowledgeBase();
    const working: ContentGenTask = { ...task, status: TaskStatus.IN_PROGRESS };
    await this.dependencies.repository.saveTask(working);

    let failureReason: string | undefined;
    const outputs = [];
    for (const platform of task.platforms) {
      try {
        const draft = await this.generatePlatformDraft({
          task: working,
          workflow,
          platform,
          knowledge,
          additionalContext,
        });
        outputs.push({ draftId: draft.id, platform });
      } catch (error) {
        failureReason = classifyFailure(error);
      }
    }

    const status =
      outputs.length === task.platforms.length
        ? TaskStatus.COMPLETED
        : outputs.length > 0
          ? TaskStatus.PARTIAL_FAILED
          : TaskStatus.FAILED;
    await this.dependencies.repository.saveTask({
      ...working,
      status,
      completedAt: new Date(),
      failureReason,
      outputs,
    });
  }

  private async generatePlatformDraft(input: {
    task: ContentGenTask;
    workflow: AgentWorkflowConfig;
    platform: Platform;
    knowledge: KnowledgeEntry[];
    additionalContext: string;
  }): Promise<ContentDraft> {
    const topicAgent = agent(input.workflow, AgentRole.TOPIC_PICKER);
    const copyAgent = agent(input.workflow, AgentRole.COPYWRITER);
    const complianceAgent = agent(input.workflow, AgentRole.COMPLIANCE_REVIEWER);
    const visualAgent = agent(input.workflow, AgentRole.VISUAL_ADVISOR);
    const knowledgeText = input.knowledge.map((entry) => entry.content).join('\n');
    const topicAngle = await this.callWithRetry({
      agent: topicAgent,
      task: input.task,
      platform: input.platform,
      prompt: renderPrompt(topicAgent.promptTemplate, input, knowledgeText),
    });
    let copy = '';
    let flags: string[] = [];

    for (let attempt = 1; attempt <= copyAgent.maxRetries + 1; attempt += 1) {
      copy = (
        await this.callWithRetry({
          agent: copyAgent,
          task: input.task,
          platform: input.platform,
          prompt: [
            renderPrompt(copyAgent.promptTemplate, input, knowledgeText),
            topicAngle,
            input.additionalContext,
          ].join('\n'),
        })
      ).text;
      flags = complianceFlags(copy);
      const review = await this.callWithRetry({
        agent: complianceAgent,
        task: input.task,
        platform: input.platform,
        prompt: copy,
      });
      if (review.text === 'PASS' && flags.length === 0) {
        break;
      }
      copy = safeRewrite(copy);
      flags = complianceFlags(copy);
      if (flags.length === 0) {
        break;
      }
      if (attempt > copyAgent.maxRetries) {
        break;
      }
    }

    const visual = await this.callWithRetry({
      agent: visualAgent,
      task: input.task,
      platform: input.platform,
      prompt: copy,
    });
    const draft: ContentDraft = {
      id: this.dependencies.repository.nextDraftId(),
      taskId: input.task.id,
      platform: input.platform,
      status: flags.length === 0 ? ContentStatus.DRAFT : ContentStatus.RISK_FLAGGED,
      title: `${platformLabel(input.platform)}｜${input.task.topic}`,
      body: `${copy}\n\n素材建议：${visual.text}`,
      tags: [input.task.topic, platformLabel(input.platform)],
      versions: [],
      complianceFlags: flags.length > 0 ? flags : undefined,
      createdAt: new Date(),
    };
    await this.dependencies.repository.saveDraft(draft);
    return draft;
  }

  private async callWithRetry(input: {
    agent: AgentDefinition;
    task: ContentGenTask;
    platform: Platform;
    prompt: string;
  }) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= input.agent.maxRetries + 1; attempt += 1) {
      try {
        return await this.dependencies.llm.generate({
          role: input.agent.role,
          model: input.agent.model,
          prompt: input.prompt,
          topic: input.task.topic,
          platform: input.platform,
          attempt,
        } satisfies LlmGenerateInput);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private async getActiveWorkflowOrBootstrap(): Promise<AgentWorkflowConfig> {
    const active = await this.dependencies.repository.getActiveWorkflow();
    if (active) {
      return active;
    }
    await this.bootstrapDefaults();
    return (await this.dependencies.repository.getActiveWorkflow())!;
  }
}

function agent(workflow: AgentWorkflowConfig, role: AgentRole): AgentDefinition {
  const definition = workflow.agents.find((candidate) => candidate.role === role);
  if (!definition) {
    throw new Error(`Workflow ${workflow.version} is missing agent ${role}`);
  }
  return definition;
}

function renderPrompt(
  template: string,
  input: { platform: Platform; task: ContentGenTask; additionalContext: string },
  knowledgeText: string,
): string {
  return template
    .replaceAll('{{platform}}', input.platform)
    .replaceAll('{{topic}}', input.task.topic)
    .replaceAll('{{brandContext}}', knowledgeText)
    .concat('\n', input.additionalContext);
}

function complianceFlags(text: string): string[] {
  const flags: string[] = [];
  if (hasComplianceRisk(text)) {
    flags.push('MEDICAL_OR_ABSOLUTE_CLAIM');
  }
  if (!text.includes('非医疗诊断')) {
    flags.push('MISSING_NON_DIAGNOSTIC_DISCLAIMER');
  }
  return flags;
}

function safeRewrite(text: string): string {
  return text
    .replaceAll('治疗', '调理参考')
    .replaceAll('治愈', '改善参考')
    .replaceAll('根治', '长期管理')
    .replaceAll('100% 有效', '因人而异')
    .replaceAll('100%有效', '因人而异')
    .replaceAll('最好', '建议')
    .replaceAll('必须', '可以考虑')
    .replaceAll('一定能', '有机会');
}

function modelVersionsOf(workflow: AgentWorkflowConfig): Partial<Record<AgentRole, string>> {
  return Object.fromEntries(workflow.agents.map((agent) => [agent.role, agent.model])) as Partial<
    Record<AgentRole, string>
  >;
}

function promptVersionsOf(workflow: AgentWorkflowConfig): Partial<Record<AgentRole, string>> {
  return Object.fromEntries(
    workflow.agents.map((agent) => [agent.role, `${workflow.version}:${agent.role}`]),
  ) as Partial<Record<AgentRole, string>>;
}

function classifyFailure(error: unknown): string {
  if (error instanceof LlmProviderError) {
    return error.code;
  }
  return error instanceof Error ? error.message : 'unknown';
}
