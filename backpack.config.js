var nodeExternals = require('webpack-node-externals')

module.exports = {

  // base dir for resolving entry option
  context: __dirname,
  entry: './backpack',
  node: {
    __filename: false,
    __dirname: false,
  },
  target: 'node',
  externals: [nodeExternals({
    whitelist: ['express', 'body-parser', 'morgan',
      'rimraf', 'mkdirp', 'tar-stream', 'redux', 'request']
  })],
  output: {
    path: __dirname,
    filename: 'bootstrap.js'
  },

  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015', 'stage-0']
        }
      }
    ]
  },
}
