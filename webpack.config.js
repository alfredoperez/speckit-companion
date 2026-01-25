//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

/**@type {import('webpack').Configuration}*/
const extensionConfig = {
  target: 'node', // VS Code extensions run in Node.js environment
  mode: 'none', // Use 'none' or 'development' for dev, 'production' for release

  entry: './src/extension.ts', // Extension entry point
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
    extensions: ['.ts', '.js']
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
              configFile: 'tsconfig.json'
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
const webviewConfig = {
  target: 'web', // Webview runs in browser context
  mode: 'none',

  entry: './webview/src/workflow.ts', // Webview entry point
  output: {
    path: path.resolve(__dirname, 'dist', 'webview'),
    filename: 'workflow.js',
    libraryTarget: 'window'
  },
  resolve: {
    extensions: ['.ts', '.js']
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
              configFile: 'tsconfig.webview.json'
            }
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  plugins: [
    new CopyPlugin({
      patterns: [
        // Copy CSS files to webview output
        { from: 'webview/styles/workflow.css', to: 'workflow.css' },
        { from: 'webview/styles/spec-markdown.css', to: 'spec-markdown.css' }
      ]
    })
  ]
};

/**@type {import('webpack').Configuration}*/
const specEditorConfig = {
  target: 'web', // Webview runs in browser context
  mode: 'none',

  entry: './webview/src/spec-editor/index.ts', // Spec editor entry point
  output: {
    path: path.resolve(__dirname, 'dist', 'webview'),
    filename: 'spec-editor.js',
    libraryTarget: 'window'
  },
  resolve: {
    extensions: ['.ts', '.js']
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
              configFile: 'tsconfig.webview.json'
            }
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  plugins: [
    new CopyPlugin({
      patterns: [
        // Copy spec-editor CSS to webview output
        { from: 'webview/styles/spec-editor.css', to: 'spec-editor.css' }
      ]
    })
  ]
};

/**@type {import('webpack').Configuration}*/
const specViewerConfig = {
  target: 'web', // Webview runs in browser context
  mode: 'none',

  entry: './webview/src/spec-viewer/index.ts', // Spec viewer entry point
  output: {
    path: path.resolve(__dirname, 'dist', 'webview'),
    filename: 'spec-viewer.js',
    libraryTarget: 'window'
  },
  resolve: {
    extensions: ['.ts', '.js']
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
              configFile: 'tsconfig.webview.json'
            }
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  plugins: [
    new CopyPlugin({
      patterns: [
        // Copy spec-viewer CSS to webview output
        { from: 'webview/styles/spec-viewer.css', to: 'spec-viewer.css' },
        // Copy spec-viewer CSS partials (for @import resolution)
        { from: 'webview/styles/spec-viewer', to: 'spec-viewer' }
      ]
    })
  ]
};

module.exports = [extensionConfig, webviewConfig, specEditorConfig, specViewerConfig];
