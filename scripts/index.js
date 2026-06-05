#!/usr/bin/env node

/**
 * project-nav 项目代码导航缓存生成器
 *
 * 用法:
 *   node index.js --project <项目根目录> [options]
 *
 * 选项:
 *   --project, -p    项目根目录（必填）
 *   --output, -o     输出文件路径（默认: ./PROJECT_NAV.md）
 *   --type, -t       强制指定项目类型 (frontend/backend-java/backend-python/backend-go/fullstack)
 *   --update, -u     增量更新模式 (full/partial)
 *   --list, -l       仅列出检测到的项目信息，不生成文件
 *   --force, -f      强制覆盖已存在的输出文件
 *   --help, -h       显示帮助信息
 *
 * 示例:
 *   node index.js --project ./my-vue-app
 *   node index.js --project /path/to/project --output ./nav.md
 *   node index.js --project ./backend --type backend-java --force
 */

const fs = require('fs');
const path = require('path');
const { detect, PROJECT_TYPES } = require('./lib/detector');
const { scanFrontend } = require('./lib/scanner-frontend');
const { scanJava } = require('./lib/scanner-backend-java');
const { scanPython } = require('./lib/scanner-backend-python');
const { scanGo } = require('./lib/scanner-backend-go');
const { scanFullstack } = require('./lib/scanner-fullstack');
const { scanGeneric } = require('./lib/scanner-generic');
const { generateMarkdown, writeToFile } = require('./lib/generator');

/**
 * CLI 参数解析器
 * @param {string[]} argv - process.argv 数组
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(argv) {
  const args = {
    project: null,
    output: null,
    type: null,
    update: null,
    list: false,
    force: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--project':
      case '-p':
        args.project = argv[++i];
        break;
      case '--output':
      case '-o':
        args.output = argv[++i];
        break;
      case '--type':
      case '-t':
        args.type = argv[++i];
        break;
      case '--update':
      case '-u':
        args.update = argv[++i];
        break;
      case '--list':
      case '-l':
        args.list = true;
        break;
      case '--force':
      case '-f':
        args.force = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        // 忽略未知参数
        break;
    }
  }

  return args;
}

/**
 * 显示帮助信息
 * @param {boolean} isHelpRequest - 是否为主动请求帮助
 */
function showHelp(isHelpRequest = true) {
  const helpText = `
╔═══════════════════════════════════════════════════════════╗
║          🗺️  Project Nav - 项目代码导航生成器               ║
╚═══════════════════════════════════════════════════════════╝

用法:
  node index.js --project <项目路径> [选项]

必填参数:
  --project, -p    项目根目录绝对或相对路径

可选参数:
  --output, -o     输出 Markdown 文件路径 (默认: ./PROJECT_NAV.md)
  --type, -t       强制指定项目类型:
                   frontend | backend-java | backend-python |
                   backend-go | fullstack
  --update, -u     更新模式: full (完全重新扫描) | partial (增量)
  --list, -l       仅显示检测结果，不生成文件
  --force, -f      强制覆盖已有文件
  --help, -h       显示此帮助信息

示例:
  # 扫描前端项目
  node index.js -p ./my-vue-app

  # 扫描后端项目并指定类型
  node index.js -p ./java-backend -t backend-java

  # 全栈项目扫描
  node index.js -p ./fullstack-app -t fullstack

  # 自定义输出路径
  node index.js -p ./project -o ./docs/NAV.md -f

支持的自动检测类型:
  ✅ 前端 (Vue/React/Angular/Svelte)
  ✅ Java 后端 (Spring Boot)
  ✅ Python 后端 (Django/FastAPI/Flask)
  ✅ Go 后端 (Gin/Echo)
  ✅ Node.js 后端
  ✅ 全栈项目 (前端 + 后端)
  ⚠️  未知类型 (降级为目录结构扫描)

输出格式:
  📄 标准 Markdown 文件，包含:
     - 项目元信息和技术栈
     - 路由表和页面映射
     - 组件/API/工具函数索引
     - 后端分层架构（如适用）
     - 前后端关联映射（全栈项目）
`;

  console.log(helpText);
}

/**
 * 验证项目目录是否存在且可访问
 * @param {string} projectPath - 项目路径
 * @returns {string|null} 解析后的绝对路径，无效返回 null
 */
