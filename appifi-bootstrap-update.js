// step 1: retrieve file release => bootstrap.js.sha1
// step 2: write to tmpfile /wisunuc/bootstrap.js.tmp
// step 3: read back, verify
// step 4: compare with /wisnuc/bootstrap.js.sha1 if not same, overwrite it

// https://raw.githubusercontent.com/wisnuc/appifi-bootstrap/release/bootstrap.js.sha1

var fs = require('fs')
var child = require('child_process')
var https = require('https')

var Hashes = require('jshashes')

var basefile = '/wisnuc/bootstrap/appifi-bootstrap.js'
var tmpfile = basefile + '.tmp'
var sha1file = basefile + '.sha1'

function headerHash(text) {

  var newline = text.indexOf('\n')
  if (newline === -1) return null

  var header = text.slice(0, newline)
  if (!header.startsWith('//')) return null

  return header.slice(2)
}

function promisifyMkdirp(pathname, context) {

  return new Promise((resolve, reject) => {
    child.exec('mkdir -p ' + pathname, (err, stdout, stderr) => {
      if (err) {
        console.log('mkdirp ERROR')
        reject(err) 
      }
      else {
        console.log('mkdirp OK')
        resolve(context) 
      }
    })
  })
}

function promisifyReadCurrentHash(context) {

  return new Promise((resolve, reject) => {
    fs.readFile(sha1file, (err, data) => {
      if (err && err.code === 'ENOENT') {
        context.currentHash = null
        console.log('no current sha1file')
        resolve(context)
      }
      else if (err) {
        console.log('read current sha1file ERROR')
        reject(err) 
      }
      else {
        context.currentHash = headerHash(data.toString())
        console.log('current sha1file hash: ' + context.currentHash)
        resolve(context) 
      }
    })
  })
}

function promisifyRetrieveBootstrapLatest(context) {

  var buffer = null
  var errFlag = false

  return new Promise((resolve, reject) => {

    var options = {
      hostname: 'raw.githubusercontent.com',
      port: 443,
      path: '/wisnuc/appifi-bootstrap/release/bootstrap.js.sha1',
      method: 'GET'
    };

    var req = https.request(options, (res) => {

      console.log('response status code: ' + res.statusCode)

      if (res.statusCode !== 200) {
        console.log('response not 200, reject')
        errFlag = true
        var e = new Error('Status code not 200')
        e.errno = 'EHTTPSTATUS'
        return reject(e)
      }

      res.on('data', function(data) {
        
        if (buffer === null) 
          buffer = data
        else 
          buffer += data
      })
      
      res.on('error', function(e) {
        console.log('response error, reject')
        errFlag =true
        reject(e)
      }) 

      res.on('end', () => {

        if (errFlag) return // already rejected 

        console.log('response end')
        context.latest = buffer.toString()
        resolve(context)
      })
    });

    req.on('error', (e) => {
      console.log('request error, reject')
      errFlag = true
      reject(e)
    });

    req.end();
    console.log('request sent to retrieve latest bootstrap')
  })
}

function promisifyWriteFile(filename, data, context) {

  console.log('writing data to ' + filename)
  return new Promise((resolve, reject) => {
    fs.writeFile(filename, data, { flag: 'w+' }, err => {
      if (err) {
        console.log('writing to file failed, reject')
        console.log('stdout: ' + stdout)
        console.log('stderr: ' + stderr)
        reject(err) 
      }
      else {
        console.log('writing to file success')
        resolve(context)
      }
    })
  })
}

function promisifyReadFile(filename, prop, context) {

  console.log('reading back ' + filename)
  return new Promise((resolve, reject) => {
    fs.readFile(filename, (err, data) => {
      if (err) { 
        console.log('reading back failed, reject')
        return reject(err)
      }
      console.log('reading back success, resolve')
      context[prop] = data.toString()
      resolve(context)
    })
  })
}

function promisifyCompareHash(context) {

  if (context.latest === undefined || context.latest === null) {
    console.log('latest empty, reject. ERROR')
  }

  var latestHash = headerHash(context.latest)

  console.log('current hash: ' + context.currentHash)
  console.log('latest hash: ' + latestHash)
  if (latestHash === context.currentHash) {
    console.log('latest equals to current, reject')
    return Promise.reject('LATEST_HASH_EQUAL')
  } 
  else {
    console.log('latest not equals to current, resolve')
    return Promise.resolve(context)
  }
}

function promisifyVerifyReadback(context) {

  if (context.readback === context.latest) {
    console.log('readback equals to latest')
  }
  else {
    console.log('readback not equals to latest')
  }
 
  var text = context.latest 
  var newline = text.indexOf('\n')
  var hashString = text.slice(2, newline)
  var body = text.slice(newline + 1)

  console.log(body)

  var SHA1 = new Hashes.SHA1
  var bodyHash = SHA1.hex(body)

  console.log('hash string: ' + hashString)
  console.log('body hash: ' + bodyHash)
  if (bodyHash === hashString) {
    console.log('match, resolve')
    return Promise.resolve(context)
  }
  else {
    console.log('mismatch, reject')
    return Promise.reject('READBACK_HASH_MISMATCH')
  }
}

function promisifyFinalMove(context) {

  return new Promise((resolve, reject) => { 
    child.exec('mv ' + tmpfile + ' ' + sha1file , (err, stdout, stderr) => {
      if (err) return reject(err)
      resolve(context)   
    })
  }) 
}

var context = {}

promisifyMkdirp('/wisnuc/bootstrap', context)
  .then(context => 
    promisifyReadCurrentHash(context))
  .then(context => 
    promisifyRetrieveBootstrapLatest(context))
  .then(context => 
    promisifyCompareHash(context))   
  .then(context => 
    promisifyWriteFile('/wisnuc/bootstrap/appifi-bootstrap.js.tmp', context.latest, context))
  .then(context => 
    promisifyReadFile('/wisnuc/bootstrap/appifi-bootstrap.js.tmp', 'readback', context))
  .then(context => 
    promisifyVerifyReadback(context))
  .then(context => 
    promisifyFinalMove(context))
  .then(context => {
    console.log('success')
  })
  .catch(e => {
    console.log('skipped or failed')
    console.log(e)
  })


