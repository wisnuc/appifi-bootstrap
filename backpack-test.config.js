module.exports = {

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
  }
}

