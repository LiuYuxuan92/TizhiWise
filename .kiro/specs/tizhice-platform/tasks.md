# Implementation Plan: 知体（tizhice.cn）中医体质健康测评平台

## Overview

本实现计划将设计文档转化为可增量执行的编码任务。技术栈遵循设计默认假设：

- 后端：Node.js + NestJS + TypeScript（模块化单体），PostgreSQL + Redis，BullMQ 队列
- 前端：Vue 3 + Vite + TypeScript + Pinia + Vant（微信 H5 优先）
- 测试：Vitest/Jest（单元）、fast-check（属性化测试 PBT）、Testcontainers（集成）、Playwright（E2E）

构建顺序遵循"基础设施 → 配置版本化 → 算法 → 测评 → 报告 → 支付 → 用户/追踪/AI/内容 → 管理后台 → 前端 → 接入层 → 集成联调"，每个组件先于其消费者完成，最终把所有部分接线成端到端闭环。设计含 Correctness Properties（P-1 ~ P-30），相应属性化测试作为对应实现任务的子任务，标记为可选（`*`）。

## Tasks

- [x] 1. 项目脚手架与核心基础设施
  - [x] 1.1 初始化 monorepo 与前后端骨架
    - 创建 monorepo 目录结构（`apps/api` NestJS、`apps/h5` Vue3、`apps/admin` SPA、`packages/shared`）
    - 配置 TypeScript、ESLint/Prettier、构建脚本与环境变量加载（`.env` 约定）
    - _Requirements: 1.5, 1.6, 12.1_

  - [x] 1.2 定义共享领域类型与枚举
    - 在 `packages/shared` 中实现 `ConstitutionType`、`AssessmentChannel`、`SessionStatus`、`OrderStatus`、`ContentStatus`、`Platform`、`AgentRole`、`ConsentScope`、`EventType` 等类型
    - 定义跨服务 DTO 接口（Question、AnswerValue、ConstitutionResult、Report、PaymentOrder 等）
    - _Requirements: 3.1, 4.1, 5.1, 6.3, 7.1, 9.1, 10.1_

  - [x] 1.3 搭建数据库迁移、Redis 与测试框架
    - 配置 PostgreSQL 连接、迁移工具（TypeORM/Prisma 迁移）、Redis 客户端与 BullMQ
    - 配置 Vitest/Jest、fast-check、Testcontainers(PG/Redis) 测试基座与脚本
    - _Requirements: 3.7, 12.2, 12.8_

  - [x] 1.4 实现应用层加密工具
    - 实现 AES-256-GCM 加解密封装与 KMS 主密钥抽象（密钥不入前端/日志）
    - 提供透明加密字段装饰器/转换器供实体复用
    - _Requirements: 9.6, 12.1_

  - [x]* 1.5 编写加密工具单元测试
    - 测试加解密往返一致、密钥轮换兼容、错误密钥拒绝
    - _Requirements: 9.6, 12.1_

- [x] 2. 配置中心与版本快照（R11 基础）
  - [x] 2.1 实现配置版本数据模型与迁移
    - 创建 `config_versions` 表（kind/version/payload_json/published_by/published_at/active/immutable）
    - 添加 `(kind, active)` 唯一活跃版本约束
    - _Requirements: 11.3_

  - [x] 2.2 实现 ConfigVersionService 发布与读取
    - 实现 `publish`（发布即冻结为不可变版本）、`getActive`、`getVersion`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 2.3 实现会话配置快照
    - 实现 `snapshotForSession`，锁定题库/算法版本号到会话并缓存到 Redis；提交时按快照取配置（不读 active）
    - _Requirements: 11.7, 4.8_

  - [x]* 2.4 编写属性测试：配置快照不变性
    - **Property 19: 配置快照不变性**
    - **Validates: Requirements 11.7**

  - [x]* 2.5 编写配置版本单元测试
    - 测试发布后不可变、同一 kind 仅一个 active、版本读取正确
    - _Requirements: 11.3_

- [x] 3. 体质判定算法（R4）
  - [x] 3.1 实现转化分计算与体质判定
    - 实现 `judge`：按 constitution 分组求 rawScore（含 weight/reverseScore）、转化分公式、平和质规则、偏颇阈值判定、主体质与兼夹排序
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.2 实现算法配置加载与发布
    - 实现 `publishConfig`/`getConfig`，记录 `algorithmVersion`；判定时使用会话锁定版本
    - _Requirements: 4.6, 4.7_

  - [x]* 3.3 编写属性测试：转化分有界
    - **Property 1: 转化分有界（convertedScore ∈ [0,100]）**
    - **Validates: Requirements 4.1**

  - [x]* 3.4 编写属性测试：转化分公式正确
    - **Property 3: 转化分公式正确（converted == (raw-itemCount)/(itemCount*4)*100）**
    - **Validates: Requirements 4.1**

  - [x]* 3.5 编写属性测试：单调响应
    - **Property 9: 单调响应（提高相关题得分该体质转化分不下降）**
    - **Validates: Requirements 4.1**

  - [x]* 3.6 编写属性测试：平和质互斥规则
    - **Property 4: 平和质互斥规则**
    - **Validates: Requirements 4.2**

  - [x]* 3.7 编写属性测试：偏颇判定阈值
    - **Property 5: 偏颇判定阈值（≥40 YES；30–39 TENDENCY；<30 NO）**
    - **Validates: Requirements 4.3, 4.4**

  - [x]* 3.8 编写属性测试：兼夹排序单调性
    - **Property 6: 排序单调性（concurrent 按转化分非升序）**
    - **Validates: Requirements 4.5**

  - [x]* 3.9 编写属性测试：主体质一致性
    - **Property 7: 主体质一致性（primary 转化分 ≥ 任意 concurrent）**
    - **Validates: Requirements 4.5**

  - [x]* 3.10 编写属性测试：算法确定性
    - **Property 2: 算法确定性（同输入同版本恒等）**
    - **Validates: Requirements 4.7**

  - [x]* 3.11 编写属性测试：历史不可变
    - **Property 8: 历史不可变（旧 resultId 以锁定版本重算结果不变）**
    - **Validates: Requirements 4.8**

- [x] 4. Checkpoint - 确保算法与配置相关测试通过
  - Ensure all tests pass, ask the user if questions arise.
