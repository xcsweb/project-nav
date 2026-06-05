/**
 * Markdown 缓存生成器
 * 将扫描结果格式化为标准 Markdown 文件，便于 AI 直接读取和理解
 * @module generator
 */

const fs = require('fs');
const path = require('path');

/**
 * 生成完整的 Markdown 导航文档
 *
 * @param {Object} scanResult - 扫描结果对象（来自各扫描器）
 * @param {Object} options - 生成选项
 * @param {string} options.projectName - 项目名称
 * @param {string} options.projectRoot - 项目根目录路径
 * @param {string} options.projectType - 项目类型
 * @param {string[]} options.techStack - 技术栈标签
 * @param {number} options.scanTime - 扫描耗时（毫秒）
 * @returns {string} 生成的 Markdown 内容
 */
function generateMarkdown(scanResult, options) {
  const {
    projectName = 'Unknown Project',
    projectRoot = '.',
    projectType = 'unknown',
    techStack = [],
    scanTime = 0,
  } = options;

  const lines = [];

  // ========== 头部元信息 ==========
  lines.push('# 🗺️ 项目代码导航');
  lines.push('');
  lines.push('> 本文件由 project-nav 自动生成，包含项目结构概览和快速导航链接。');
  lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`> 扫描耗时: ${(scanTime / 1000).toFixed(2)}s`);
  lines.push('');

  // 元信息表格
  lines.push('| 属性 | 值 |');
  lines.push('|------|-----|');
  lines.push(`| **项目名称** | ${projectName} |`);
  lines.push(`| **项目类型** | ${formatProjectType(projectType)} |`);
  lines.push(`| **技术栈** | ${techStack.length > 0 ? techStack.join(' · ') : '未检测到'} |`);
  lines.push(`| **根目录** | \`${projectRoot}\` |`);
  lines.push('');

  // ========== 目录导航 ==========
  lines.push('## 📑 快速导航');
  lines.push('');
  lines.push('- [📍 路由表](#-路由表)');
  lines.push('- [📄 页面模块](#-页面模块)');
  lines.push('- [🧩 公共组件](#-公共组件)');
  lines.push('- [📦 状态管理](#-状态管理)');
  lines.push('- [🌐 API 接口层](#-api-接口层)');
  lines.push('- [🔧 工具函数](#-工具函数)');
  lines.push('- [🎨 样式资源](#-样式资源)');
  lines.push('-(' + '⚙️ 配置项](#️-配置项)');

  if (scanResult.backend) {
    lines.push('- [🔙 后端分层架构](#-后端分层架构)');
    lines.push('- [🔗 前后端关联映射](#-前后端关联映射)');
  }

  if (scanResult.structure) {
    lines.push('- [📁 目录结构](#-目录结构)');
  }
  lines.push('');

  // ========== 统计概览 ==========
  lines.push('## 📊 统计概览');
  lines.push('');
  if (scanResult.summary) {
    lines.push('| 分区 | 数量 |');
    lines.push('|------|------|');

    const summaryMap = {
      routes: '📍 路由',
      pages: '📄 页面',
      components: '🧩 组件',
      store: '📦 Store',
      apiLayer: '🌐 API',
      utils: '🔧 工具',
      styles: '🎨 样式',
      configs: '⚙️ 配置',
    };

    for (const [key, label] of Object.entries(summaryMap)) {
      if (scanResult.summary[key] !== undefined) {
        lines.push(`| ${label} | ${scanResult.summary[key]} |`);
      }
    }

    if (scanResult.summary.backendTotal) {
      lines.push(`| 🔙 后端模块 | ${scanResult.summary.backendTotal} |`);
    }
    if (scanResult.summary.mappingCount) {
      lines.push(`| 🔗 关联映射 | ${scanResult.summary.mappingCount} |`);
    }
  }
  lines.push('');

  // ========== 各分区详情 ==========

  // 1. 路由表
  if (scanResult.routes?.length > 0) {
    lines.push('## 📍 路由表');
    lines.push('');
    lines.push('| 路由名称 | 组件路径 | 来源文件 |');
    lines.push('|----------|----------|----------|');

    for (const route of scanResult.routes) {
      lines.push(`| ${route.name || '-'} | \`${route.componentPath || route.path || '-'}\` | ${route.sourceFile || '-'} |`);
    }
    lines.push('');
  }

  // 2. 页面模块
  if (scanResult.pages?.length > 0) {
    lines.push('## 📄 页面模块');
    lines.push('');

    for (const module of scanResult.pages) {
      lines.push(`### ${module.name}/ (${module.fileCount} 个文件)`);
      lines.push('');
      lines.push('| 文件名 | 类型 | 路径 |');
      lines.push('|--------|------|------|');

      for (const file of module.files) {
        lines.push(`| ${file.name} | ${file.type} | \`${file.path}\` |`);
      }
      lines.push('');
    }
  }

  // 3. 公共组件
  if (scanResult.components?.length > 0) {
    lines.push('## 🧩 公共组件');
    lines.push('');
    lines.push('| 组件名 | 分组 | 路径 |');
    lines.push('|--------|------|------|');

    for (const comp of scanResult.components) {
      lines.push(`| ${comp.name} | ${comp.group} | \`${comp.path}\` |`);
    }
    lines.push('');
  }

  // 4. 状态管理
  if (scanResult.store) {
    lines.push('## 📦 状态管理');
    lines.push('');

    if (scanResult.store.framework) {
      lines.push(`**框架**: ${scanResult.store.framework}`);
      lines.push('');
    }

    if (scanResult.store.modules?.length > 0) {
      lines.push('| 模块名 | 路径 | 主要导出 |');
      lines.push('|--------|------|----------|');

      for (const mod of scanResult.store.modules) {
        lines.push(`| ${mod.name} | \`${mod.path}\` | ${mod.exports.join(', ') || '-'} |`);
      }
      lines.push('');
    }

    if (scanResult.store.files?.length > 0) {
      lines.push('**相关文件**:');
      lines.push('');
      for (const f of scanResult.store.files) {
        lines.push(`- \`${f}\``);
      }
      lines.push('');
    }
  }

  // 5. API 接口层
  if (scanResult.apiLayer?.files?.length > 0) {
    lines.push('## 🌐 API 接口层');
    lines.push('');
    lines.push('| 文件名 | 角色 | BaseURL | 路径 |');
    lines.push('|--------|------|---------|------|');

    for (const file of scanResult.apiLayer.files) {
      lines.push(`| ${file.name} | ${file.role} | ${file.baseURL || '-'} | \`${file.path}\` |`);
    }
    lines.push('');
  }

  // 6. 工具函数
  if (scanResult.utils?.length > 0) {
    lines.push('## 🔧 工具函数');
    lines.push('');
    lines.push('| 模块名 | 路径 | 导出函数 |');
    lines.push('|--------|------|----------|');

    for (const util of scanResult.utils) {
      lines.push(`| ${util.name} | \`${util.path}\` | ${util.exports.join(', ') || '-'} |`);
    }
    lines.push('');
  }

  // 7. 样式资源
  if (scanResult.styles?.length > 0) {
    lines.push('## 🎨 样式资源');
    lines.push('');
    lines.push('| 文件名 | 类型 | 路径 |');
    lines.push('|--------|------|------|');

    for (const style of scanResult.styles) {
      lines.push(`| ${style.name} | ${style.type} | \`${style.path}\` |`);
    }
    lines.push('');
  }

  // 8. 配置项
  if (scanResult.configs?.length > 0) {
    lines.push('## ⚙️ 配置项');
    lines.push('');
    lines.push('| 文件名 | 用途 | 路径 |');
    lines.push('|--------|------|------|');

    for (const config of scanResult.configs) {
      lines.push(`| ${config.name} | ${config.role} | \`${config.path}\` |`);
    }
    lines.push('');
  }

  // 9. 后端分层架构（全栈项目）
  if (scanResult.backend) {
    lines.push('## 🔙 后端分层架构');
    lines.push('');

    const sectionNames = {
      controller: '接口层 (Controller)',
      service: '业务层 (Service)',
      repository: '数据访问层 (Repository)',
      entity: '数据模型 (Entity)',
      dto: 'DTO/VO',
      config: '配置层',
      middleware: '中间件/拦截器',
      utils: '工具类',
      exception: '异常处理',
    };

    for (const [sectionId, data] of Object.entries(scanResult.backend)) {
      if (sectionId === 'summary' || !data?.items) continue;

      lines.push(`### ${sectionNames[sectionId] || sectionId} (${data.count} 个)`);
      lines.push('');
      lines.push('| 名称 | 路径 | 导出 |');
      lines.push('|------|------|------|');

      for (const item of data.items) {
        lines.push(`| ${item.name} | \`${item.path}\` | ${item.exports.join(', ') || '-'} |`);
      }
      lines.push('');
    }
  }

  // 10. 前后端关联映射
  if (scanResult.mapping?.length > 0) {
    lines.push('## 🔗 前后端关联映射');
    lines.push('');
    lines.push('| 前端路由 | 前端路径 | 后端 Controller | 后端路径 | 关系 |');
    lines.push('|----------|----------|-----------------|----------|------|');

    for (const map of scanResult.mapping) {
      lines.push(`| ${map.frontendRoute} | \`${map.frontendPath || '-'}\` | ${map.backendController} | \`${map.backendPath || '-'}\` | ${map.relation} |`);
    }
    lines.push('');
  }

  // 11. 目录结构（未知类型降级扫描）
  if (scanResult.structure?.length > 0) {
    lines.push('## 📁 目录结构');
    lines.push('');

    for (const item of scanResult.structure) {
      if (item.type === 'directory') {
        lines.push(`### 📂 ${item.name}/ (${item.fileCount} 个文件)`);
        lines.push('');
        if (item.subDirs?.length > 0) {
          lines.push(`**子目录**: ${item.subDirs.join(', ')}`);
          lines.push('');
        }
        if (item.typeStats?.length > 0) {
          lines.push('| 文件类型 | 数量 |');
          lines.push('|----------|------|');
          for (const [ext, count] of item.typeStats) {
            lines.push(`| ${ext} | ${count} |`);
          }
          lines.push('');
        }
      } else {
        lines.push `- **${item.name}** (${item.size}) - \`${item.path}\``;
        lines.push('');
      }
    }

    // 提示信息
    if (scanResult.hints?.length > 0) {
      lines.push('### 💡 类型推测提示');
      lines.push('');
      for (const hint of scanResult.hints) {
        lines.push(`- ${hint}`);
      }
      lines.push('');
    }
  }

  // ========== 底部说明 ==========
  lines.push('---');
  lines.push('');
  lines.push('*本文件由 [project-nav](https://github.com/your-repo/project-nav) 自动生成*');
  lines.push(`*最后更新: ${new Date().toLocaleString('zh-CN')}*`);

  return lines.join('\n');
}

/**
 * 格式化项目类型显示名称
 * @param {string} type - 项目类型标识
 * @returns {string} 友好的显示名称
 */
function formatProjectType(type) {
  const typeNames = {
    'frontend': '前端项目',
    'backend-java': 'Java 后端',
    'backend-python': 'Python 后端',
    'backend-go': 'Go 后端',
    'backend-node': 'Node.js 后端',
    'fullstack': '全栈项目',
    'unknown': '未知类型',
  };
  return typeNames[type] || type;
}

/**
 * 将生成的 Markdown 写入文件
 * @param {string} content - Markdown 内容
 * @param {string} outputPath - 输出文件路径
 * @returns {boolean} 是否写入成功
 */
function writeToFile(content, outputPath) {
  try {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('❌ 写入文件失败:', error.message);
    return false;
  }
}

module.exports = {
  generateMarkdown,
  writeToFile,
};
