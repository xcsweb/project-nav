/**
 * 公共工具函数模块
 * 提供 glob 文件搜索、路径处理、文件读取等基础能力
 * @module utils
 */

const fs = require('fs');
const path = require('path');

// 动态导入 fast-glob（支持 ESM 和 CJS）
let fg;
async function getFg() {
  if (!fg) {
    try {
      const module = await import('fast-glob');
      fg = module.default || module;
    } catch (e) {
      console.error('❌ 缺少依赖，请运行: npm install fast-glob');
      process.exit(1);
    }
  }
  return fg;
}

/**
 * Glob 文件搜索
 * @param {string|string[]} pattern - glob 模式（支持数组批量匹配）
 * @param {Object} options - fast-glob 选项
 * @returns {Promise<string[]>} 匹配的文件绝对路径数组
 */
async function glob(pattern, options = {}) {
  const fn = await getFg();
  return fn.globSync(pattern, {
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/*.min.js',
      '**/*.min.css',
      '**/*.map',
      '**/coverage/**',
      '**/.next/**',
      '**/.nuxt/**'
    ],
    ...options,
  });
}

/**
 * 计算相对于项目根目录的相对路径
 * @param {string} absolutePath - 绝对路径
 * @param {string} projectRoot - 项目根目录
 * @returns {string} 相对路径（使用正斜杠，以 ./ 开头）
 */
function getRelativePath(absolutePath, projectRoot) {
  let rel = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

/**
 * 安全读取文件内容
 * @param {string} filePath - 文件绝对路径
 * @returns {string|null} 文件内容，读取失败返回 null
 */
function readFileSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 安全解析 JSON
 * @param {string} content - JSON 字符串
 * @returns {Object|null} 解析结果，失败返回 null
 */
function parseJsonSafe(content) {
  try {
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

/**
 * 检查文件是否存在
 * @param {string} filePath - 相对或绝对路径
 * @param {string} rootDir - 基准目录（可选，提供时将拼接为绝对路径）
 * @returns {boolean} 文件是否存在
 */
function exists(filePath, rootDir) {
  const fullPath = rootDir ? path.resolve(rootDir, filePath) : filePath;
  return fs.existsSync(fullPath);
}

/**
 * 从文件内容中提取导出函数名（简单正则匹配）
 * 支持 export function / export const / module.exports 等格式
 * @param {string} content - 文件内容
 * @returns {string[]} 导出的函数/变量名列表
 */
function extractExports(content) {
  const exports = [];
  // 匹配 export function / export default function / export const 等
  const patterns = [
    /export\s+(?:default\s+)?function\s+(\w+)/g,
    /export\s+(?:const|let|var)\s+(\w+)/g,
    /module\.exports\s*=\s*(\w+)/g,
    /exports\.(\w+)\s*=/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1] && !exports.includes(match[1])) {
        exports.push(match[1]);
      }
    }
  }
  return exports;
}

module.exports = {
  glob,
  getRelativePath,
  readFileSafe,
  parseJsonSafe,
  exists,
  extractExports
};
