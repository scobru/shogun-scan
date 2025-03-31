const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: {
    background: './src/background/index.ts',
    popup: './src/popup/index.ts',
    options: './src/options/index.ts',
    content: './src/content/index.ts',
    'window-provider': './src/content/window-provider.ts',
    connect: './src/connect/index.ts'
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      // Reindirizza le importazioni di shogun-core al file shogun-core.js pre-compilato
      'shogun-core': path.resolve(__dirname, './src/shogun-core.js'),
    },
    fallback: {
      // Fornire polyfill per moduli Node.js usati da GUN
      "stream": require.resolve("stream-browserify"),
      "crypto": require.resolve("crypto-browserify"),
      "buffer": require.resolve("buffer/"),
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "url": require.resolve("url/"),
      "zlib": require.resolve("browserify-zlib"),
      "path": require.resolve("path-browserify"),
      "fs": false,
      "net": false
    }
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_DEBUG': JSON.stringify(process.env.NODE_DEBUG),
    }),
    new CopyPlugin({
      patterns: [
        { 
          from: 'public', 
          to: '.',
          globOptions: {
            ignore: ['**/*.html'], // Ignora tutti i file HTML per evitare conflitti
          }
        }
      ],
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
      template: './src/options/options.html', // Cambiato da index.html a options.html
      filename: 'options.html',
      chunks: ['options'],
    }),
    new HtmlWebpackPlugin({
      template: './public/connect.html',
      filename: 'connect.html',
      chunks: ['connect'],
    }),
  ],
}; 