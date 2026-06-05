/**
 * Go 后端项目扫描器
 * 提供 Go (Gin/Echo) 项目的分层路径模式
 * @module scanner-backend-go
 */

const { scanBackendBase } = require('./scanner-backend-base');

/**
 * Go 项目各分区的 glob 路径模式
 * 遵循 Go 标准项目布局和 Gin/Echo 框架约定
 */
const GO_PATTERNS = {
  controller: ['**/handler/**/*.{go}', '**/controller/**/*.{go}', '**/router.go', '**/route*.go'],
  service: ['**/service/**/*.{go}', '**/usecase/**/*.{go}', '**/biz/**/*.{go}'],
  repository: [
    '**/repository/**/*.{go}',
    '**/repo/**/*.{go}',
    '**/dao/**/*.{go}',
    '**/model/**/*.{go}'
  ],
  entity: ['**/model/**/*.{go}', '**/entity/**/*.{go}', '**/domain/**/*.{go}'],
  dto: ['**/dto/**/*.{go}', '**/request/**/*.{go}', '**/response/**/*.{go}', '**/vo/**/*.{go}'],
  config: ['**/config*.{go,yaml,yml,toml,json}', '**/.env*'],
  middleware: ['**/middleware/**/*.{go}'],
  utils: ['**/utils/**/*.{go}', '**/common/**/*.{go}', '**/pkg/**/*.{go}'],
  exception: ['**/error*.{go}', '**/exception/**/*.{go}'],
};

/**
 * 扫描 Go 后端项目
 * @param {string} projectRoot - 项目根目录绝对路径
 * @returns {Promise<Object>} 扫描结果（9 个分区 + summary）
 */
async function scanGo(projectRoot) {
  return scanBackendBase(projectRoot, GO_PATTERNS);
}

module.exports = {
  scanGo,
  GO_PATTERNS
};
