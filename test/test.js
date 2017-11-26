const fs = require('fs')
const request = require('superagent')

let x = request
  .get('https://api.github.com/repos/wisnuc/appifi-release/tarball/0.9.14')
  .on('response', res => {
    console.log(res.header)
  })  

let y = fs.createWriteStream('y')

x.pipe(y)
