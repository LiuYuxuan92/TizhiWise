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

- [x] 5. 测评会话与题库服务（R1/R2/R3/R11）
  - [x] 5.1 实现题库配置结构与默认种子数据
    - 定义体质题库、痛症题库、题目选项、必答规则、题目顺序与版本化 payload schema
    - 提供开发环境默认题库 seed，覆盖痛症与体质双通道
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 11.1_

  - [x] 5.2 实现 AssessmentSession / Answer / PainResult / ConstitutionResult 数据模型与迁移
    - 创建测评会话、答案、痛症结果、体质结果表
    - 对 baseProfile、answer value 等敏感字段接入应用层加密转换器
    - _Requirements: 3.7, 4.7, 9.6, 12.1_

  - [x] 5.3 实现 AssessmentService.createSession 与继续测评查询
    - 创建会话时锁定 questionBankVersion 与 algorithmVersion
    - 支持匿名用户与登录用户；支持 channelSource 归因
    - 实现 getResume(userId/anonymousId, channel)
    - _Requirements: 1.4, 3.3, 10.4, 11.7_

  - [x] 5.4 实现题目推进、答题提交与修改
    - 实现 getNextQuestion、submitAnswer、reviseAnswer
    - 校验必答题、题型、分值范围、选项合法性
    - 同一 session/question 或 idempotencyKey 重复提交保持幂等
    - _Requirements: 2.5, 2.7, 3.2, 3.4, 3.5, 12.2_

  - [x] 5.5 实现痛症红旗征规则引擎
    - 支持疼痛强度、持续时间、麻木无力、夜间痛醒等组合规则
    - 命中规则时返回 URGENT/WARNING 和非诊断声明
    - _Requirements: 2.3, 2.4, 12.5_

  - [x] 5.6 实现 finalize 测评提交闭环
    - 必答题未完成时拒绝提交并定位首个未答题
    - 体质通道调用锁定算法版本计算并持久化结果
    - 痛症通道生成 PainResult 并进入报告流程
    - 提交后写入完成事件
    - _Requirements: 2.6, 3.5, 3.6, 3.7, 10.1_

  - [x]* 5.7 编写属性测试：答题幂等
    - **Property 17: 答题幂等**
    - **Validates: Requirements 3.7**

  - [x]* 5.8 编写属性测试：必答约束
    - **Property 18: 必答约束**
    - **Validates: Requirements 3.5, 2.5**

  - [x]* 5.9 编写属性测试：恢复一致
    - **Property 20: 恢复一致**
    - **Validates: Requirements 1.4**

  - [x]* 5.10 编写属性测试：红旗征触发
    - **Property 21: 红旗征触发**
    - **Validates: Requirements 2.4**

- [x] 6. 动态报告生成与访问控制（R5）
  - [x] 6.1 实现报告模板、内容片段与报告实体迁移
    - 创建 reports、report_templates/片段配置或统一 config payload
    - 区分 BASIC/DEEP 层级，payload 敏感内容加密存储
    - _Requirements: 5.1, 5.3, 5.6, 5.10, 9.6_

  - [x] 6.2 实现 ReportService.assemble
    - 根据测评类型、体质结果、痛症结果、模板版本组装报告
    - 报告包含概览、解读、饮食建议、生活方式建议、必要就医提示与免责声明
    - 兼夹体质建议按主体质优先级展示
    - _Requirements: 5.1, 5.2, 5.6, 5.7, 5.8, 12.5_

  - [x] 6.3 实现基础/深度报告可见性控制
    - 未付费时返回基础报告与深度内容标题/摘要遮罩
    - 已付费时返回完整深度报告
    - 服务端统一判断权限，不信任前端状态
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 6.4 实现报告查询、历史列表与“我的报告”接口
    - getReport 按 viewerUserId 控制深度内容
    - listMyReports 返回用户历史报告
    - _Requirements: 5.10, 9.4_

  - [x] 6.5 实现报告分享链接与图片导出任务
    - 分享链接带过期时间，深度内容仍受付费权限控制
    - 图片导出进入 BullMQ 异步队列，失败可重试
    - _Requirements: 5.9, 12.8_

  - [x]* 6.6 编写属性测试：权限-付费一致
    - **Property 14: 权限-付费一致**
    - **Validates: Requirements 5.4, 6.6, 6.10**

