/**
 * Java 后端项目扫描器
 * 提供 Java/Spring Boot 项目的分层路径模式
 * @module scanner-backend-java
 */

const { scanBackendBase } = require('./scanner-backend-base');

/**
 * Java 项目各分区的 glob 路径模式
 * 遵循 Spring Boot 等主流框架的目录约定
 */
const JAVA_PATTERNS = {
  controller: ['**/*Controller.java'],
  service: ['**/*Service.java', '**/*ServiceImpl.java'],
  repository: ['**/*Mapper.java', '**/*Repository.java', '**/*Dao.java'],
  entity: ['**/entity/*.java', '**/domain/*.java', '**/model/*.java'],
  dto: ['**/dto/*.java', '**/vo/*.java', '**/request/*.java', '**/response/*.java'],
  config: [
    '**/application.yml',
    '**/application.yaml',
    '**/application*.properties',
    '**/bootstrap.yml'
  ],
  middleware: ['**/*Interceptor.java', '**/*Filter.java', '**/*Aspect.java'],
  utils: ['**/util/**/*.java', '**/common/**/*.java', '**/utils/**/*.java'],
  exception: ['**/exception/**/*.java', '**/*GlobalException*.java', '**/*Advice.java'],
};

/**
 * 扫描 Java 后端项目
 * @param {string} projectRoot - 项目根目录绝对路径
 * @returns {Promise<Object>} 扫描结果（9 个分区 + summary）
 */
async function scanJava(projectRoot) {
  return scanBackendBase(projectRoot, JAVA_PATTERNS);
}

module.exports = {
  scanJava,
  JAVA_PATTERNS
};
