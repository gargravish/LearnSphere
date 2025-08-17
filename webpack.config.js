const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      popup: './src/pages/popup/index.tsx',
      content: './src/content/index.ts',
      background: './src/background/index.ts',
      options: './src/pages/options/index.tsx',
      viewer: './src/pages/viewer/index.ts'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          // Exclude tests from the extension bundle build
          exclude: [/node_modules/, /__tests__/, /\.test\.ts$/, /\.test\.tsx$/]
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader'
          ]
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css'
      }),
      new HtmlWebpackPlugin({
        template: './src/pages/popup/index.html',
        filename: 'popup.html',
        chunks: ['popup']
      }),
      new HtmlWebpackPlugin({
        template: './src/pages/options/index.html',
        filename: 'options.html',
        chunks: ['options']
      }),
      new HtmlWebpackPlugin({
        template: './src/pages/viewer/index.html',
        filename: 'viewer.html',
        chunks: ['viewer']
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'public',
            to: '.'
          },
          {
            from: 'src/manifest.json',
            to: 'manifest.json'
          },
          {
            from: 'node_modules/pdfjs-dist/build/pdf.min.mjs',
            to: 'pdf.min.mjs'
          },
          {
            from: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
            to: 'pdf.worker.min.mjs'
          }
          ,
          {
            from: 'node_modules/pdfjs-dist/web/pdf_viewer.mjs',
            to: 'pdf_viewer.mjs'
          },
          {
            from: 'node_modules/pdfjs-dist/web/pdf_viewer.css',
            to: 'pdf_viewer.css'
          },
          {
            from: 'node_modules/pdfjs-dist/web/images',
            to: 'images'
          }
        ]
      })
    ],
    devtool: isProduction ? false : 'cheap-module-source-map',
    // For Chrome extensions, keep each entrypoint as a single file to
    // avoid runtime chunk loading issues in content scripts.
    optimization: {
      splitChunks: {
        cacheGroups: {
          default: false,
          vendors: false
        }
      },
      runtimeChunk: false
    }
  };
};
