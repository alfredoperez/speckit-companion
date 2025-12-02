# 实施计划

- [ ] 1. 设置核心权限检测组件
  - 在 `src/features/permission/` 中创建权限相关文件的目录结构
  - 定义 ConfigReader、PermissionCache 和 PermissionManager 的接口
  - _需求: 1.1, 1.2_

- [ ] 2. 实现配置文件访问的 ConfigReader
  - [ ] 2.1 创建具有文件读取功能的 ConfigReader 类
    - 实现 `getBypassPermissionStatus()` 方法读取 `~/.claude.json`
    - 优雅地处理文件未找到和 JSON 解析错误
    - _需求: 1.2, 1.4, 5.1_
  
  - [ ] 2.2 实现配置更新功能
    - 创建 `setBypassPermission(value: boolean)` 方法
    - 更新时保留现有配置字段
    - 实现原子文件写入操作
    - _需求: 2.5, 5.1, 6.3_
  
  - [ ] 2.3 添加文件监控功能
    - 使用 fs.watchFile 实现 `watchConfigFile(callback)`
    - 创建 `dispose()` 方法进行清理
    - 为文件操作编写单元测试
    - _需求: 1.1, 5.6_

- [ ] 3. 构建带有事件系统的 PermissionCache
  - [ ] 3.1 创建继承 EventEmitter 的 PermissionCache 类
    - 实现缓存存储和检索方法
    - 添加带有 `refreshAndGet()` 回退的 `get()` 方法
    - _需求: 1.1, 4.6_
  
  - [ ] 3.2 实现缓存刷新和事件触发
    - 创建 `refreshAndGet()` 方法更新缓存
    - 当权限从 false 变为 true 时触发事件
    - 为缓存行为编写单元测试
    - _需求: 2.1, 2.6_

- [ ] 4. 开发 PermissionManager 核心功能
  - [ ] 4.1 创建带有初始化的 PermissionManager
    - 设置 ConfigReader 和 PermissionCache 实例
    - 实现 `initializePermissions()` 方法
    - 添加初始化失败的错误处理
    - _需求: 1.1, 1.5, 5.2_
  
  - [ ] 4.2 实现权限检查和监控
    - 使用缓存创建 `checkPermission()` 方法
    - 实现文件监视的 `startMonitoring()`
    - 处理权限状态转换
    - _需求: 1.4, 2.1, 4.1_

- [ ] 5. 增强权限流程的 UI 组件
  - [ ] 5.1 更新 PermissionWebview 以集成管理器
    - 修改 `createOrShow()` 接受可选的 permissionManager
    - 使用管理器回调处理 'accept' 消息
    - 保持向后兼容性
    - _需求: 4.3, 4.7_
  
  - [ ] 5.2 实现权限设置 UI 流程
    - 在 PermissionManager 中创建 `showPermissionSetup()`
    - 实现 `grantPermission()` 方法
    - 添加权限授予时的自动关闭
    - _需求: 2.2, 2.3, 2.5, 4.4_
  
  - [ ] 5.3 添加权限命令的终端创建
    - 创建 `ClaudeCodeProvider.createPermissionTerminal()` 静态方法
    - 配置适当的终端设置
    - _需求: 3.2, 4.3_

- [ ] 6. 集成到扩展生命周期
  - [ ] 6.1 重构 extension.ts 激活
    - 在激活时创建 PermissionManager 实例
    - 为权限失败实现重试逻辑
    - 移除遗留的权限代码
    - _需求: 3.1, 3.3, 3.6_
  
  - [ ] 6.2 更新命令执行流程
    - 修改 `invokeClaudeSplitView()` 以检查权限
    - 更新 `invokeClaudeHeadless()` 的权限检查
    - 移除 globalState 权限逻辑
    - _需求: 2.1, 2.4_

- [ ] 7. 添加全面的测试
  - [ ] 7.1 为核心组件编写单元测试
    - 测试 ConfigReader 文件操作
    - 测试 PermissionCache 事件系统
    - 测试 PermissionManager 状态管理
    - _需求: 5.3, 5.6_
  
  - [ ] 7.2 创建集成测试
    - 端到端测试完整的权限流程
    - 测试失败场景的重试机制
    - 验证自动关闭功能
    - _需求: 3.4, 3.7, 4.5_

- [ ] 8. 实现安全和错误处理
  - [ ] 8.1 添加安全存储和验证
    - 实现安全的配置存储
    - 验证所有 Claude Code 响应
    - 防止在日志中暴露敏感数据
    - _需求: 6.1, 6.3, 6.5_
  
  - [ ] 8.2 增强错误处理和日志记录
    - 添加带上下文的全面错误日志
    - 实现优雅降级
    - 创建用户友好的错误消息
    - _需求: 5.1, 5.2, 5.5_

- [ ] 9. 优化性能和清理
  - [ ] 9.1 性能优化
    - 实现高效的缓存策略
    - 优化文件监视性能
    - 确保权限检查在 10ms 以内
    - _需求: 4.1, 4.6_
  
  - [ ] 9.2 代码清理和文档
    - 移除所有遗留的权限代码
    - 更新代码注释和文档
    - 清理未使用的导入和常量
    - _需求: 实施最佳实践_
