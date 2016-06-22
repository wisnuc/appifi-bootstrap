var fs = require('fs');

var Hashes = require('jshashes')
var webpack = require('webpack')

var frontConfig = require('./webpack.config')
var backConfig = require('./backpack.config')

frontConfig.plugins = [ new webpack.optimize.UglifyJsPlugin() ]
backConfig.plugins = [ new webpack.optimize.UglifyJsPlugin() ]

/**
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
**/

var input = backConfig.output.filename // path is neglected
var output = input + '.sha1'

function promisifyWebpack(config) {

  return new Promise((resolve, reject) => {
    var compiler = webpack(config)
    compiler.run((err, stats) => {
      // console.log(stats)
      err ? reject(err) : resolve(stats) 
    })
  })
}


function promisifyCopyBundleFile() {

  return new Promise((resolve, reject) => {
    
    var errFlag = false
    var input = fs.createReadStream('./public/bundle.js')
    var output = fs.createWriteStream('./public/bundle.raw')

    input.on('error', e => {
      errFlag = true
      reject(e)
    })
    
    output.on('error', e => {
      errFlag = true
      reject(e)
    })

    output.on('close', () => {
      if (!errFlag) resolve(null)
    })

    input.pipe(output)
  })
}

function promisifyWriteFile(filename, data) {

  return new Promise((resolve, reject) => {
    fs.writeFile(filename, data, { flag: 'w+' }, err => {
      err ? reject(err) : resolve(null)
    })
  })
}

function promisifyReadFile(filename) {

  return new Promise((resolve, reject) => {
    fs.readFile(filename, (err, data) => {
       err ? reject(err) : resolve(data) 
    })
  })
}

console.log('webpacking front end')
promisifyWebpack(frontConfig)
  .then(() => {
    console.log('copying bundle file')
    return promisifyCopyBundleFile()
  })
  .then(() => {
    console.log('webpacking back end')
    return promisifyWebpack(backConfig)
  })
  .then(() => {
    console.log('read ' + input)
    return promisifyReadFile(input)
  })
  .then(data => {
    console.log('prefix the file with hash, writing to ' + output)
    var text = data.toString()
    var SHA1 = new Hashes.SHA1
    var hash = SHA1.hex(text)
    return promisifyWriteFile(output, '//' + hash + '\n' + text) 
  })
  .then(() => {
    console.log('written to new file, reading back')
    return promisifyReadFile(output) 
  })
  .then(data => {
    console.log('verify hash')

    var text = data.toString()
    var newline = text.indexOf('\n')
    var hashString = text.slice(2, newline)
    var body = text.slice(newline + 1)

    var SHA1 = new Hashes.SHA1
    var bodyHash = SHA1.hex(body)

    console.log('hash string: ' + hashString)
    console.log('body hash: ' + bodyHash) 
  
    if (bodyHash === hashString)
      console.log('match!')
    else
      console.log('mismatch!')
  })
  .catch(e => {
    console.log('=== Error! ===')
    console.log(e)
  })



















