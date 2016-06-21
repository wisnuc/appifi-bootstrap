var fs = require('fs')

var nodeExternals = require('webpack-node-externals')

nodeModules = {}
fs.readdirSync('node_modules')
  .filter(x => ['.bin'].indexOf(x) === -1)
  .forEach(mod => {
    nodeModules[mod] = 'commonjs ' + mod
  })

// nodeModules['babel-polyfill'] = 'commonjs babel-polyfill'

console.log(nodeModules)

module.exports = {

  // base dir for resolving entry option
  context: __dirname,
  entry: ['babel-polyfill', './backpack'],
  node: {
    __filename: false,
    __dirname: false,
  },
  target: 'node',
  externals: [nodeExternals({
    whitelist: ['express', 'body-parser', 'morgan',
      'rimraf', 'mkdirp', 'tar-stream', 'redux', 'request']})],
/*
  externals: [nodeExternals({
    whitelist: ['express', 'body-parser', 'morgan',
      'rimraf', 'mkdirp', 'tar-stream', 'redux', 'request', 'babel-register', 'babel-polyfill', 'babel-runtime', 'babel-register',
      'babel-runtime/regenerator',
      'regenerator-runtime',
      'babel-runtime/helpers/asyncToGenerator',
      'core-js/library/fn/promise',
      'babel-runtime/helpers/toConsumableArray',
      'core-js/library/fn/array/from', 
      'babel-runtime/core-js/object/assign', 
'core-js/library/fn/object/assign',
'glob',
'minimatch',
'brace-expansion',
'concat-map',
'balanced-match',
'inherits',
'path-is-absolute',
'inflight',
'wrappy',
'once',
'lodash/isPlainObject',
'symbol-observable',
'babel-runtime/core-js/json/stringify',
'core-js/library/fn/json/stringify',
'core-js/shim',
'regenerator-runtime/runtime',
'core-js/fn/regexp/escape',
'babel-runtime/core-js/object/get-prototype-of',
'core-js/library/fn/object/get-prototype-of',
'babel-runtime/helpers/classCallCheck',
'babel-runtime/helpers/possibleConstructorReturn',
'core-js/library/fn/symbol/iterator',
'core-js/library/fn/symbol',
'babel-runtime/helpers/createClass',
'core-js/library/fn/object/define-property',
'babel-runtime/helpers/inherits',
'core-js/library/fn/object/set-prototype-of',
'core-js/library/fn/object/create',
'babel-runtime/core-js/promise',
'bl',
'readable-stream/duplex',
'process-nextick-args',
'core-util-is',
'isarray',
'util-deprecate',
'xtend',
'readable-stream',
'buffer-shims',
'end-of-stream',
'extend',
'tough-cookie',
      ]
  })],
*/
//  externals: nodeModules,
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
          presets: ['es2015', 'stage-0'],
          plugins: [
            "syntax-async-functions", 
            "transform-regenerator", 
            "transform-es2015-template-literals",
            "transform-runtime"]
        }
      }
    ]
  },

}
