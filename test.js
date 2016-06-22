var fs = require('fs')

fs.readFile('nonexist', (err, data) => {
  console.log(err.code)
  console.log(err.errno)
})
