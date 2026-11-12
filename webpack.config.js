//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

// The viewer package ships TypeScript source under the `source` export condition.
const sourceFirst = ['source', '...'];

// `/core` reads live navigation state through its own signals module, a plain holder.
// The extension points that module at its real signal, so the renderer stays live.
const viewerSignalsTarget = path.resolve(__dirname, 'apps/vscode/webview/src/spec-viewer/signals.ts');
const viewerSignals = new webpack.NormalModuleReplacementPlugin(
  /packages[\\/]viewer[\\/]src[\\/]core[\\/]signals\.ts$/,
  (resolveData) => {
    const data = resolveData.createData;
    if (!data || !data.resource) return;
    for (const key of ['request', 'userRequest', 'rawRequest']) {
      if (typeof data[key] === 'string') data[key] = data[key].split(data.resource).join(viewerSignalsTarget);
    }
    data.resource = viewerSignalsTarget;
    data.context = path.dirname(viewerSignalsTarget);
  }
);

/**@type {import('webpack').Configuration}*/
const extensionConfig = {
  target: 'node', // VS Code extensions run in Node.js environment
  mode: 'none', // Use 'none' or 'development' for dev, 'production' for release

  entry: './apps/vscode/src/extension.ts', // Extension entry point
  output: {
    // Output location for bundled files
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode' // vscode module is external dependency, don't bundle
  },
  resolve: {
    // Support TypeScript and JavaScript files
    extensions: ['.ts', '.js'],
    conditionNames: sourceFirst
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.json',
              // The bundle pulls in the viewer package's source; rootDir only shapes tsc's own output.
              compilerOptions: { rootDir: '.' }
            }
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map', // Generate source maps for debugging
  infrastructureLogging: {
    level: "log", // Enable logging
  }
};

/**@type {import('webpack').Configuration}*/
const specEditorConfig = {
  target: 'web', // Webview runs in browser context
  mode: 'none',

  entry: './apps/vscode/webview/src/spec-editor/index.ts', // Spec editor entry point
  output: {
    path: path.resolve(__dirname, 'dist', 'webview'),
    filename: 'spec-editor.js',
    libraryTarget: 'window'
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    conditionNames: sourceFirst
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.webview.json'
            }
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  plugins: [
    viewerSignals,
    new CopyPlugin({
      patterns: [
        // Copy spec-editor CSS to webview output
        { from: 'apps/vscode/webview/styles/spec-editor.css', to: 'spec-editor.css' }
      ]
    })
  ]
};

/**@type {import('webpack').Configuration}*/
const processCreateConfig = {
  ...specEditorConfig,
  entry: './apps/vscode/webview/src/process-create/index.ts',
  output: { ...specEditorConfig.output, filename: 'process-create.js' },
  plugins: [viewerSignals]
};

/**@type {import('webpack').Configuration}*/
const specViewerConfig = {
  target: 'web', // Webview runs in browser context
  mode: 'none',

  entry: './apps/vscode/webview/src/spec-viewer/index.tsx', // Spec viewer entry point
  output: {
    path: path.resolve(__dirname, 'dist', 'webview'),
    filename: 'spec-viewer.js',
    libraryTarget: 'window'
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    conditionNames: sourceFirst
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.webview.json'
            }
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  plugins: [
    viewerSignals,
    new CopyPlugin({
      patterns: [
        // Copy spec-viewer CSS to webview output
        { from: 'apps/vscode/webview/styles/spec-viewer.css', to: 'spec-viewer.css' },
        // The viewer package's built, scoped stylesheet and its themes (for @import resolution)
        { from: 'packages/viewer/dist/styles', to: 'viewer' },
        // The install banner the viewer and the spec editor share
        { from: 'apps/vscode/webview/styles/_install-banner.css', to: '_install-banner.css' },
        // Shared design tokens — imported by every webview stylesheet
        { from: 'apps/vscode/webview/styles/tokens.css', to: 'tokens.css' },
        // Bundled @vscode/codicons (offline loading)
        { from: 'node_modules/@vscode/codicons/dist/codicon.css', to: 'codicons/codicon.css' },
        { from: 'node_modules/@vscode/codicons/dist/codicon.ttf', to: 'codicons/codicon.ttf' }
      ]
    })
  ]
};

/**@type {import('webpack').Configuration}*/
const pipelineBuilderConfig = {
  target: 'web',
  mode: 'none',

  entry: './apps/vscode/webview/src/pipeline-builder/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist', 'webview'),
    filename: 'pipeline-builder.js',
    libraryTarget: 'window'
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    conditionNames: sourceFirst
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.webview.json'
            }
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  plugins: [
    viewerSignals,
    new CopyPlugin({
      patterns: [
        { from: 'apps/vscode/webview/styles/pipeline-builder.css', to: 'pipeline-builder.css' }
      ]
    })
  ]
};

module.exports = [extensionConfig, specEditorConfig, processCreateConfig, specViewerConfig, pipelineBuilderConfig];
