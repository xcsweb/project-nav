/**
 * 前端项目扫描器
 * 扫描路由表、页面目录、公共组件、状态管理、请求层、工具函数、样式资源、配置项
 * 核心功能：支持 sub-police 项目的 Map 格式路由定义
 * @module scanner-frontend
 */

const path = require('path');
const { glob, getRelativePath, readFileSafe, extractExports } = require('./utils');

/**
 * 扫描前端项目的所有分区
 * @param {string} projectRoot - 项目根目录绝对路径
 * @returns {Promise<Object>} 各分区的扫描结果，包含 summary 统计信息
 */
async function scanFrontend(projectRoot) {
  const results = {
    routes: await extractRoutes(projectRoot),
    pages: await scanPages(projectRoot),
    components: await scanComponents(projectRoot),
    store: await scanStore(projectRoot),
    apiLayer: await scanApiLayer(projectRoot),
    utils: await scanUtils(projectRoot),
    styles: await scanStyles(projectRoot),
    configs: await scanConfigs(projectRoot),
  };

  // 统计各分区条目数
  results.summary = {
    routes: results.routes.length,
    pages: countModules(results.pages),
    components: results.components.length,
    store: results.store.modules?.length || results.store.files?.length || 0,
    apiLayer: results.apiLayer.files.length,
    utils: results.utils.length,
    styles: results.styles.length,
    configs: results.configs.length,
  };

  return results;
}

/**
 * 提取路由表 —— 核心功能！
 * 支持多种路由配置格式：
 * 1. Map 定义格式（如 sub-police 的 goalMap/routeImports）
 * 2. 对象字面量/数组格式的 routes 定义
 * 3. Vue Router 的 routes 数组
 * 4. React Router 的 Route 组件
 *
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<Array<{name: string, componentPath: string, sourceFile: string}>>}
 */