function validateProjectPath(projectPath) {
  if (!projectPath) {
    console.error('❌ 错误: 未指定项目路径。使用 --project <路径> 指定项目目录。');
    console.error('   运行 node index.js --help 查看详细用法。');
    return null;
  }

  // 解析为绝对路径
  const absolutePath = path.resolve(projectPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ 错误: 项目目录不存在: ${absolutePath}`);
    return null;
  }

  if (!fs.statSync(absolutePath).isDirectory()) {
    console.error(`❌ 错误: 指定路径不是目录: ${absolutePath}`);
    return null;
  }

  // 检查读取权限
  try {
    fs.accessSync(absolutePath, fs.constants.R_OK);
  } catch (error) {
    console.error(`❌ 错误: 无权限读取目录: ${absolutePath}`);
    return null;
  }

  return absolutePath;
}

/**
 * 获取默认输出路径
 * @param {string} projectRoot - 项目根目录
 * @returns {string} 输出文件路径
 */
function getDefaultOutputPath(projectRoot) {
  return path.join(projectRoot, 'PROJECT_NAV.md');
}

/**
 * 主流程：检测 → 扫描 → 生成 → 输出
 */
async function main() {
  const startTime = Date.now();

  // 1. 解析 CLI 参数
  const args = parseArgs(process.argv);

  // 2. 显示帮助或验证必填参数
  if (args.help || !args.project) {
    showHelp(args.help);
    if (!args.project && !args.help) {
      process.exit(1);
    }
    return;
  }

  // 3. 验证项目路径
  const projectRoot = validateProjectPath(args.project);
  if (!projectRoot) {
    process.exit(1);
    return;
  }

  // 4. 确定输出路径
  const outputPath = args.output ? path.resolve(args.output) : getDefaultOutputPath(projectRoot);

  // 5. 检查输出文件是否已存在（非强制模式）
  if (!args.force && fs.existsSync(outputPath)) {
    console.warn(`⚠️  输出文件已存在: ${outputPath}`);
    console.warn('   使用 --force (-f) 参数覆盖，或指定其他输出路径。');
    process.exit(1);
    return;
  }

  // 显示开始信息
  console.log('');
  console.log('🚀 开始扫描项目...');
  console.log(`   📂 项目路径: ${projectRoot}`);
  console.log(`   📄 输出文件: ${outputPath}`);
  console.log('');

  try {
    // 6. 检测项目类型
    let projectType;
    let techStack = [];

    if (args.type) {
      // 用户手动指定类型
      projectType = args.type;
      console.log(`🔍 使用指定的项目类型: ${formatTypeDisplay(projectType)}`);
    } else {
      // 自动检测
      console.log('🔍 正在检测项目类型...');
      const detectionResult = detect(projectRoot);
      projectType = detectionResult.type;
      techStack = detectionResult.techStack;

      console.log(`   ✅ 检测到类型: ${formatTypeDisplay(projectType)}`);
      if (techStack.length > 0) {
        console.log(`   🏷️  技术栈: ${techStack.join(', ')}`);
      }
    }

    console.log('');

    // 7. 根据类型选择扫描器并执行扫描
    let scanResult;

    switch (projectType) {
      case PROJECT_TYPES.FRONTEND:
        console.log('📡 扫描前端项目...');
        scanResult = await scanFrontend(projectRoot);
        break;

      case PROJECT_TYPES.BACKEND_JAVA:
        console.log('📡 扫描 Java 后端项目...');
        scanResult = await scanJava(projectRoot);
        break;

      case PROJECT_TYPES.BACKEND_PYTHON:
        console.log('📡 扫描 Python 后端项目...');
        scanResult = await scanPython(projectRoot);
        break;

      case PROJECT_TYPES.BACKEND_GO:
        console.log('📡 扫描 Go 后端项目...');
        scanResult = await scanGo(projectRoot);
        break;

      case PROJECT_TYPES.FULLSTACK:
        console.log('📡 扫描全栈项目（前端 + 后端）...');
        // 自动检测后端具体类型（简化处理，默认尝试 Java）
        const backendSubType = detectBackendSubType(projectRoot);
        scanResult = await scanFullstack(projectRoot, backendSubType);
        break;

      default:
        console.log('⚠️  未识别的项目类型，使用降级扫描模式...');
        scanResult = await scanGeneric(projectRoot);
        break;
    }

    // 8. 仅列出模式
    if (args.list) {
      console.log('\n📋 扫描结果摘要:');
      console.log(JSON.stringify(scanResult.summary || scanResult.stats, null, 2));
      console.log('\n✅ 列表模式完成。使用不带 --list 的命令生成完整报告。');
      return;
    }

    // 9. 生成 Markdown
    console.log('📝 正在生成导航文档...');

    const projectName = path.basename(projectRoot);
    const scanTime = Date.now() - startTime;

    const markdownContent = generateMarkdown(scanResult, {
      projectName,
      projectRoot,
      projectType,
      techStack,
      scanTime,
    });

    // 10. 写入文件
    const success = writeToFile(markdownContent, outputPath);

    if (success) {
      // 11. 显示完成统计
      console.log('');
      console.log('✅ 扫描完成！');
      console.log('');

      // 显示统计表格
      if (scanResult.summary) {
        console.log('📊 扫描统计:');
        console.log('─'.repeat(40));

        const labels = {
          routes: '路由',
          pages: '页面',
          components: '组件',
          store: '状态管理模块',
          apiLayer: 'API 文件',
          utils: '工具函数',
          styles: '样式文件',
          configs: '配置项',
        };

        for (const [key, label] of Object.entries(labels)) {
          const value = scanResult.summary[key];
          if (value !== undefined) {
            const displayValue = Array.isArray(value) ? value.length : value;
            console.log(`   ${label.padEnd(12)} ${String(displayValue).padStart(5)} 个`);
          }
        }

        if (scanResult.summary.backendTotal) {
          console.log(`   ${'后端模块'.padEnd(12)} ${scanResult.summary.backendTotal.toString().padStart(5)} 个`);
        }
        if (scanResult.summary.mappingCount) {
          console.log(`   ${'关联映射'.padEnd(12)} ${scanResult.summary.mappingCount.toString().padStart(5)} 个`);
        }

        console.log('─'.repeat(40));
      }

      console.log('');
      console.log(`📄 导航文档已生成:`);
      console.log(`   ${outputPath}`);
      console.log('');
      console.log(`⏱️  总耗时: ${(scanTime / 1000).toFixed(2)}s`);
      console.log('');
      console.log('💡 提示: 可以将此 Markdown 文件提供给 AI 助手，快速了解项目结构！');
    } else {
      console.error('❌ 生成失败');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ 扫描过程出错:');
    console.error(`   错误信息: ${error.message}`);
    console.error('');

    if (process.env.DEBUG) {
      console.error('详细错误堆栈:');
      console.error(error.stack);
    } else {
      console.error('提示: 设置 DEBUG=1 环境变量查看详细堆栈信息。');
    }

    process.exit(1);
  }
}

/**
 * 格式化项目类型显示名称
 * @param {string} type - 类型标识
 * @returns {string} 友好名称
 */
function formatTypeDisplay(type) {
  const names = {
    [PROJECT_TYPES.FRONTEND]: '前端项目 (Vue/React/Angular)',
    [PROJECT_TYPES.BACKEND_JAVA]: 'Java 后端 (Spring Boot)',
    [PROJECT_TYPES.BACKEND_PYTHON]: 'Python 后端 (Django/FastAPI/Flask)',
    [PROJECT_TYPES.BACKEND_GO]: 'Go 后端 (Gin/Echo)',
    [PROJECT_TYPES.BACKEND_NODE]: 'Node.js 后端',
    [PROJECT_TYPES.FULLSTACK]: '全栈项目 (前端 + 后端)',
    [PROJECT_TYPES.UNKNOWN]: '未知类型 (降级扫描)',
  };
  return names[type] || type;
}

/**
 * 为全栈项目检测后端子类型
 * 简化实现：根据特征文件判断
 * @param {string} projectRoot - 项目根目录
 * @returns {string} 后端子类型
 */
function detectBackendSubType(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, 'pom.xml')) ||
      fs.existsSync(path.join(projectRoot, 'build.gradle'))) {
    return 'backend-java';
  }
  if (fs.existsSync(path.join(projectRoot, 'requirements.txt')) ||
      fs.existsSync(path.join(projectRoot, 'pyproject.toml'))) {
    return 'backend-python';
  }
  if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
    return 'backend-go';
  }
  // 默认返回 Java
  return 'backend-java';
}

// 执行主流程
main().catch(error => {
  console.error('❌ 致命错误:', error.message);
  process.exit(1);
});
