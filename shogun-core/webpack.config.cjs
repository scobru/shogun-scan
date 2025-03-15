// webpack.config.cjs
const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: './src/browser.ts',
  output: {
    path: path.resolve(__dirname, './dist/browser'),
    filename: 'shogun-core.js',
    library: {
      name: 'ShogunCore',
      type: 'umd',
      export: 'default',
    },
    globalObject: 'this',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      util: require.resolve('util/'),
      path: require.resolve('path-browserify'),
      fs: false,
      os: require.resolve('os-browserify/browser'),
      process: require.resolve('process/browser'),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    }),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
}; 