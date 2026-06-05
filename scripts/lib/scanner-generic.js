/**
 * 未知类型项目降级扫描器
 * 当无法识别项目类型时使用，提供基础的目录结构扫描
 * @module scanner-generic
 */

const fs = require('fs');
const path = require('path');
const { glob, getRelativePath } = require('./utils');

/**
 * 对未知类型项目进行降级扫描
 * 递归列出项目根目录下的一级和二级子目录及文件数量统计
 *
 * @param {string} projectRoot - 项目根目录绝对路径
 * @returns {Promise<{structure: Array, stats: Object, hints: string[]}>}
 */
async function scanGeneric(projectRoot) {
  const structure = [];
  let totalFiles = 0;
  let totalDirs = 0;
  const hints = [];

  try {
    // 读取根目录内容
    const entries = fs.readdirSync(projectRoot, { withFileTypes: true });

    for (const entry of entries) {
      // 跳过隐藏目录和常见的非项目目录
      if (entry.name.startsWith('.') && !['.env', '.gitignore'].includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(projectRoot, entry.name);

      if (entry.isDirectory()) {
        totalDirs++;

        // 扫描子目录信息
        const dirInfo = await scanDirectory(fullPath, entry.name, projectRoot);
        structure.push(dirInfo);

        // 收集提示信息
        if (dirInfo.fileCount > 10) {
          hints.push(`${entry.name}/ 包含较多文件 (${dirInfo.fileCount}个)，可能是核心模块`);
        }

        totalFiles += dirInfo.fileCount;
      } else if (entry.isFile()) {
        // 只记录重要的顶层文件
        const ext = path.extname(entry.name).toLowerCase();
        if (['.json', '.md', '.yml', '.yaml', '.xml', '.txt', '.toml', '.cfg', '.ini'].includes(ext)) {
          structure.push({
            name: entry.name,
            type: 'file',
            path: `./${entry.name}`,
            size: getFileSize(fullPath),
          });
          totalFiles++;
        }
      }
    }

    // 尝试推断项目类型的提示
    hints.push(...generateHints(structure));

  } catch (error) {
    console.error('❌ 扫描失败:', error.message);
  }

  return {
    structure,
    stats: {
      totalFiles,
      totalDirs,
      scannedAt: new Date().toISOString(),
    },
    hints,
  };
}

/**
 * 扫描单个目录的信息
 * @param {string} dirPath - 目录绝对路径
 * @param {string} dirName - 目录名
 * @param {string} rootDir - 项目根目录
 * @returns {Promise<Object>} 目录信息
 */
async function scanDirectory(dirPath, dirName, rootDir) {
  const relPath = getRelativePath(dirPath, rootDir);

  try {
    // 获取该目录下的文件列表（只扫描一层）
    const files = await glob([
      `${dirPath.replace(/\\/g, '/')}/*`,
      `!${dirPath.replace(/\\/g, '/')}/node_modules/**`
    ]);

    // 统计文件类型分布
    const typeStats = {};
    let fileCount = 0;

    for (const filePath of files) {
      const ext = path.extname(filePath).toLowerCase() || '(无扩展名)';
      typeStats[ext] = (typeStats[ext] || 0) + 1;
      fileCount++;
    }

    // 提取子目录名
    const subDirs = [...new Set(
      files
        .map(f => path.dirname(f).split(path.sep).pop())
        .filter((d, i, arr) => d !== dirName && arr.indexOf(d) === i)
    )].slice(0, 10); // 最多显示10个子目录

    return {
      name: dirName,
      type: 'directory',
      path: relPath,
      fileCount,
      subDirs: subDirs.slice(0, 5), // 最多显示5个
      typeStats: Object.entries(typeStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5), // 显示前5种文件类型
    };

  } catch (error) {
    return {
      name: dirName,
      type: 'directory',
      path: relPath,
      fileCount: 0,
      error: error.message,
    };
  }
}

/**
 * 获取文件大小的友好显示
 * @param {string} filePath - 文件路径
 * @returns {string} 文件大小字符串
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const bytes = stats.size;

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } catch {
    return '未知';
  }
}

/**
 * 根据目录结构生成项目类型推测提示
 * @param {Array} structure - 目录结构数组
 * @returns {string[]} 提示信息数组
 */
function generateHints(structure) {
  const hints = [];
  const dirNames = structure.filter(s => s.type === 'directory').map(s => s.name.toLowerCase());

  if (dirNames.includes('src')) hints.push('检测到 src/ 目录，可能为标准前端/Node.js 项目');
  if (dirNames.includes('app') || dirNames.includes('application')) hints.push('可能为 Java/Spring Boot 或 Python 项目');
  if (dirNames.includes('cmd') && dirNames.includes('internal')) hints.push('可能为 Go 项目（标准布局）');
  if (dirNames.includes('lib') && dirNames.includes('test')) hints.push('可能为 Python/Ruby 库项目');
  if (structure.some(s => s.name === 'package.json')) hints.push('发现 package.json，建议使用 --type frontend 强制指定为前端项目扫描');
  if (structure.some(s => s.name === 'pom.xml' || s.name === 'build.gradle')) hints.push('发现 Java 构建文件，建议使用 --type backend-java 强制指定');

  return hints;
}

module.exports = { scanGeneric };
