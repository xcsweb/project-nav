/**
 * 全栈项目扫描器
 * 组合前端和后端扫描结果，增加前后端关联映射区
 * @module scanner-fullstack
 */

const { scanFrontend } = require('./scanner-frontend');
const { scanJava } = require('./scanner-backend-java');
const { scanPython } = require('./scanner-backend-python');
const { scanGo } = require('./scanner-backend-go');

/**
 * 扫描全栈项目（前端 + 后端）
 * 根据检测到的后端类型自动选择对应的后端扫描器
 *
 * @param {string} projectRoot - 项目根目录绝对路径
 * @param {string} backendType - 后端类型标识（backend-java/backend-python/backend-go）
 * @returns {Promise<Object>} 包含 frontend、backend、mapping 的完整扫描结果
 */
async function scanFullstack(projectRoot, backendType) {
  // 并行执行前端和后端扫描
  const [frontendResult, backendResult] = await Promise.all([
    scanFrontend(projectRoot),
    selectBackendScanner(backendType, projectRoot)
  ]);

  // 生成前后端关联映射
  const mapping = generateMapping(frontendResult, backendResult);

  return {
    frontend: frontendResult,
    backend: backendResult,
    mapping,
    summary: {
      ...frontendResult.summary,
      backendTotal: Object.values(backendResult.summary || {}).reduce((a, b) => a + b, 0),
      mappingCount: mapping.length,
    }
  };
}

/**
 * 根据后端类型选择对应的扫描器
 * @param {string} backendType - 后端类型
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<Object>} 后端扫描结果
 */
async function selectBackendScanner(backendType, projectRoot) {
  switch (backendType) {
    case 'backend-java':
      return scanJava(projectRoot);
    case 'backend-python':
      return scanPython(projectRoot);
    case 'backend-go':
      return scanGo(projectRoot);
    default:
      console.warn(`⚠️  未知的后端类型: ${backendType}，尝试使用 Java 扫描器`);
      return scanJava(projectRoot);
  }
}

/**
 * 生成前后端关联映射（基于路由名和 Controller 名的模糊匹配）
 * 帮助 AI 理解前端页面与后端接口的对应关系
 *
 * @param {Object} frontendResult - 前端扫描结果
 * @param {Object} backendResult - 后端扫描结果
 * @returns {Array<{frontendRoute: string, backendController: string, relation: string}>}
 */
function generateMapping(frontendResult, backendResult) {
  const mappings = [];

  if (!frontendResult?.routes || !backendResult) return mappings;

  const routes = frontendResult.routes;
  const controllers = backendResult.controller?.items || [];

  // 基于名称相似度进行匹配（简单实现：检查是否包含相同关键词）
  for (const route of routes) {
    for (const controller of controllers) {
      const routeName = route.name.toLowerCase();
      const ctrlName = controller.name.toLowerCase();

      // 检查是否有共同的关键词（排除通用的 User/Auth/Index 等）
      if (routeName !== ctrlName &&
          (routeName.includes(ctrlName) || ctrlName.includes(routeName) ||
           getCommonKeywords(routeName, ctrlName).length > 0)) {

        mappings.push({
          frontendRoute: route.name,
          frontendPath: route.componentPath,
          backendController: controller.name,
          backendPath: controller.path,
          relation: inferRelation(routeName, ctrlName),
        });
      }
    }
  }

  return mappings;
}

/**
 * 提取两个字符串的共同关键词
 * @param {string} str1 - 字符串1
 * @param {string} str2 - 字符串2
 * @returns {string[]} 共同关键词数组
 */
function getCommonKeywords(str1, str2) {
  // 简单分词（按驼峰/下划线/连字符分割）
  const words1 = str1.split(/(?=[A-Z])|[_-]/).filter(w => w.length > 2);
  const words2 = str2.split(/(?=[A-Z])|[_-]/).filter(w => w.length > 2);

  return words1.filter(w => words2.some(w2 => w2.toLowerCase() === w.toLowerCase()));
}

/**
 * 推断前后端关系类型
 * @param {string} routeName - 路由名
 * @param {string} ctrlName - 控制器名
 * @returns {string} 关系描述
 */
function inferRelation(routeName, ctrlName) {
  if (routeName.includes(ctrlName) || ctrlName.includes(routeName)) {
    return '直接对应';
  }

  const common = getCommonKeywords(routeName, ctrlName);
  if (common.length > 0) {
    return `相关联 (${common.join(', ')})`;
  }

  return '可能相关';
}

module.exports = { scanFullstack };
