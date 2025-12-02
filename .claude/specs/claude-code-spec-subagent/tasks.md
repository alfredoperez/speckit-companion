# 实施任务

## 1. 创建 Agent Manager 核心功能

- [x] 1.1 创建 AgentManager 类
  - 在 `src/features/agents/` 目录下创建 `agentManager.ts`
  - 实现 `AgentManager` 接口，包含初始化、获取列表、检查存在等方法
  - _需求: 1.1, 5.1_

- [x] 1.2 实现内置 agents 初始化逻辑
  - 实现 `initializeBuiltInAgents()` 方法
  - 从 `src/resources/agents/` 复制内置 agents 到 `.claude/agents/kfc/`
  - 处理文件已存在的情况（跳过复制）
  - _需求: 7.1, 7.2, 7.3_

- [x] 1.3 实现 agent 列表获取功能
  - 实现 `getAgentList()` 方法，支持获取项目级和用户级 agents
  - 解析 agent 文件的 YAML frontmatter 获取元数据
  - 返回 `AgentInfo` 数组
  - _需求: 6.2_

- [x] 1.4 添加 agent 路径管理功能
  - 实现 `getAgentPath()` 方法
  - 实现 `checkAgentExists()` 方法
  - 处理项目级和用户级 agents 的路径解析
  - _需求: 6.2_

## 2. 创建 Agents Explorer Provider

- [x] 2.1 创建 AgentsExplorerProvider 类
  - 在 `src/providers/` 目录下创建 `agentsExplorerProvider.ts`
  - 继承 `vscode.TreeDataProvider<AgentItem>`
  - 注入 `AgentManager` 依赖
  - _需求: 6.1, 6.2_

- [x] 2.2 实现树形结构展示
  - 实现 `getChildren()` 方法，分组显示项目级和用户级 agents
  - 为每个 agent 创建 `AgentItem` 树节点
  - 设置合适的图标和提示信息
  - _需求: 6.2_

- [x] 2.3 实现 agent 文件打开功能
  - 实现点击 agent 打开对应 .md 文件的功能
  - 在 `AgentItem` 中添加打开文件的命令
  - _需求: 6.3_

- [x] 2.4 实现视图刷新机制
  - 实现 `refresh()` 方法
  - 监听 `.claude/agents/` 目录变化并自动刷新
  - _需求: 6.1_

## 3. 集成到 VSCode 扩展

- [x] 3.1 在 extension.ts 中初始化 Agent Manager
  - 在 `activate()` 函数中创建 `AgentManager` 实例
  - 调用 `initializeBuiltInAgents()` 进行初始化
  - _需求: 7.1_

- [x] 3.2 注册 Agents Explorer Provider
  - 创建 `AgentsExplorerProvider` 实例
  - 使用 `vscode.window.registerTreeDataProvider()` 注册
  - 添加到 `context.subscriptions`
  - _需求: 6.1_

- [x] 3.3 更新 package.json 配置
  - 在 `contributes.views` 中添加 `agentsExplorer` 视图配置
  - 将视图放置在 `kfc-sidebar` 容器的 Spec Explorer 下方
  - 配置视图标题和图标
  - _需求: 6.1_

- [x] 3.4 在 Spec Explorer 添加新按钮
  - 在 package.json 中定义 `kfc.spec.createWithAgents` 命令
  - 在 `view/title` 中添加按钮配置，显示在 Spec Explorer 顶部
  - 设置合适的图标和提示文本
  - _需求: 8.1_

- [x] 3.5 实现新的 spec 创建流程
  - 在 SpecManager 中添加 `createWithAgents()` 方法
  - 在 prompt 中添加特定标识触发 subagent 工作流
  - 确保调用 spec-system-prompt-loader 加载 workflow
  - _需求: 8.2, 8.3, 8.4_

## 4. 实现文件编辑确认功能

- [x] 4.1 添加文件保存前的确认弹框
  - 监听 agent 文件的保存事件
  - 在屏幕中央显示确认对话框
  - 确认则允许保存，取消则阻止保存
  - _需求: 6.4_

## 5. 添加文件监视功能

- [x] 5.1 设置文件系统监视器
  - 监视 `.claude/agents/` 目录的变化以自动刷新 Agents Explorer
  - 监视 `~/.claude/agents/` 目录的变化
  - _需求: 6.2_

## 6. 复制 system prompt 文件

- [x] 6.1 在初始化时复制 spec-workflow-starter.md（copy if not exist）
  - 从 `src/resources/system-prompts/` 复制到 `.claude/system-prompts/`
  - 确保目录存在，不存在则创建
  - 如果文件已存在则跳过
  - _需求: 2.2_

## 7. 添加命令和上下文菜单

- [x] 7.1 添加刷新 agents 命令
  - 在 package.json 中定义 `kfc.agents.refresh` 命令
  - 在 extension.ts 中注册命令处理器
  - _需求: 6.2_

## 8. 错误处理和日志

- [x] 8.1 添加错误处理
  - 为所有文件操作添加 try-catch 块
  - 处理权限不足、磁盘空间等错误
  - 在输出通道记录错误信息
  - _需求: 7.1_

- [x] 8.2 添加操作日志
  - 记录 agent 初始化过程
  - 记录文件复制和恢复操作
  - 使用 outputChannel 输出调试信息
  - _需求: 1.1_

## 9. 测试验证

- [x] 9.1 编写单元测试
  - 测试 AgentManager 的各个方法
  - 测试 AgentsExplorerProvider 的树形结构生成
  - 模拟文件系统操作
  - _需求: 1.1, 6.2_

- [ ] 9.2 进行集成测试
  - 测试完整的初始化流程
  - 测试文件监视和恢复功能
  - 测试 UI 交互和命令执行
  - _需求: 7.1, 6.3_

- [ ] 9.3 验收测试
  - 验证 agents 在 Spec Explorer 下方显示
  - 验证点击可以打开文件编辑
  - 验证编辑确认弹框功能
  - 验证内置 agents 的自动复制（每次启动检查缺失并复制）
  - 验证 Spec Explorer 新按钮功能和 subagent 流程
  - _需求: 6.1, 6.3, 6.4, 7.1, 8.1, 8.2_