- [x] 7. 支付订单、微信 JSAPI 与退款闭环（R6/R12）
  - [x] 7.1 实现 PaymentOrder / PaymentTxnLog / ReportAccess 数据模型与迁移
    - 建立订单状态、支付流水、报告深度访问权限表
    - 添加有效订单唯一约束，防重复付费
    - _Requirements: 6.3, 6.7, 6.9_

  - [x] 7.2 实现 PaymentService.createOrder
    - 已付费报告直接放行或返回已有权益
    - 未付费时创建唯一订单并生成微信 JSAPI 支付参数
    - 下单使用 idempotencyKey 防重复创建
    - _Requirements: 6.1, 6.2, 6.3, 6.7_

  - [x] 7.3 实现微信支付回调验签与幂等处理
    - 校验 API v3 签名、timestamp 时间窗、nonce 防重放
    - 回调成功后更新订单为 PAID 并开通深度报告权限
    - 重复回调不得重复产生副作用
    - _Requirements: 6.4, 6.5, 6.6, 12.4_

  - [x] 7.4 实现订单状态查询、超时关闭与重发
    - queryStatus 返回服务端权威状态
    - closeExpiredOrders 关闭超时 PENDING 订单
    - CLOSED 后允许重新创建订单
    - _Requirements: 6.5, 6.8_

  - [x] 7.5 实现后台退款与权限回收
    - 支持按订单退款、记录操作人和原因
    - 退款成功后回收报告深度访问权限
    - _Requirements: 6.10_

  - [x]* 7.6 编写属性测试：回调幂等
    - **Property 10: 回调幂等**
    - **Validates: Requirements 6.4**

  - [x]* 7.7 编写属性测试：订单状态机合法
    - **Property 11: 订单状态机合法**
    - **Validates: Requirements 6.3**

  - [x]* 7.8 编写属性测试：防重复付费
    - **Property 12: 防重复付费**
    - **Validates: Requirements 6.7**

  - [x]* 7.9 编写属性测试：验签前不改状态
    - **Property 13: 验签前不改状态**
    - **Validates: Requirements 6.4**

  - [x]* 7.10 编写属性测试：退款回收
    - **Property 15: 退款回收**
    - **Validates: Requirements 6.10**

  - [x]* 7.11 编写属性测试：超时关闭可重发
    - **Property 16: 超时关闭可重发**
    - **Validates: Requirements 6.8**

- [x] 8. 用户账户、授权、匿名归并与隐私删除（R9/R12）
  - [x] 8.1 实现 User / Consent 数据模型与迁移
    - 微信 openid/unionid 加密存储
    - consentScopes 支持授予、撤回与历史记录
    - _Requirements: 9.1, 9.2, 9.6, 12.6_

  - [x] 8.2 实现微信 OAuth 登录与服务端会话令牌
    - 支持微信内浏览器授权获取用户标识
    - 首次授权创建用户档案
    - 签发短期 JWT/刷新令牌
    - _Requirements: 9.1, 9.2, 12.7_

  - [x] 8.3 实现匿名测评登录归并
    - 将 anonymousId 下的会话、报告、订单归并到登录用户
    - 重复归并保持幂等且不丢记录
    - _Requirements: 9.3_

  - [x] 8.4 实现“我的”中心聚合接口
    - 返回历史测评、报告与订单
    - 已删除/匿名化用户不可访问敏感数据
    - _Requirements: 9.4_

  - [x] 8.5 实现账户删除与数据匿名化
    - 清除或不可逆匿名化可识别字段
    - 保留合法聚合统计所需的脱敏数据
    - _Requirements: 9.5, 12.6_

  - [x]* 8.6 编写属性测试：归并幂等且保全
    - **Property 27: 归并幂等且保全**
    - **Validates: Requirements 9.3**

  - [x]* 8.7 编写属性测试：删除后不可识别
    - **Property 29: 删除后不可识别**
    - **Validates: Requirements 9.5**

