const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo workspace (merge with defaults)
config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

// 2. Prioritize project node_modules over workspace root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Absolute single-instance resolution for React, React-DOM, and React Native Web
const reactPkgPath = require.resolve('react/package.json', { paths: [projectRoot] });
const reactDir = path.dirname(reactPkgPath);

const reactDomPkgPath = require.resolve('react-dom/package.json', { paths: [projectRoot] });
const reactDomDir = path.dirname(reactDomPkgPath);

const reactNativeWebPkgPath = require.resolve('react-native-web/package.json', { paths: [projectRoot] });
const reactNativeWebDir = path.dirname(reactNativeWebPkgPath);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react') {
    return {
      type: 'sourceFile',
      filePath: path.join(reactDir, 'index.js'),
    };
  }
  if (moduleName === 'react/jsx-runtime' || moduleName === 'react/jsx-runtime.js') {
    return {
      type: 'sourceFile',
      filePath: path.join(reactDir, 'jsx-runtime.js'),
    };
  }
  if (moduleName === 'react/jsx-dev-runtime' || moduleName === 'react/jsx-dev-runtime.js') {
    return {
      type: 'sourceFile',
      filePath: path.join(reactDir, 'jsx-dev-runtime.js'),
    };
  }
  if (moduleName === 'react-dom') {
    return {
      type: 'sourceFile',
      filePath: path.join(reactDomDir, 'index.js'),
    };
  }
  if (moduleName === 'react-dom/client') {
    return {
      type: 'sourceFile',
      filePath: path.join(reactDomDir, 'client.js'),
    };
  }
  if (moduleName === 'react-native-web') {
    return {
      type: 'sourceFile',
      filePath: path.join(reactNativeWebDir, 'dist', 'index.js'),
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.platforms = ['ios', 'android', 'web'];

module.exports = withNativeWind(config, { input: './global.css' });
