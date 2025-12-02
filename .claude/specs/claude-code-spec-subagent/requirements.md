# 需求文档

## 简介

本功能通过引入多个专门的 Claude Code subagent 来增强现有的 spec workflow 流程。这些 subagent 将替换 spec workflow 中的不同阶段（requirements、design、tasks），使每个阶段能够独立并行处理，提高效率和专业性。每个 subagent 都有自己的上下文窗口、专门的系统提示和工具权限，确保在各自领域内提供最优质的输出。

## 需求

### 需求 1：多 Subagent 架构设计

**用户故事：** 作为开发者，我希望使用专门的 subagent 来处理 spec workflow 的不同阶段，这样每个阶段都能获得专业的处理并支持并行工作。

#### 验收标准

1. WHEN 用户启动 spec workflow THEN 系统 SHALL 根据当前阶段自动调用相应的 subagent（spec-requirements、spec-design、spec-tasks）
2. WHEN 多个 spec 文档需要处理 THEN 不同的 subagent SHALL 能够并行工作而不相互干扰
3. IF subagent 之间需要共享信息 THEN 它们 SHALL 通过 spec 文档进行通信而不是直接交互
4. WHEN subagent 完成任务 THEN 主线程 SHALL 接收结果并决定下一步行动
5. IF 某个 subagent 失败 THEN 其他 subagent SHALL 继续工作且系统能够恢复

### 需求 2：Spec Requirements Subagent

**用户故事：** 作为开发者，我希望有一个专门的 requirements subagent 来生成和优化需求文档，确保需求的完整性和规范性。

#### 验收标准

1. WHEN 调用 spec-requirements subagent THEN 它 SHALL 专注于生成 EARS 格式的需求文档
2. WHEN 生成需求 THEN subagent SHALL 自动考虑边缘情况、用户体验和技术约束
3. IF 需求不明确 THEN subagent SHALL 主动提出澄清问题
4. WHEN 用户提供反馈 THEN subagent SHALL 迭代优化需求文档直到获得批准
5. IF 需要研究 THEN subagent SHALL 使用 WebSearch、Grep 等工具收集相关信息

### 需求 3：Spec Design Subagent

**用户故事：** 作为开发者，我希望有一个专门的 design subagent 来创建详细的技术设计文档，基于需求文档提供架构和实现方案。

#### 验收标准

1. WHEN 调用 spec-design subagent THEN 它 SHALL 首先读取需求文档作为输入
2. WHEN 创建设计 THEN subagent SHALL 包含所有必需部分（Overview、Architecture、Components、Data Models、Error Handling、Testing Strategy）
3. IF 发现技术约束 THEN subagent SHALL 在设计中明确说明并提供解决方案
4. WHEN 需要技术决策 THEN subagent SHALL 分析现有代码库并遵循项目约定
5. IF 设计过于复杂 THEN subagent SHALL 建议分阶段实施方案

### 需求 4：Spec Tasks Subagent

**用户故事：** 作为开发者，我希望有一个专门的 tasks subagent 来生成可执行的实施任务列表，确保每个任务都是具体和可操作的。

#### 验收标准

1. WHEN 调用 spec-tasks subagent THEN 它 SHALL 基于设计文档生成实施任务
2. WHEN 创建任务 THEN 每个任务 SHALL 是可由编码 agent 执行的具体代码任务
3. IF 任务有依赖关系 THEN subagent SHALL 确保任务顺序合理且增量构建
4. WHEN 引用需求 THEN 每个任务 SHALL 明确标注对应的需求编号
5. IF 任务过于复杂 THEN subagent SHALL 将其分解为更小的子任务

### 需求 5：Subagent 协调机制

**用户故事：** 作为开发者，我希望主 Claude Code 能够智能协调多个 subagent，确保 spec workflow 的流畅进行。

#### 验收标准

1. WHEN 用户请求创建 spec THEN 主线程 SHALL 自动识别需要调用的 subagent
2. IF 前置文档不存在 THEN 系统 SHALL 阻止后续 subagent 的调用
3. WHEN subagent 返回结果 THEN 主线程 SHALL 整合结果并向用户展示
4. IF 用户想要修改某个阶段 THEN 系统 SHALL 只调用相应的 subagent
5. WHEN 所有阶段完成 THEN 系统 SHALL 提供完整的 spec 文档集

### 需求 6：VSCode 插件 Agents 面板

**用户故事：** 作为开发者，我希望在 VSCode 插件面板中有一个专门的 Agents 视图来管理所有的 subagent，方便查看和编辑。

#### 验收标准

1. WHEN 插件加载 THEN Agents 视图 SHALL 显示在 Spec Explorer 下方
2. WHEN 打开 Agents 视图 THEN 它 SHALL 显示两类 agents：项目级（.claude/agents/）、用户级（~/.claude/agents/）
3. IF 用户点击某个 agent THEN 系统 SHALL 在编辑器中打开对应的 .md 文件
4. WHEN 用户修改 agent 文件 THEN 系统 SHALL 在屏幕中央显示确认弹框

### 需求 7：内置 Spec Subagents 初始化

**用户故事：** 作为开发者，我希望插件能够提供预配置的 spec subagent 模板，让我能快速开始使用。

#### 验收标准

1. WHEN 插件首次安装或项目初始化 THEN 系统 SHALL 复制内置的 spec subagent 模板到项目 .claude/agents/ 目录
2. WHEN 复制内置 agents THEN 系统 SHALL 包含：spec-requirements、spec-design、spec-tasks 三个基础 agent
3. IF .claude/agents/ 目录已存在同名文件 THEN 系统 SHALL 跳过该文件避免覆盖
4. WHEN 内置 agent 模板更新 THEN 用户 SHALL 可以选择更新到最新版本
5. IF 用户删除了内置 agent THEN 系统 SHALL 提供恢复选项

### 需求 8：Spec Explorer 增强

**用户故事：** 作为开发者，我希望在 Spec Explorer 面板有一个按钮来启动使用新 subagent 的 spec 流程，这样我有多个入口可以选择。

#### 验收标准

1. WHEN Spec Explorer 面板加载 THEN 它 SHALL 在面板顶部显示一个新按钮（如 "New Spec with Agents"）
2. WHEN 用户点击该按钮 THEN 系统 SHALL 启动使用 subagent 的 spec 创建流程
3. IF 用户使用新按钮 THEN prompt SHALL 包含特定标识以触发 subagent 工作流
4. WHEN 新流程启动 THEN spec-system-prompt-loader SHALL 被自动调用加载 workflow
5. IF subagent 流程启动成功 THEN 用户 SHALL 看到与原有流程略有不同的交互体验