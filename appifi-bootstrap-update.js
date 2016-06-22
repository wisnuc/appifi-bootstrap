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

var remotePath = '/wisnuc/appifi-bootstrap/release/bootstrap.js.sha1' 
// var remotePath = '/wisnuc/appifi-bootstrap/release/test.js.sha1'

function headerHash(text) {

  var newline = text.indexOf('\n')
  if (newline === -1) return null

  var header = text.slice(0, newline)
  if (!header.startsWith('//')) return null

  return header.slice(2)
}

function promisifyMkdirp(pathname, context) {

  return new Promise(function(resolve, reject) {
    child.exec('mkdir -p ' + pathname, function(err, stdout, stderr) {
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

  return new Promise(function(resolve, reject) {
    fs.readFile(sha1file, function (err, data) {
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

  var buffers = []
  var errFlag = false

  return new Promise(function(resolve, reject) {

    var options = {
      hostname: 'raw.githubusercontent.com',
      port: 443,
      path: remotePath,
      method: 'GET'
    };

    var req = https.request(options, function(res) {

      console.log('response status code: ' + res.statusCode)

      if (res.statusCode !== 200) {
        console.log('response not 200, reject')
        errFlag = true
        var e = new Error('Status code not 200')
        e.errno = 'EHTTPSTATUS'
        return reject(e)
      }

      res.on('data', function(data) {
        buffers.push(data)
      })
      
      res.on('error', function(e) {
        console.log('response error, reject')
        errFlag =true
        reject(e)
      }) 

      res.on('end', function() {

        if (errFlag) return // already rejected 

        console.log('response end')
        context.latest = Buffer.concat(buffers)
        
        console.log('concatenated buffer length: ' + context.latest.length)
        resolve(context)
      })
    });

    req.on('error', function(e) {
      console.log('request error, reject')
      errFlag = true
      reject(e)
    });

    req.end();
    console.log('request sent to retrieve latest bootstrap')
  })
}

function promisifyWriteFile(filename, data, context) {

  console.log('writing data to ' + filename + ', length: ' + data.length)
  return new Promise(function(resolve, reject) {
    fs.writeFile(filename, data, { flag: 'w+' }, function(err) {
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
  return new Promise(function (resolve, reject) {
    fs.readFile(filename, function(err, data) {
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

  var latestHash = headerHash(context.latest.toString())

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

  if (context.readback.toString() === context.latest.toString()) {
    console.log('readback equals to latest, continue')
  }
  else {
    console.log('readback not equals to latest, reject, ERROR')
    return reject('READBACK_MISMATCH_DOWNLOADED')
  }
 
  var text = context.latest.toString()
  var newline = text.indexOf('\n')
  var hashString = text.slice(2, newline)
  var body = text.slice(newline + 1)

  var SHA1 = new Hashes.SHA1
  var bodyHash = SHA1.hex(body)

  console.log('hash string: ' + hashString)
  console.log('body hash: ' + bodyHash)
  if (bodyHash === hashString) {
    console.log('integrity check, match, resolve')
    return Promise.resolve(context)
  }
  else {
    console.log('integrity check, mismatch, reject, ERROR')
    return Promise.reject('READBACK_HASH_MISMATCH')
  }
}

function promisifyFinalMove(context) {

  return new Promise(function(resolve, reject) { 
    child.exec('mv ' + tmpfile + ' ' + sha1file , function(err, stdout, stderr) {
      if (err) return reject(err)
      resolve(context)   
    })
  }) 
}

var context = {}

promisifyMkdirp('/wisnuc/bootstrap', context)
  .then(function(context) {
    return promisifyReadCurrentHash(context)
  })
  .then(function(context) {
    return promisifyRetrieveBootstrapLatest(context)
  })
  .then(function(context) {
    return promisifyCompareHash(context)
  })
  .then(function(context) {
    return promisifyWriteFile('/wisnuc/bootstrap/appifi-bootstrap.js.tmp', context.latest, context)
  })
  .then(function(context) {
    return promisifyReadFile('/wisnuc/bootstrap/appifi-bootstrap.js.tmp', 'readback', context)
  })
  .then(function(context) {
    return promisifyVerifyReadback(context)
  })
  .then(function(context) {
    return promisifyFinalMove(context)
  })
  .then(function(context) {
    console.log('success')
  })
  .catch(function(e) {
    console.log('skipped or failed')
    console.log(e)
  })


