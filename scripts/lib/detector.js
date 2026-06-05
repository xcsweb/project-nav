/**
 * 项目类型检测器
 * 通过检查根目录特征文件自动识别项目类型和技术栈
 * @module detector
 */

const fs = require('fs');
const path = require('path');
const { readFileSafe, parseJsonSafe, exists } = require('./utils');

/**
 * 项目类型枚举
 * @enum {string}
 */
const PROJECT_TYPES = {
  BACKEND_JAVA: 'backend-java',
  BACKEND_PYTHON: 'backend-python',
  BACKEND_GO: 'backend-go',
  BACKEND_RUST: 'backend-rust',
  BACKEND_CSHARP: 'backend-csharp',
  BACKEND_PHP: 'backend-php',
  BACKEND_NODE: 'backend-node',
  FULLSTACK: 'fullstack',
  FRONTEND: 'frontend',
  UNKNOWN: 'unknown',
};

/**
 * Node.js 后端入口文件模式（用于区分 Node.js 后端 vs 前端）
 * @type {string[]}
 */
const NODE_BACKEND_ENTRIES = [
  'server/index.js', 'server/app.js', 'server/main.js',
  'src/server/index.js', 'src/app.js', 'src/main.js',
  'app.js', 'index.js'
];

/**
 * 检测项目类型和技术栈
 * @param {string} projectRoot - 项目根目录绝对路径
 * @returns {{ type: string, techStack: string[] }} 项目类型和检测到的技术栈
 */
function detect(projectRoot) {
  // 检查各特征文件是否存在
  const checks = {
    hasPomXml: exists('pom.xml', projectRoot),
    hasBuildGradle: exists('build.gradle', projectRoot),
    hasRequirementsTxt: exists('requirements.txt', projectRoot),
    hasPyprojectToml: exists('pyproject.toml', projectRoot),
    hasGoMod: exists('go.mod', projectRoot),
    hasCargoToml: exists('Cargo.toml', projectRoot),
    hasCsproj: exists('.csproj', projectRoot) || exists('.sln', projectRoot),
    hasComposerJson: exists('composer.json', projectRoot),
    hasPackageJson: exists('package.json', projectRoot),
  };

  // 检测是否为 Node.js 后端（有 server 入口文件）
  const isNodeBackend = checks.hasPackageJson &&
    NODE_BACKEND_ENTRIES.some(f => exists(f, projectRoot));

  // 检测后端特征
  const hasBackendTrait = checks.hasPomXml || checks.hasBuildGradle ||
    checks.hasRequirementsTxt || checks.hasPyprojectToml ||
    checks.hasGoMod || checks.hasCsproj ||
    checks.hasComposerJson || isNodeBackend;

  // 检测前端特征（有 package.json 且非纯后端）
  const hasFrontendTrait = checks.hasPackageJson;

  // 判断项目类型
  let type;
  if (hasBackendTrait && hasFrontendTrait && !isNodeBackend) {
    type = PROJECT_TYPES.FULLSTACK;
  } else if (checks.hasPomXml || checks.hasBuildGradle) {
    type = PROJECT_TYPES.BACKEND_JAVA;
  } else if (checks.hasRequirementsTxt || checks.hasPyprojectToml) {
    type = PROJECT_TYPES.BACKEND_PYTHON;
  } else if (checks.hasGoMod) {
    type = PROJECT_TYPES.BACKEND_GO;
  } else if (checks.hasCargoToml && !hasFrontendTrait) {
    // Rust：需要排除前端框架（如 Yew/Tauri 有 Cargo.toml 但也是前端）
    type = PROJECT_TYPES.BACKEND_RUST;
  } else if (checks.hasCsproj) {
    type = PROJECT_TYPES.BACKEND_CSHARP;
  } else if (checks.hasComposerJson && !hasFrontendTrait) {
    type = PROJECT_TYPES.BACKEND_PHP;
  } else if (isNodeBackend) {
    type = PROJECT_TYPES.BACKEND_NODE;
  } else if (hasFrontendTrait) {
    type = PROJECT_TYPES.FRONTEND;
  } else {
    type = PROJECT_TYPES.UNKNOWN;
  }

  // 检测技术栈细节
  const techStack = detectTechStack(projectRoot, type);

  return { type, techStack };
}

/**
 * 检测技术栈细节（框架、构建工具、UI库等）
 * @param {string} projectRoot - 项目根目录
 * @param {string} type - 已检测的项目类型
 * @returns {string[]} 技术栈标签数组
 */
function detectTechStack(projectRoot, type) {
  const stack = [];

  // 读取 package.json 提取前端框架信息
  if (exists('package.json', projectRoot)) {
    const pkg = parseJsonSafe(readFileSafe(path.join(projectRoot, 'package.json')));
    if (pkg) {
      // 合并 dependencies 和 devDependencies
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // 框架检测
      if (deps.vue) stack.push(deps.vue.startsWith('^3') ? 'Vue3' : 'Vue2');
      if (deps.react) stack.push('React');
      if (deps.angular) stack.push('Angular');
      if (deps.svelte) stack.push('Svelte');

      // 构建工具
      if (deps.vite) stack.push('Vite');
      if (deps.webpack) stack.push('Webpack');
      if (deps['vue-cli-service']) stack.push('@vue/cli');

      // UI 库
      if (deps['naive-ui'] || deps['@vicons/ionicons5']) stack.push('NaiveUI');
      if (deps['element-plus'] || deps.elementui) {
        stack.push(deps['element-plus'] ? 'Element Plus' : 'ElementUI');
      }
      if (deps.antd) stack.push('Ant Design Vue');

      // 状态管理
      if (deps.pinia) stack.push('Pinia');
      if (deps.vuex) stack.push('Vuex');
      if (deps['@reduxjs/toolkit'] || deps.redux) stack.push('Redux');

      // HTTP 客户端
      if (deps.axios) stack.push('Axios');
    }
  }

  // 后端技术栈检测 - Java/Spring Boot
  if (type === PROJECT_TYPES.BACKEND_JAVA || type === PROJECT_TYPES.FULLSTACK) {
    if (exists('pom.xml', projectRoot)) {
      const pomContent = readFileSafe(path.join(projectRoot, 'pom.xml'));
      if (pomContent && pomContent.includes('spring-boot')) stack.push('Spring Boot');
    }
  }

  // 后端技术栈检测 - Python
  if (type === PROJECT_TYPES.BACKEND_PYTHON || type === PROJECT_TYPES.FULLSTACK) {
    if (exists('requirements.txt', projectRoot)) {
      const reqContent = readFileSafe(path.join(projectRoot, 'requirements.txt'));
      if (reqContent) {
        if (reqContent.includes('django')) stack.push('Django');
        if (reqContent.includes('fastapi')) stack.push('FastAPI');
        if (reqContent.includes('flask')) stack.push('Flask');
      }
    }
  }

  // 后端技术栈检测 - Go
  if (type === PROJECT_TYPES.BACKEND_GO || type === PROJECT_TYPES.FULLSTACK) {
    if (exists('go.mod', projectRoot)) {
      const goMod = readFileSafe(path.join(projectRoot, 'go.mod'));
      if (goMod) {
        if (goMod.includes('gin-gonic')) stack.push('Gin');
        if (goMod.includes('labstack/echo')) stack.push('Echo');
      }
    }
  }

  return stack;
}

module.exports = {
  detect,
  PROJECT_TYPES
};