- [x] 9. 行为追踪、趋势分析与运营看板（R10）
  - [x] 9.1 实现 BehaviorEvent 数据模型与采集接口
    - 记录进入测评、完成测评、查看报告、发起支付、支付成功、分享等事件
    - 支持 userId/anonymousId、channel、channelSource、metadata
    - _Requirements: 10.1, 10.4_

  - [x] 9.2 实现授权范围校验与撤回停采
    - track 前检查 consentScopes
    - 用户撤回 BEHAVIOR_TRACKING 后停止新增行为采集
    - _Requirements: 10.7, 12.6_

  - [x] 9.3 实现复测趋势查询
    - 同一用户多次体质/痛症测评结果按时间线聚合
    - 支持体质变化和痛症强度变化趋势
    - _Requirements: 10.2_

  - [x] 9.4 实现运营看板聚合接口
    - 展示测评完成数、付费转化率、体质分布、渠道来源
    - 支持时间范围与渠道筛选
    - _Requirements: 10.3, 10.4_

  - [x] 9.5 实现聚合数据导出与小样本抑制
    - 导出按体质、年龄段、来源分组的聚合数据
    - 样本数低于阈值时抑制或合并，避免反推个人
    - _Requirements: 10.5, 10.6_

  - [x]* 9.6 编写属性测试：撤回停采
    - **Property 28: 撤回停采**
    - **Validates: Requirements 10.7**

  - [x]* 9.7 编写属性测试：聚合最小样本
    - **Property 30: 聚合最小样本**
    - **Validates: Requirements 10.5**

- [x] 10. AI 多 Agent 内容生成系统（R7/R12）
  - [x] 10.1 实现 AgentWorkflowConfig / KnowledgeEntry / ContentGenTask 数据模型
    - 支持 Agent 角色、顺序、提示词模板、模型、超时、重试配置
    - 记录 workflowVersion、modelVersions、promptVersions
    - _Requirements: 7.1, 7.8, 7.10, 7.12_

  - [x] 10.2 实现 LLM Provider 抽象与受控 Mock
    - 封装 chat/generate 接口、超时、错误分类、限流错误
    - 测试环境使用 deterministic mock/录制回放，避免真实成本和不稳定性
    - _Requirements: 7.11, 12.8_

  - [x] 10.3 实现内容生成任务编排器
    - 选题、撰写、审核、配图建议 Agent 按 DAG 串并行执行
    - 支持小红书、视频号、朋友圈平台差异化输出
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.9_

  - [x] 10.4 实现合规审核与重写闭环
    - 审核医疗功效宣称、绝对化用语等违规表述
    - 不合规时退回重写或标记人工修改，不得直接进入待发布状态
    - _Requirements: 7.6, 7.7, 12.9_

  - [x] 10.5 实现 AI 任务队列 Worker 与失败隔离
    - BullMQ 异步处理内容生成任务
    - 单任务超重试失败只标记该任务，不影响其他任务
    - _Requirements: 7.11, 12.8_

  - [x]* 10.6 编写属性测试：合规门禁
    - **Property 22: 合规门禁**
    - **Validates: Requirements 7.7, 8.7**

  - [x]* 10.7 编写属性测试：失败隔离
    - **Property 23: 失败隔离**
    - **Validates: Requirements 7.11**

  - [x]* 10.8 编写属性测试：平台产物完整
    - **Property 24: 平台产物完整**
    - **Validates: Requirements 7.9**

  - [x]* 10.9 编写属性测试：版本可追溯
    - **Property 25: 版本可追溯**
    - **Validates: Requirements 7.12**

  - [x]* 10.10 编写属性测试：重试上限
    - **Property 26: 重试上限**
    - **Validates: Requirements 7.11**

- [x] 11. 内容管理、审批与发布导出（R8）
  - [x] 11.1 实现 ContentDraft / ContentVersion 数据模型与迁移
    - 保存平台、状态、标题、正文、视频脚本、标签、合规风险、发布元数据
    - 编辑时保留版本历史 diff
    - _Requirements: 8.1, 8.2, 8.5, 8.6_

  - [x] 11.2 实现草稿列表、筛选与详情接口
    - 支持按平台、状态、生成时间、标签筛选
    - 分页返回内容草稿
    - _Requirements: 8.1_

  - [x] 11.3 实现草稿编辑、审批、废弃状态机
    - 编辑保存版本历史
    - 审批通过后允许进入发布流程
    - 带合规风险内容发布前必须人工确认
    - _Requirements: 8.2, 8.3, 8.7_

  - [x] 11.4 实现发布接口与人工导出
    - 平台 API 可用时支持一键/定时发布
    - 平台 API 不可用时导出文案和素材建议供人工发布
    - 记录发布时间、平台、操作人
    - _Requirements: 8.4, 8.5_

