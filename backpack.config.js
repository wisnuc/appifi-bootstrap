console.log(__dirname)

module.exports = {

  // base dir for resolving entry option
  context: __dirname,
  entry: './app',
  target: 'node',
  output: {
    path: __dirname,
    filename: 'compiled.js'
  },

  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015', 'react']
        }
      }
    ]
  },

  resolve: {
    moduleDirectories: [ 'node_modules'],
    extensions: ['', '.js', '.jsx']
  }
}
