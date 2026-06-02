import type {
  AgentWorkflowConfig,
  ContentDraft,
  ContentGenTask,
  KnowledgeEntry,
  ListDraftsFilters,
  PaginatedList,
} from '@tizhice/shared';

export class InMemoryContentAiRepository {
  private taskCounter = 0;
  private draftCounter = 0;
  private workflowCounter = 0;
  private readonly tasks = new Map<string, ContentGenTask>();
  private readonly drafts = new Map<string, ContentDraft>();
  private readonly workflows = new Map<string, AgentWorkflowConfig>();
  private activeWorkflowVersion: string | null = null;
  private knowledgeBase: KnowledgeEntry[] = [];

  nextTaskId(): string {
    this.taskCounter += 1;
    return `content-task-${this.taskCounter}`;
  }

  nextDraftId(): string {
    this.draftCounter += 1;
    return `content-draft-${this.draftCounter}`;
  }

  nextWorkflowVersion(): string {
    this.workflowCounter += 1;
    return `v${this.workflowCounter}`;
  }

  async saveTask(task: ContentGenTask): Promise<void> {
    this.tasks.set(task.id, cloneTask(task));
  }

  async getTaskOrThrow(taskId: string): Promise<ContentGenTask> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Content task not found: ${taskId}`);
    }
    return cloneTask(task);
  }

  async saveDraft(draft: ContentDraft): Promise<void> {
    this.drafts.set(draft.id, cloneDraft(draft));
  }

  async updateDraft(draft: ContentDraft): Promise<void> {
    if (!this.drafts.has(draft.id)) {
      throw new Error(`Content draft not found: ${draft.id}`);
    }
    this.drafts.set(draft.id, cloneDraft(draft));
  }

  async getDraftOrThrow(draftId: string): Promise<ContentDraft> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Content draft not found: ${draftId}`);
    }
    return cloneDraft(draft);
  }

  async listDraftsByTask(taskId: string): Promise<ContentDraft[]> {
    return [...this.drafts.values()].filter((draft) => draft.taskId === taskId).map(cloneDraft);
  }

  async listDrafts(
    filters: ListDraftsFilters & { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedList<ContentDraft>> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, filters.pageSize ?? 20);
    const [startDate, endDate] = filters.dateRange ?? [];
    const requiredTags = filters.tags ?? [];
    const filtered = [...this.drafts.values()]
      .filter((draft) => (filters.platform ? draft.platform === filters.platform : true))
      .filter((draft) => (filters.status ? draft.status === filters.status : true))
      .filter((draft) => (startDate ? draft.createdAt >= startDate : true))
      .filter((draft) => (endDate ? draft.createdAt <= endDate : true))
      .filter((draft) => requiredTags.every((tag) => draft.tags.includes(tag)))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map(cloneDraft),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  async publishWorkflow(config: AgentWorkflowConfig): Promise<void> {
    this.workflows.set(config.version, cloneWorkflow(config));
    this.activeWorkflowVersion = config.version;
  }

  async getWorkflow(version: string): Promise<AgentWorkflowConfig | undefined> {
    const workflow = this.workflows.get(version);
    return workflow ? cloneWorkflow(workflow) : undefined;
  }

  async getActiveWorkflow(): Promise<AgentWorkflowConfig | undefined> {
    return this.activeWorkflowVersion ? this.getWorkflow(this.activeWorkflowVersion) : undefined;
  }

  async countWorkflows(): Promise<number> {
    return this.workflows.size;
  }

  async updateKnowledgeBase(entries: readonly KnowledgeEntry[]): Promise<void> {
    this.knowledgeBase = entries.map((entry) => ({ ...entry }));
  }

  async getActiveKnowledgeBase(): Promise<KnowledgeEntry[]> {
    return this.knowledgeBase.filter((entry) => entry.active).map((entry) => ({ ...entry }));
  }
}

function cloneTask(task: ContentGenTask): ContentGenTask {
  return {
    ...task,
    platforms: [...task.platforms],
    startedAt: new Date(task.startedAt),
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    modelVersions: { ...task.modelVersions },
    promptVersions: { ...task.promptVersions },
    outputs: task.outputs.map((output) => ({ ...output })),
  };
}

function cloneDraft(draft: ContentDraft): ContentDraft {
  return {
    ...draft,
    tags: [...draft.tags],
    versions: draft.versions.map((version) => ({
      ...version,
      editedAt: new Date(version.editedAt),
    })),
    complianceFlags: draft.complianceFlags ? [...draft.complianceFlags] : undefined,
    scriptStoryboard: draft.scriptStoryboard
      ? JSON.parse(JSON.stringify(draft.scriptStoryboard))
      : undefined,
    createdAt: new Date(draft.createdAt),
    publishedAt: draft.publishedAt ? new Date(draft.publishedAt) : undefined,
  };
}

function cloneWorkflow(workflow: AgentWorkflowConfig): AgentWorkflowConfig {
  return {
    ...workflow,
    publishedAt: new Date(workflow.publishedAt),
    agents: workflow.agents.map((agent) => ({ ...agent })),
    orchestration: workflow.orchestration.map((node) => ({
      ...node,
      dependsOn: [...node.dependsOn],
    })),
  };
}