- [x] 12. 管理后台 API、RBAC 与审计（R11/R12）
  - [x] 12.1 实现 AdminUser / Role / Permission / AuditLog 数据模型
    - 支持后台用户、角色、权限矩阵、操作审计
    - _Requirements: 11.6, 12.7_

  - [x] 12.2 实现后台鉴权、权限守卫与默认拒绝策略
    - 未授权请求返回 401/403
    - 管理操作均经 RBAC 校验
    - _Requirements: 11.6, 12.7_

  - [x] 12.3 实现题库管理 API
    - 增删改查痛症与体质题目、选项、分值映射
    - 发布新题库版本走 ConfigVersionService
    - _Requirements: 11.1, 11.3_

  - [x] 12.4 实现算法配置管理 API
    - 维护阈值、权重、题目-体质映射
    - 发布后冻结版本，仅对新会话生效
    - _Requirements: 11.2, 11.3, 11.7_

  - [x] 12.5 实现报告模板与内容片段管理 API
    - 按体质/痛症类型维护差异化内容
    - 强制保留免责声明片段
    - _Requirements: 11.4, 12.5_

  - [x] 12.6 实现 AI Agent 工作流管理 API
    - 维护 Agent 角色、顺序、提示词模板、模型配置
    - 发布工作流版本并记录审计
    - _Requirements: 11.5, 7.10_

  - [x] 12.7 实现管理操作审计日志
    - 记录 operator、action、resource、before/after、ip、occurredAt
    - 对关键配置发布、退款、审批发布均写审计
    - _Requirements: 11.6, 6.10, 8.5_

- [x] 13. H5 前端用户旅程（R1/R2/R3/R5/R6/R9/R10/R12）
  - [x] 13.1 实现 H5 首页与双通道入口
    - 展示痛症测评、体质测评入口
    - 展示“先进厨房后劲药房”和非医疗诊断免责声明
    - 非移动端响应式展示不缺功能
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 12.5_

  - [x] 13.2 实现体质测评引导、基础信息采集与逐题作答
    - 性别、年龄段采集
    - 五级李克特量表题目
    - 实时进度、未答定位、返回修改
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 13.3 实现痛症测评流程
    - 疼痛部位图、疼痛性质、持续时间、诱发/缓解因素、0-10 强度
    - 命中红旗征时显著展示就医提示和非诊断声明
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 13.4 实现中断恢复与继续测评提示
    - 首页入口显示“继续测评”
    - 恢复至上次中断题目，已答内容保持一致
    - _Requirements: 1.4_

  - [x] 13.5 实现报告页、深度报告遮罩与付费解锁入口
    - 基础报告完整展示
    - 深度内容未付费时展示预览遮罩
    - 支付成功后刷新展示完整深度报告
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 13.6 实现微信授权、我的中心与历史报告
    - 微信内授权登录
    - 匿名记录登录后归并
    - 我的中心展示测评、报告、订单
    - _Requirements: 9.1, 9.3, 9.4_

  - [x] 13.7 实现微信分享、报告图片保存与埋点
    - 微信 JS-SDK 分享配置
    - 报告分享链接与导出图片调用
    - 关键用户行为事件埋点
    - _Requirements: 1.5, 5.9, 10.1_

  - [x] 13.8 实现 H5 首屏性能优化
    - 路由级代码分割、骨架屏、关键资源预加载
    - Lighthouse/移动视口验证首屏 3 秒可交互目标
    - _Requirements: 12.3_

- [ ] 14. 管理后台前端（R8/R10/R11/R12）
  - [ ] 14.1 实现后台登录与权限控制 UI
    - 登录态、401/403 处理、菜单按权限显示
    - _Requirements: 11.6, 12.7_

  - [ ] 14.2 实现题库管理页面
    - 痛症/体质题目增删改查、选项与分值映射编辑、发布版本
    - _Requirements: 11.1, 11.3_

  - [ ] 14.3 实现算法配置管理页面
    - 阈值、权重、题目-体质映射维护
    - 发布、查看历史版本、回看 active 版本
    - _Requirements: 11.2, 11.3, 11.7_

  - [ ] 14.4 实现报告模板与内容片段管理页面
    - 按体质/痛症维护片段
    - 校验免责声明不可移除
    - _Requirements: 11.4, 5.6, 5.8_

  - [ ] 14.5 实现 AI Agent 工作流配置页面
    - Agent 角色、顺序、提示词模板、模型、超时、重试配置
    - _Requirements: 11.5, 7.10_

  - [ ] 14.6 实现内容草稿管理与发布页面
    - 草稿筛选、详情、编辑、审批、风险确认、发布/导出
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.7_

  - [ ] 14.7 实现运营看板页面
    - 测评完成数、付费转化率、体质分布、渠道来源、趋势图
    - 聚合导出入口
    - _Requirements: 10.3, 10.4, 10.6_

  - [ ] 14.8 实现审计日志与退款操作页面
    - 查看审计日志
    - 按订单发起退款并展示权限回收状态
    - _Requirements: 6.10, 11.6_

