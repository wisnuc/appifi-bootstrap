
var webpack = require('webpack')
var path = require('path')
var fs = require('fs')

var nodeModules = []
fs.readdirSync('node_modules')
  .filter(x => {
    return ['.bin'].indexOf(x) === -1
  })
  .forEach(mod => {
    nodeModules[mod] = 'commonjs ' + mod;
  })

module.exports = {

  // base dir for resolving entry option
  context: __dirname,
  entry: './src/app',
  target: 'node',
  output: {
    path: __dirname,
    filename: 'compiled.js'
  },

  externals: nodeModules,

  module: {
    loaders: [
      {
        test: /\.jsx?$/,
/*        exclude: /node_modules/, */
        loader: 'babel-loader',
        query: {
          presets: ['es2015', 'stage-0']
        }
      },
      {
        test: /\.json$/,
        loader: 'json-loader'
      }
    ]
  },

  resolve: {
    moduleDirectories: [ 'node_modules'],
    extensions: ['', '.js', '.jsx']
  }
}
