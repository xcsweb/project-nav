/**
 * 后端项目扫描基础框架
 * 提供 9 个分区的通用扫描逻辑，各语言适配器只需提供路径模式即可
 * @module scanner-backend-base
 */

const path = require('path');
const { glob, getRelativePath, readFileSafe, extractExports } = require('./utils');

/**
 * 后端 9 个分区定义
 * 每个分区包含 id、显示名称和描述
 * @type {Array<{id: string, name: string, desc: string}>}
 */
const BACKEND_SECTIONS = [
  { id: 'controller', name: '接口层 (Controller)', desc: 'API 入口与路由定义' },
  { id: 'service', name: '业务层 (Service)', desc: '核心业务逻辑' },
  { id: 'repository', name: '数据访问层 (Repository/Mapper)', desc: '数据库操作' },
  { id: 'entity', name: '数据模型 (Entity)', desc: '数据实体定义' },
  { id: 'dto', name: 'DTO/VO', desc: '数据传输对象' },
  { id: 'config', name: '配置层', desc: '应用配置' },
  { id: 'middleware', name: '中间件/拦截器', desc: '认证/日志/限流等' },
  { id: 'utils', name: '工具类', desc: '公共工具方法' },
  { id: 'exception', name: '异常处理', desc: '统一异常处理' },
];

/**
 * 根据路径模式执行通用分层扫描
 * 各语言适配器（Java/Python/Go）只需传入对应的 glob 路径模式即可
 *
 * @param {string} projectRoot - 项目根目录绝对路径
 * @param {Object} patterns - 各分区的 glob 路径模式映射
 * @param {string[]} patterns.controller - Controller 层路径模式
 * @param {string[]} patterns.service - Service 层路径模式
 * @param {string[]} patterns.repository - Repository 层路径模式
 * @param {string[]} patterns.entity - Entity 层路径模式
 * @param {string[]} patterns.dto - DTO 层路径模式
 * @param {string[]} patterns.config - Config 层路径模式
 * @param {string[]} patterns.middleware - Middleware 层路径模式
 * @param {string[]} patterns.utils - Utils 层路径模式
 * @param {string[]} patterns.exception - Exception 层路径模式
 * @returns {Promise<Object>} 扫描结果，包含每个分区的 items 和 count，以及 summary 统计
 */
async function scanBackendBase(projectRoot, patterns) {
  const result = {};

  // 遍历所有后端分区进行扫描
  for (const section of BACKEND_SECTIONS) {
    const sectionPatterns = patterns[section.id] || [];

    if (sectionPatterns.length === 0) {
      result[section.id] = { items: [], count: 0 };
      continue;
    }

    // 使用 glob 模式匹配文件
    const files = await glob(sectionPatterns, { cwd: projectRoot });

    // 提取每个文件的元信息
    const items = files.map(absPath => {
      const relPath = getRelativePath(absPath, projectRoot);
      const fileName = path.basename(absPath, path.extname(absPath));
      const content = readFileSafe(absPath);

      return {
        name: fileName,
        path: relPath,
        exports: extractExports(content || '').slice(0, 8), // 最多取前8个导出
      };
    });

    result[section.id] = { items, count: items.length };
  }

  // 生成汇总统计
  result.summary = {};
  for (const section of BACKEND_SECTIONS) {
    result.summary[section.id] = result[section.id]?.count || 0;
  }

  return result;
}

module.exports = {
  scanBackendBase,
  BACKEND_SECTIONS
};