- [ ] 15. API 接入层、错误模型、鉴权与安全加固（R12）
  - [ ] 15.1 实现统一 API 响应与错误模型
    - 输出 `{ code, message, traceId, retriable }`
    - 对外不暴露内部栈和敏感信息
    - _Requirements: 12.2, 12.8_

  - [ ] 15.2 实现全局输入校验与防注入策略
    - DTO/class-validator/zod 校验所有外部输入
    - 数据访问层使用参数化查询/ORM 安全查询
    - _Requirements: 12.2_

  - [ ] 15.3 实现 API 鉴权、后台鉴权与限流
    - C 端 JWT/微信登录态
    - 后台 RBAC
    - Gateway/全局 Guard 限流与默认拒绝
    - _Requirements: 12.7_

  - [ ] 15.4 实现 traceId、结构化日志与敏感日志脱敏
    - 每请求贯穿 traceId
    - 支付凭据、健康作答、openid 等不进明文日志
    - _Requirements: 6.9, 12.1_

  - [ ] 15.5 实现关键服务降级与重试策略
    - 测评提交、支付、AI 生成出现瞬时故障时可重试或异步恢复
    - 不允许错误版本静默计算
    - _Requirements: 12.8_

- [ ] 16. 集成、E2E、性能与发布准备（全量验收）
  - [ ] 16.1 编写体质测评端到端测试
    - 首页进入体质测评 → 作答 → 提交 → 算法结果 → 基础报告
    - _Requirements: 1.1, 1.2, 3.1-3.7, 4.1-4.8, 5.1-5.4_

  - [ ] 16.2 编写痛症红旗征端到端测试
    - 首页进入痛症测评 → 命中红旗征 → 显著就医提示 + 非诊断声明 → 报告流程
    - _Requirements: 2.1-2.7, 5.1, 12.5_

  - [ ] 16.3 编写支付解锁端到端测试
    - 基础报告 → 创建订单 → 模拟微信回调 → 深度报告解锁 → 防重复付费
    - _Requirements: 5.3-5.5, 6.1-6.9_

  - [ ] 16.4 编写匿名归并与我的中心端到端测试
    - 匿名作答 → 微信登录 → 记录归并 → 我的中心可见历史报告和订单
    - _Requirements: 9.1-9.4_

  - [ ] 16.5 编写 AI 内容生成到发布端到端测试
    - 创建生成任务 → 多平台草稿 → 合规审核 → 人工审批 → 发布/导出
    - _Requirements: 7.1-7.12, 8.1-8.7, 12.9_

  - [ ] 16.6 编写配置快照集成测试
    - 管理后台发布新题库/算法版本
    - 进行中会话仍用旧版本，新会话使用新版本
    - _Requirements: 4.8, 11.3, 11.7_

  - [ ] 16.7 完成性能、安全与合规检查
    - H5 首屏 3 秒可交互验证
    - 支付回调防重放/验签测试
    - 敏感数据加密与日志脱敏扫描
    - 健康内容免责声明覆盖检查
    - _Requirements: 12.1-12.9_

  - [ ] 16.8 完成部署配置与运行手册
    - Docker/部署环境变量/数据库迁移/Redis/队列 Worker 启动说明
    - 生产密钥、证书、微信支付、LLM Provider 配置说明
    - _Requirements: 12.1, 12.4, 12.8_

- [ ] 17. Final Checkpoint - 全平台功能闭环验收
  - 全量运行 unit、property、integration、E2E、typecheck、lint、build
  - 对照 requirements.md R1-R12 逐项确认有实现、有测试、有运行证据
  - 确认 README、环境变量示例和部署手册与实际代码一致
  - 若存在未完成项，不得标记本 checkpoint 完成
