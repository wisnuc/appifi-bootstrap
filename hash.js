var fs = require('fs')
var Hashes = require('jshashes')

if (process.argv.length !== 3) {
  console.log('requires exactly one argument')
  process.exit(1)
}

var filename = process.argv[2]

if (filename.indexOf('/') !== -1) {
  console.log('no folder in path name allowed')
  process.exit(1)
}

if (!filename.endsWith('.js')) {
  console.log('filename must be suffixed by .js')
}

var output = filename + '.sha1'

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

promisifyReadFile(filename) // read file 
  .then(data => {
    var text = data.toString()
    var SHA1 = new Hashes.SHA1
    var hash = SHA1.hex(text)
    return promisifyWriteFile(output, '//' + hash + '\n' + text) 
  })
  .then(() => {
    console.log('written to new file, trying read back')
    return promisifyReadFile(output) 
  })
  .then(data => {
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
    console.log(e)
  })