async function extractRoutes(projectRoot) {
  const routes = [];

  // 1. 查找路由配置文件（多模式匹配）
  const routerFiles = await glob([
    '**/router/**/*.{js,ts,tsx}',
    '**/routes/**/*.{js,ts,tsx}',
    '**/router.{js,ts}',
    '**/routes.{js,ts}',
  ], { cwd: projectRoot });

  for (const absPath of routerFiles) {
    const content = readFileSafe(absPath);
    if (!content) continue;

    const relPath = getRelativePath(absPath, projectRoot);

    // 策略 A：提取 new Map([ ["key", value] ]) 或 Map([...]) 格式（如 sub-police）
    const mapMatches = extractMapDefinitions(content);
    for (const m of mapMatches) {
      // 判断是 routeImports Map（包含 import()）还是 goalMap（纯路径映射）
      if (m.pairs.some(p => p.value?.includes('import('))) {
        // 这是 import 映射表，提取动态导入路径
        for (const pair of m.pairs) {
          if (pair.key && pair.value) {
            const importPath = extractImportPath(pair.value);
            routes.push({
              name: typeof pair.key === 'string' ? pair.key.replace(/['"]/g, '') : pair.key,
              componentPath: importPath,
              sourceFile: relPath,
            });
          }
        }
      } else if (m.pairs.some(p =>
        p.value && p.value.includes('/') &&
        !p.value.includes('import') &&
        !p.value.includes('require')
      )) {
        // 这是路由路径映射表（如 goalMap）
        for (const pair of m.pairs) {
          if (pair.key && pair.value) {
            routes.push({
              name: typeof pair.key === 'string' ? pair.key.replace(/['"]/g, '') : pair.key,
              componentPath: typeof pair.value === 'string' ? pair.value.replace(/['"]/g, '') : pair.value,
              sourceFile: relPath,
            });
          }
        }
      }
    }

    // 策略 B：提取对象字面量/数组中的 path/name/component
    const routeObjMatches = extractRouteObjects(content);
    for (const r of routeObjMatches) {
      // 去重：避免重复添加同名路由
      if (!routes.find(rt => rt.name === r.name)) {
        routes.push({ ...r, sourceFile: relPath });
      }
    }
  }

  // 去重：优先保留完整路径版本（含 @/ 或 .vue 的）
  const seen = new Set();
  const deduped = routes.filter(r => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
  
  // 如果存在同名的长短两个版本，优先保留长路径（更完整的）
  for (let i = 0; i < deduped.length; i++) {
    const current = deduped[i];
    // 查找是否有同名但路径更短的条目（后面被 filter 掉的那个）
    const hasBetterVersion = routes.some(r => 
      r.name === current.name && 
      r.componentPath && 
      r.componentPath.length > (current.componentPath || '').length &&
      r.componentPath.includes('@/')
    );
    if (!hasBetterVersion && current.componentPath && !current.componentPath.includes('@/') && !current.componentPath.includes('.vue')) {
      // 当前是短路径版本，尝试找完整版替换
      const fullVersion = routes.find(r => 
        r.name === current.name && 
        r.componentPath && 
        (r.componentPath.includes('@/') || r.componentPath.includes('.vue'))
      );
      if (fullVersion) {
        Object.assign(current, fullVersion);
      }
    }
  }
  
  return deduped;
}

/**
 * 从 JS 代码中提取所有 Map([...]) 或 new Map([...]) 定义
 * 支持变量赋值格式：let xxx = new Map([...])
 *
 * @param {string} content - 文件内容
 * @returns {Array<{pairs: Array<{key: string, rawValue: string, value: string}>}>}
 */
function extractMapDefinitions(content) {
  const results = [];

  // 匹配 new Map([...]) 或 Map([...]) 或 let/const/var xxx = new Map([...])
  const mapRegex = /(?:let|const|var)?\s*(\w*)\s*=\s*(?:new\s+)?Map\s*\(\s*\[/g;
  let match;

  while ((match = mapRegex.exec(content)) !== null) {
    const startPos = match.index + match[0].length;

    // 找到对应的闭合 ]
    const endPos = findMatchingBracket(content, startPos, '[', ']');
    if (endPos === -1) continue;

    const innerContent = content.substring(startPos, endPos);
    const pairs = parseMapPairs(innerContent);

    if (pairs.length > 0) {
      results.push({ pairs });
    }
  }

  return results;
}

/**
 * 解析 Map 内部的 [key, value] 对
 * 支持 ["key", value] / ['key', value] 格式
 *
 * @param {string} content - Map 内部内容
 * @returns {Array<{key: string, rawValue: string, value: string}>}
 */
function parseMapPairs(content) {
  const pairs = [];
  // 匹配 ["key", value] 或 ['key', value]
  const pairRegex = /\[\s*(['"`])(.*?)\1\s*,\s*(.+?)\s*\]/g;
  let match;

  while ((match = pairRegex.exec(content)) !== null) {
    pairs.push({
      key: match[2],
      rawValue: match[3],
      value: cleanValue(match[3]),
    });
  }

  return pairs;
}

/**
 * 清理值字符串（去除引号、提取 import() 路径等）
 * @param {string} val - 原始值字符串
 * @returns {string} 清理后的值
 */
function cleanValue(val) {
  if (!val) return val;

  // 去除外层引号
  val = val.replace(/^['"`]|['"`]$/g, '');

  // 如果是箭头函数或 import()，提取路径部分
  const importMatch = val.match(/import\s*\(\s*['"`](.+)['"`]\s*\)/);
  if (importMatch) return importMatch[1];

  return val.trim();
}

/**
 * 从 import() 表达式中提取文件路径
 * @param {string} valueStr - 包含 import() 的表达式
 * @returns {string} 提取出的文件路径
 */
function extractImportPath(valueStr) {
  if (!valueStr) return '';

  const m = valueStr.match(/import\s*\(\s*['"`](.+?)['"`]\s*\)/);
  return m ? m[1] : cleanValue(valueStr);
}

/**
 * 从路由对象字面量中提取路由定义
 * 支持 Vue Router 和 React Router 格式
 *
 * @param {string} content - 文件内容
 * @returns {Array<{path?: string, name: string, componentPath: string|null}>}
 */
function extractRouteObjects(content) {
  const routes = [];

  // 匹配 { path: ..., name: ..., component: ... } 格式（Vue Router）
  const routeRegex = /{\s*path:\s*['"`](.*?)['"`]\s*,\s*name:\s*['"`](.*?)['"`]/g;
  let match;

  while ((match = routeRegex.exec(content)) !== null) {
    routes.push({
      path: match[1],
      name: match[2],
      componentPath: null,
    });
  }

  // 匹配 React Route <Route path="..." element={<.../>} />
  const reactRouteRegex = /<Route\s+path=['"`](.*?)['"`][^>]*>/g;
  while ((match = reactRouteRegex.exec(content)) !== null) {
    const path = match[1];
    const name = path.split('/').filter(Boolean).pop() || path;

    if (!routes.find(r => r.path === path)) {
      routes.push({ path, name, componentPath: null });
    }
  }

  return routes;
}

/**
 * 找到匹配的闭合括号位置（处理嵌套）
 * @param {string} str - 字符串
 * @param {number} start - 起始位置
 * @param {string} openChar - 开括号字符
 * @param {string} closeChar - 闭括号字符
 * @returns {number} 闭括号位置，未找到返回 -1
 */
function findMatchingBracket(str, start, openChar, closeChar) {
  let depth = 1;
  let i = start;

  while (i < str.length && depth > 0) {
    if (str[i] === openChar) depth++;
    else if (str[i] === closeChar) depth--;
    i++;
  }

  return depth === 0 ? i - 1 : -1;
}

/**
 * 扫描页面目录（views/pages/goal 等）
 * 按目录分组，识别页面/弹窗/布局组件
 *
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<Array<{name: string, fileCount: number, files: Array}>>}
 */
async function scanPages(projectRoot) {
  const modules = [];

  // 广泛匹配页面文件
  const pageFiles = await glob([
    '**/views/**/*.{vue,jsx,tsx}',
    '**/pages/**/*.{vue,jsx,tsx}',
    '**/src/**/*.vue',  // 广泛扫描 .vue 文件（如 sub-police 的 goal/ 目录）
  ], { cwd: projectRoot });

  // 按目录分组
  const dirGroups = {};

  for (const absPath of pageFiles) {
    const relPath = getRelativePath(absPath, projectRoot);

    // 排除非页面目录
    if (/node_modules|\/components\/|\/common\/|\/store\/|\/utils\/|\/api\/|\/hooks\/|\/lib\/|\/assets\/(js|css|img|scss)/i.test(relPath)) {
      continue;
    }

    // 判断组件类型（基于文件名规则）
    const fileName = path.basename(absPath, path.extname(absPath));
    let type = '组件';

    if (/(index|main|home|page|list)$/i.test(fileName)) type = '页面';
    else if (/dialog|modal|popup|drawer|form|add|edit|detail|create$/i.test(fileName)) type = '弹窗';
    else if (/layout|container|wrapper$/i.test(fileName)) type = '布局';

    // 提取所属模块名（取父目录名）
    const dirName = path.dirname(relPath).split('/').pop();

    if (!dirGroups[dirName]) {
      dirGroups[dirName] = { files: [] };
    }

    dirGroups[dirName].files.push({
      path: relPath,
      type,
      name: fileName,
    });
  }

  // 转换为数组并按文件数量排序
  for (const [moduleName, data] of Object.entries(dirGroups)) {
    modules.push({
      name: moduleName,
      fileCount: data.files.length,
      files: data.files,
    });
  }

  modules.sort((a, b) => b.fileCount - a.fileCount);
  return modules;
}

/**
 * 扫描公共组件目录（components/common）
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<Array<{name: string, path: string, group: string}>>}
 */
async function scanComponents(projectRoot) {
  const components = [];

  const compFiles = await glob([
    '**/components/**/*.{vue,jsx,tsx}',
    '**/common/**/*.{vue,jsx,tsx}',
  ], { cwd: projectRoot });

  for (const absPath of compFiles) {
    const relPath = getRelativePath(absPath, projectRoot);
    const fileName = path.basename(absPath, path.extname(absPath));
    const dirName = path.dirname(relPath).split('/').pop();

    components.push({
      name: fileName,
      path: relPath,
      group: dirName,
    });
  }

  return components;
}

/**
 * 扫描状态管理（store/stores）
 * 检测 Pinia/Vuex/Redux 框架
 *
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<{framework: string|null, modules: Array, files: string[]}>}
 */
async function scanStore(projectRoot) {
  const result = { framework: null, modules: [], files: [] };

  const storeFiles = await glob([
    '**/store/**/*.{js,ts}',
    '**/stores/**/*.{js,ts}',
    '**/store.{js,ts}',
  ], { cwd: projectRoot });

  result.files = storeFiles.map(f => getRelativePath(f, projectRoot));

  // 检测框架类型
  for (const absPath of storeFiles) {
    const content = readFileSafe(absPath);
    if (!content) continue;

    if (content.includes('defineStore') && !result.framework) result.framework = 'Pinia';
    else if (content.includes('createStore') && !result.framework) result.framework = 'Vuex';
    else if (content.includes('configureStore') && !result.framework) result.framework = 'Redux';
  }

  // 提取模块信息（排除 index/store 入口文件）
  for (const absPath of storeFiles) {
    const relPath = getRelativePath(absPath, projectRoot);
    const fileName = path.basename(absPath, path.extname(absPath));

    if (fileName !== 'index' && fileName !== 'store') {
      result.modules.push({
        name: fileName,
        path: relPath,
        exports: extractExports(readFileSafe(absPath) || '').slice(0, 8), // 最多取前8个导出
      });
    }
  }

  return result;
}

/**
 * 扫描 API 请求层（api/service/http）
 * 识别请求封装、接口定义、请求处理器等角色
 *
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<{files: Array}>}
 */
async function scanApiLayer(projectRoot) {
  const files = [];

  const apiFiles = await glob([
    '**/api/**/*.{js,ts}',
    '**/service/**/*.{js,ts}',
    '**/http/**/*.{js,ts}',
    '**/request*.{js,ts}',
  ], { cwd: projectRoot });

  for (const absPath of apiFiles) {
    const content = readFileSafe(absPath);
    const relPath = getRelativePath(absPath, projectRoot);
    const fileName = path.basename(absPath);

    // 尝试提取 baseURL
    let baseURL = '';
    if (content) {
      const urlMatch = content.match(/baseURL[:=]\s*['"`](.*?)['"`]/);
      if (urlMatch) baseURL = urlMatch[1];
    }

    files.push({
      name: fileName,
      path: relPath,
      baseURL,
      role: fileName.toLowerCase().includes('request') ? '请求封装' :
           fileName.toLowerCase().includes('handler') ? '请求处理器' :
           fileName.toLowerCase().includes('cancel') ? '取消请求' : '接口定义',
    });
  }

  return { files };
}

/**
 * 扫描工具函数（utils/helpers/lib/assets/js）
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<Array<{name: string, path: string, exports: string[]}>>}
 */
async function scanUtils(projectRoot) {
  const modules = [];

  const utilFiles = await glob([
    '**/utils/**/*.{js,ts}',
    '**/helpers/**/*.{js,ts}',
    '**/lib/**/*.{js,ts}',
    '**/assets/js/*.js',
  ], { cwd: projectRoot });

  for (const absPath of utilFiles) {
    const content = readFileSafe(absPath);
    const relPath = getRelativePath(absPath, projectRoot);
    const fileName = path.basename(absPath, path.extname(absPath));

    modules.push({
      name: fileName,
      path: relPath,
      exports: extractExports(content || '').slice(0, 10), // 最多取前10个导出
    });
  }

  return modules;
}

/**
 * 扫描样式资源（scss/less/css）
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<Array<{name: string, path: string, type: string}>>}
 */
async function scanStyles(projectRoot) {
  const files = [];

  const styleFiles = await glob([
    '*.scss', '*.less', '*.css',
    '**/styles/**/*.{scss,less,css}',
    '**/assets/css/**/*.{scss,less,css}',
  ], { cwd: projectRoot });

  for (const absPath of styleFiles) {
    const relPath = getRelativePath(absPath, projectRoot);
    const ext = path.extname(absPath);

    files.push({
      name: path.basename(absPath),
      path: relPath,
      type: ext.replace('.', ''),
    });
  }

  return files;
}

/**
 * 扫描配置项（环境变量、构建配置、TS配置等）
 * @param {string} projectRoot - 项目根目录
 * @returns {Promise<Array<{name: string, path: string, role: string}>>}
 */
async function scanConfigs(projectRoot) {
  const configs = [];

  const configPatterns = [
    '.env', '.env.*', '!.env.local',
    'vite.config.*', 'webpack.config.*', 'vue.config.*',
    'tsconfig*.json', 'jsconfig*.json',
    '*.config.js', '*.config.ts',
    'package.json',
  ];

  const configFiles = await glob(configPatterns, { cwd: projectRoot });

  for (const absPath of configFiles) {
    const relPath = getRelativePath(absPath, projectRoot);
    const fileName = path.basename(absPath);

    configs.push({
      name: fileName,
      path: relPath,
      role: fileName.startsWith('.') ? '环境变量' :
           fileName.includes('vite') ? 'Vite 配置' :
           fileName.includes('webpack') ? 'Webpack 配置' :
           fileName.includes('vue') ? 'Vue 配置' :
           fileName.includes('tsconfig') ? 'TS 配置' :
           fileName === 'package.json' ? '项目配置' : '其他配置',
    });
  }

  return configs;
}

/**
 * 计算页面模块总数
 * @param {Array} pageModules - 页面模块数组
 * @returns {number} 总文件数
 */
function countModules(pageModules) {
  return pageModules.reduce((sum, m) => sum + m.fileCount, 0);
}

module.exports = { scanFrontend };
