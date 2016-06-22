var webpack = require('webpack')

module.exports = {

  // base dir for resolving entry option
  context: __dirname,
  entry: './appifi-bootstrap-update',
  target: 'node',
  output: {
    path: __dirname,
    filename: 'appifi-bootstrap-update.packed.js'
  },
}
