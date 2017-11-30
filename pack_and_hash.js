const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const webpack = require('webpack')
const config = {

  context: __dirname,
  entry: ['./src/app2.js'],
  node: {
    __filename: false,
    __dirname: false,
  },
  target: 'node',
  output: {
    path: __dirname,
    filename: 'appifi-bootstrap-test.js'
  },
  module: {
    preLoaders: [
        { test: /\.json$/, loader: 'json'},
    ],
  },
}

const compiler = webpack(config)

compiler.run((err, stats) => {
  console.log(err, stats)
})


