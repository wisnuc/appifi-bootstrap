
module.exports = {

  // base dir for resolving entry option
  context: __dirname,
  entry: ['./backpack'],
  node: {
    __filename: false,
    __dirname: false,
  },
  target: 'node',
  output: {
    path: __dirname,
    filename: 'bootstrap.js'
  },

  module: {

    preLoaders: [
        { test: /\.json$/, loader: 'json'},
    ],

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
