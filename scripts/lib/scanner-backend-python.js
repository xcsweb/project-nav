/**
 * Python 后端项目扫描器
 * 提供 Python (Django/FastAPI/Flask) 项目的分层路径模式
 * @module scanner-backend-python
 */

const { scanBackendBase } = require('./scanner-backend-base');

/**
 * Python 项目各分区的 glob 路径模式
 * 支持 Django/FastAPI/Flask 等主流框架的目录约定
 */
const PYTHON_PATTERNS = {
  controller: ['**/views.py', '**/views/**/*.{py}', '**/routes*.py', '**/api/**/*.{py}'],
  service: ['**/services/**/*.{py}', '**/services.py', '**/business/**/*.{py}'],
  repository: [
    '**/models/**/*.{py}',
    '**/models.py',
    '**/repositories/**/*.{py}',
    '**/dal/**/*.{py}'
  ],
  entity: ['**/models/*.py', '**/entities/**/*.{py}', '**/schemas/**/*.{py}'],
  dto: ['**/schemas/**/*.{py}', '**/dto/**/*.{py}', '**/serializers/**/*.{py}'],
  config: [
    '**/settings.py',
    '**/config.py',
    '**/settings/**/*.{py}',
    '*.cfg',
    '*.ini'
  ],
  middleware: ['**/middleware*.py', '**/middleware/**/*.{py}'],
  utils: ['**/utils/**/*.{py}', '**/helpers/**/*.{py}', '**/common/**/*.{py}'],
  exception: ['**/exceptions*.py', '**/exceptions/**/*.{py}', '**/errors/**/*.{py}'],
};

/**
 * 扫描 Python 后端项目
 * @param {string} projectRoot - 项目根目录绝对路径
 * @returns {Promise<Object>} 扫描结果（9 个分区 + summary）
 */
async function scanPython(projectRoot) {
  return scanBackendBase(projectRoot, PYTHON_PATTERNS);
}

module.exports = {
  scanPython,
  PYTHON_PATTERNS
};
