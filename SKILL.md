---
name: project-nav
version: 1.0.0
description: "通用型项目代码导航缓存 Skill。当 AI 需要定位代码文件、查找页面/组件/接口位置、理解项目结构时使用。采用 Bootstrap → Cache 架构，首次通过脚本自动生成索引缓存，后续读缓存即可精准定位，节省 90%+ token。支持前端/后端(Java/Python/Go 等)/全栈/任意项目。"
metadata:
  requires:
    bins: ["node"]
---

# 项目代码导航 (project-nav)

> **前置条件：** 确保已安装 Node.js（v16+）

## 核心原理

```
用户提出开发任务
       │
       ▼
┌──────────────────┐     缓存存在？    ┌─────────────────────┐
│  检查缓存文件      │─────────────────▶│ 读取缓存             │
│  profiles/        │                  │ 直接返回匹配结果     │
└────────┬──────────┘                  └──────────┬──────────┘
         │ 不存在/过期                            │ 命中
         ▼                                       ▼
┌──────────────────┐                  ┌─────────────────────┐
│ 运行扫描脚本       │                  │ AI 直接进入开发      │
│ node index.js     │                  │ 无需反复搜索文件    │
│ --project <路径>  │                  └─────────────────────┘
└────────┬──────────┘
         │
         ▼
┌──────────────────┐
│ 自动生成缓存文件   │
│ 供后续任务复用     │
└──────────────────┘
```

## 快速开始

### Step 1: 生成（或刷新）项目缓存

```bash
# 自动检测项目类型并生成缓存
node {SKILL_HOME}/project-nav/scripts/index.js --project <项目根目录路径>

# 示例（Windows 绝对路径）
node C:/Users/EDY/.agents/skills/project-nav/scripts/index.js --project D:/www/gadsj-front/apps/sub-police

# 强制覆盖已有缓存
node ... --project <路径> --force

# 手动指定项目类型（跳过自动检测）
node ... --project <路径> --type frontend|backend-java|backend-python|backend-go|fullstack
```

### Step 2: 使用缓存

缓存生成后，AI 可直接读取 `profiles/{project-name}.md` 获取：
- **路由表**：routeName → 文件路径映射
- **页面目录**：各业务模块的组件清单
- **公共组件**：可复用 UI 组件列表
- **API 层**：请求封装和接口调用模式
- **工具函数**：公共模块及功能说明
- （后端项目还有 Controller/Service/Mapper/Entity 等分层信息）

## 命令参考

| 参数 | 说明 | 示例 |
|------|------|------|
| `--project` | 项目根目录（必填） | `--project D:/www/my-project` |
| `--output` | 输出文件路径（可选，默认 profiles/ 下） | `--output ./my-cache.md` |
| `--type` | 强制指定项目类型（可选） | `--type backend-java` |
| `--update` | 仅更新指定分区（可选） | `--update routes` |
| `--list` | 列出已有缓存文件 | `--list` |
| `--force` | 强制覆盖已有缓存 | `--force` |
| `--help` | 显示帮助信息 | `--help` |

## 支持的项目类型

| 类型 | 检测依据 | 缓存分区 |
|------|---------|---------|
| 前端项目 | package.json（无后端特征） | 路由表 / 页面目录 / 公共组件 / 状态管理 / 请求层 / 工具函数 / 样式资源 / 配置项 |
| Java 后端 | pom.xml / build.gradle | Controller / Service / Mapper / Entity / DTO / Config / Middleware / Utils / Exception |
| Python 后端 | requirements.txt / pyproject.toml | Router / Service / Models / Schema / Config / Middleware / Utils / Exception |
| Go 后端 | go.mod | Handler / Service / Repository / Model / DTO / Config / Middleware / Utils / Error |
| Node.js 后端 | package.json + server 入口 | Routes / Controller / Service / Model / DTO / Config / Middleware / Utils / Filter |
| PHP 后端 | composer.json（无 package.json） | Controller / Service / Model / DTO / Config / Middleware / Utils / Exception |
| 全栈项目 | 前后端特征同时存在 | = 前端全部分区 + 后端全部分区 + 关联映射 |

## AI 使用指南

### 触发时机
以下场景自动触发本 Skill：
- 新增/编辑/删除 页面、组件、接口、功能模块
- 用户询问"XX 在哪"、"找 XX 代码"、"XX 文件位置"
- 项目结构发生重大变更后需要重建索引

### 典型工作流

#### 工作流 A：新增功能（前端示例）
```
输入："帮我新增一个 XX 管理页面"

AI 执行：
  1. 检查 profiles/ 下是否有当前项目的 .md 缓存
  2. 如无缓存 → 运行 node scripts/index.js --project <项目路径>
  3. 读取缓存的「路由表」区确认命名空间
  4. 读取缓存的「页面目录」区找到同类模块作为参考
  5. 读取缓存的「公共组件」区推荐可复用组件
  6. 输出：目标路径 + 路由注册方式 + 可复用组件清单
```

#### 工作流 B：修改功能（后端 Java 示例）
```
输入："给用户模块加个批量导入接口"

AI 执行：
  1. 读取缓存（如无则先生成）
  2. 从「Controller 区」定位 UserController.java
  3. 从「Service 区」定位 UserService.java
  4. 从「Mapper 区」定位 UserMapper.java
  5. 从「Entity 区」查看字段定义
  6. 从「Utils 区」检查是否有 ExcelUtil 可复用
  7. 输出：需修改的完整文件链路 + 参考代码位置
```

#### 工作流 C：前后端联调（全栈示例）
```
输入："案件模块加导出功能，前端要按钮后端要接口"

AI 执行：
  1. 读取全栈缓存（含前后端 + 关联映射）
  2. [前端] 从页面目录定位 case/ 模块
  3. [前端] 从公共组件找到 exportButton
  4. [后端] 从 Controller 定位 CaseController
  5. [后端] 从 Service 定位 CaseService
  6. [关联] 确认前后端接口对接关系
  7. 分别输出前端改动点和后端改动点
```

### Token 节省效果

| 场景 | 无 Skill | 有 project-nav | 节省率 |
|------|---------|---------------|--------|
| 首次（需 Bootstrap） | ~8000 tokens | ~50 tokens（跑命令）+ ~500 tokens（读缓存） | **94%** |
| 后续每次任务 | ~5000 tokens | ~500 tokens（直接读缓存） | **90%** |

## 注意事项

1. **纯静态分析**：脚本不执行项目代码、不安装依赖、不启动编译器，仅做文件扫描
2. **缓存非实时**：项目结构变更后需手动运行 `--force` 刷新缓存
3. **路径格式**：Windows 路径建议使用正斜杠 `/` 或反斜杠转义
4. **多应用支持**：monorepo 项目可对每个子应用分别生成缓存