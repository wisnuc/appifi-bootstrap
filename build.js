var fs = require('fs');
var webpack = require('webpack')

var frontConfig = require('./webpack.config')
var backConfig = require('./backpack.config')

frontConfig.plugins = [ new webpack.optimize.UglifyJsPlugin() ]
backConfig.plugins = [ new webpack.optimize.UglifyJsPlugin() ]

// returns a Compiler instance
var f = webpack(frontConfig)

f.run((err, stats) => {
  if (err) {
    console.log(err)
    return
  }
  
  fs.createReadStream('./public/bundle.js')
    .on('close', () => {
      var b = webpack(backConfig)
      b.run((err, stats) => {
        if (err) {
          console.log(err)
          return
        }

        console.log('success')
      })
    })
    .pipe(fs.createWriteStream('./public/bundle.raw'))
});
