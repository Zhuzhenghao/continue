# IntelliJ 插件开发指南

## 1. 环境要求

### 必需的软件

- **Java 17** - 从 [Oracle](https://www.oracle.com/java/technologies/javase/jdk17-archive-downloads.html) 下载
- **IntelliJ IDEA** - 推荐使用 IntelliJ IDEA Ultimate 或 Community Edition
  - 下载地址: [JetBrains 官网](https://www.jetbrains.com/idea/download)
  - Community Edition 免费，但 Ultimate 版本调试功能更强大
- **Node.js 20.19.0 (LTS) 或更高版本**
  - 从 [nodejs.org](https://nodejs.org/en/download) 下载
  - 或使用 NVM: 在项目根目录运行 `nvm use`
- **Gradle** - 项目已包含 Gradle Wrapper，无需单独安装

### IDE 配置

- 启用保存时格式化代码: `Settings | Tools | Actions on Save | Reformat code`
- 确保已安装 Gradle 插件

### 推荐插件

- [Thread Access Info](https://plugins.jetbrains.com/plugin/16815-thread-access-info) - 显示线程访问违规
- [File Expander](https://plugins.jetbrains.com/plugin/11940-file-expander) - 预览归档文件

## 2. 初始设置

### 安装所有依赖

**Unix/macOS:**

```bash
./scripts/install-dependencies.sh
```

**Windows:**

```powershell
.\scripts\install-dependencies.ps1
```

### 构建依赖项

如果需要从头构建所有依赖：

```bash
# 1. 构建 packages
node ./scripts/build-packages.js

# 2. 安装 core 依赖
cd core && npm ci && cd ..

# 3. 构建 GUI
cd gui && npm ci && npm run build && cd ..

# 4. 运行 prepackage 脚本 (VS Code 扩展需要)
cd extensions/vscode && npm ci && npm run prepackage && cd ../..

# 5. 构建 binary
cd binary && npm ci && npm run build && cd ..
```

## 3. 在 IntelliJ IDEA 中运行插件

### 方法一：使用运行配置（推荐）

1. **打开项目**

   - 在 IntelliJ IDEA 中打开项目根目录

2. **选择运行配置**

   - 在右上角的运行配置下拉菜单中选择 `Run Continue`
   - 如果使用 Community Edition，选择 `Run Continue (CE)`

3. **运行/调试**

   - 点击 **运行** (绿色三角形) 或 **调试** (虫子图标)
   - 这会自动启动以下服务：
     - GUI 开发服务器 (http://localhost:5173)
     - Core 开发服务器
     - IDE 日志监控
     - Prompt 日志监控
     - 插件实例

4. **等待沙箱环境启动**

   - `runIde` 任务会下载并启动 IntelliJ IDEA Community Edition (如果还未下载)
   - **第一次运行可能需要几分钟时间**下载 IDE
   - 完成后会自动打开一个新的 IntelliJ IDEA 窗口（沙箱环境）
   - 新窗口的标题栏会显示 "IntelliJ IDEA Community Edition" 或类似内容

5. **测试插件**
   - 在新打开的 IntelliJ IDEA 实例中测试插件功能
   - 插件已自动安装并启用
   - 项目会自动打开 `manual-testing-sandbox` 目录

**⚠️ 重要提示：**

- 如果新窗口没有自动打开，请检查运行窗口的输出日志
- 确保没有其他 IntelliJ IDEA 实例正在运行（可能会干扰）
- 如果任务执行成功但没有新窗口，尝试在终端中直接运行（见方法二）

### 方法二：使用 Gradle 任务（终端运行）

如果运行配置没有打开新窗口，可以尝试在终端中运行：

```bash
cd extensions/intellij

# 运行插件（开发模式）
./gradlew runIde

# Windows
gradlew.bat runIde
```

**优点：**

- 可以看到完整的构建和启动日志
- 更容易发现错误信息
- 确保任务正确执行

**注意事项：**

- 终端会显示详细的日志输出
- 新窗口应该会自动打开
- 不要关闭终端，否则插件实例也会关闭

### 方法三：分步运行（推荐用于调试）

如果需要更精确地控制各个组件：

1. **启动 GUI 开发服务器**

   - 运行配置: `Start GUI Dev Server`
   - 或手动: `cd gui && npm run dev`
   - 等待看到 "Local: http://localhost:5173" 的输出

2. **启动 Core 开发服务器**

   - 运行配置: `Start Core Dev Server` (Ultimate) 或 `Start Core Dev Server (CE)` (Community)
   - 或手动: `cd binary && npm run dev`
   - 等待看到服务器启动成功的消息

3. **运行插件**
   - 运行配置: `Run Extension (use TCP)`
   - 或使用 Gradle: `cd extensions/intellij && ./gradlew runIde`
   - 应该会打开新的 IntelliJ IDEA 窗口

## 4. 开发工作流

### 查看日志

- **IDE 日志**: 运行配置 `IDE Logs` 会自动显示日志
- **Prompt 日志**: 运行配置 `Prompt Logs` 会自动显示日志
- **手动查看日志**:
  - IDE 日志位置: `Help | Show Log in Files`
  - 或查看: `build/idea-sandbox/system/log/`

### 启用调试日志

1. 在运行的插件实例中: `Help | Diagnostic Tools | Debug Log Settings...`
2. 添加: `com.intellij.diagnostic:debug`
3. 更多信息: [官方文档](https://youtrack.jetbrains.com/articles/SUPPORT-A-43/How-to-enable-debug-logging-in-IntelliJ-IDEA)

### 重新加载更改

- **插件代码 (Kotlin)**:
  - 尝试: `Run | Debugging Actions | Reload Changed Classes`
  - 如果失败（新导入、架构变更等），需要停止并重启插件
- **GUI 代码**: 自动热重载
- **Core 代码**:
  - 运行: `cd binary && npm run build -- --os [darwin | linux | win32]`
  - 重启 `Start Core Dev Server` 任务

### 设置断点

- **插件代码**: 直接在 IntelliJ IDEA 中设置断点
- **GUI 代码**: 使用浏览器开发者工具或代码中的 `debugger` 语句
- **Core 代码**:
  - Ultimate 版本: 在 IntelliJ IDEA 中设置断点
  - Community 版本: 需要在 VS Code 中运行 "Core Binary" 任务并设置断点

### 访问开发配置文件

开发时，Continue 配置文件位于: `extensions/.continue-debug`

这允许你在不影响实际配置的情况下测试配置更改。

## 5. 测试

### 运行单元测试

```bash
cd extensions/intellij
./gradlew test
```

### 运行集成测试 (e2e)

```bash
cd extensions/intellij
./gradlew testIntegration
```

**注意**:

- e2e 测试首次运行需要下载 IDE，可能需要较长时间
- 测试执行时会完全控制你的鼠标
- macOS 用户需要在 `System Settings > Privacy & Security > Accessibility` 中给 IntelliJ 权限

## 6. 打包插件

### 构建插件 ZIP 文件

```bash
cd extensions/intellij
./gradlew buildPlugin
```

生成的 ZIP 文件位置: `build/distributions/continue-intellij-extension-*.zip`

### 安装打包的插件

1. 打开 IntelliJ IDEA
2. 进入 `Settings | Plugins`
3. 点击齿轮图标
4. 选择 `Install Plugin from Disk...`
5. 选择生成的 ZIP 文件

## 7. 可用的 Gradle 任务

查看所有可用任务:

```bash
cd extensions/intellij
./gradlew tasks
```

常用任务:

- `build` - 构建和测试项目
- `clean` - 删除 build 目录
- `runIde` - 运行带插件的 IDE 实例
- `buildPlugin` - 构建插件 ZIP 文件
- `verifyPluginConfiguration` - 验证插件配置
- `test` - 运行单元测试
- `testIntegration` - 运行集成测试

## 8. 常见问题

### 沙箱环境没有打开新窗口

**问题：** 运行 `runIde` 任务后，没有打开新的 IntelliJ IDEA 窗口。

**解决方案：**

1. **检查任务是否成功执行**

   ```bash
   cd extensions/intellij
   ./gradlew runIde --info
   ```

   - 查看是否有错误信息
   - 确保任务执行完成（不是被中断）

2. **检查是否已经下载 IDE**

   - 首次运行需要下载 IntelliJ IDEA Community Edition
   - 检查 `build/idea-sandbox/` 目录
   - 如果目录为空或不存在，任务会自动下载

3. **检查是否有其他实例运行**

   - 关闭所有正在运行的 IntelliJ IDEA 实例
   - 某些情况下，已有的实例可能会阻止新窗口打开

4. **在终端中运行**

   - 在终端中运行 `./gradlew runIde` 而不是通过运行配置
   - 这样可以 see 完整的输出日志
   - 新窗口应该会自动打开

5. **检查系统权限（macOS）**

   - macOS 可能需要授予 IntelliJ IDEA 辅助功能权限
   - `System Settings > Privacy & Security > Accessibility`

6. **清理并重新构建**

   ```bash
   cd extensions/intellij
   ./gradlew clean
   ./gradlew runIde
   ```

7. **检查日志**

   - 查看 `build/idea-sandbox/system/log/` 目录中的日志文件
   - 可能包含错误信息

8. **手动检查沙箱目录**
   ```bash
   ls -la extensions/intellij/build/idea-sandbox/
   ```
   - 应该看到类似 `IC-2024.1` 的目录
   - 如果目录存在，说明 IDE 已下载

### Community Edition 限制

- 使用 `Run Continue (CE)` 运行配置
- Core 调试需要在 VS Code 中运行 "Core Binary" 任务
- 某些调试功能可能不可用

### 端口冲突

- GUI 开发服务器默认使用: `http://localhost:5173`
- 如果端口被占用，修改 `gui/vite.config.ts` 或停止占用端口的进程

### 构建错误

- 确保所有依赖已安装: `./scripts/install-dependencies.sh`
- 清理构建: `./gradlew clean`
- 重新构建: 按照步骤 2 重新构建所有依赖

### runIde 任务执行但没有效果

**可能的原因：**

1. IDE 下载失败 - 检查网络连接
2. Java 版本不匹配 - 确保使用 Java 17
3. 权限问题 - 确保有写入 `build/` 目录的权限

**解决步骤：**

```bash
# 1. 清理构建
cd extensions/intellij
./gradlew clean

# 2. 检查 Java 版本
java -version  # 应该显示 Java 17

# 3. 重新运行
./gradlew runIde --stacktrace
```

## 9. 架构说明

- 插件与 VS Code 扩展共享 `core` 目录中的代码
- 代码被打包到 `binary` 目录中的二进制文件
- 通信通过 stdin/stdout 进行
- GUI 通过 WebView 显示，从开发服务器加载

## 10. 更多资源

- [CONTRIBUTING.md](extensions/intellij/CONTRIBUTING.md) - 详细的贡献指南
- [IntelliJ Platform Plugin Template](https://github.com/JetBrains/intellij-platform-plugin-template) - 官方插件模板
- [IntelliJ Platform SDK 文档](https://plugins.jetbrains.com/docs/intellij/welcome.html)
- [JetBrains Platform Explorer](https://plugins.jetbrains.com/intellij-platform-explorer) - 插件扩展点探索工具
