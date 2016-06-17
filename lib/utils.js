import fs from 'fs'
import url from 'url'
import child from 'child_process'
import zlib from 'zlib'

import rimraf from 'rimraf'
import mkdirp from 'mkdirp'
import tar from 'tar-stream'
import request from 'superagent'

// regex test num
const regNum = /^\d+$/
// regex test commit (hash)
const regCommit = /^[0-9a-f]+$/

export const describe = (e, desc) => {

  if (e.description === undefined || 
      !Array.isArray(e.description)) {

    e.description = [desc]
    return e 
  }
  e.description.push(desc)
  return e
}

export const createUrlObject = (urlString) => {

  return Object.assign({}, url.parse(urlString), {
    port: 443,
    method: 'GET',
    headers: {
      'Accept': '*/*',
      'User-Agent': 'NodeJS'
    }     
  })
}

export const parseJSON = (data) => {

  try {
    let result = JSON.parse(data)
    return result
  } 
  catch (e) {
    return describe(e, {
      when: 'parseJSON',
      data
    })
  }
}

export async function delay(duration) {

  return new Promise(resolve => 
    setTimeout(() => resolve(null), duration))
}

export async function rimrafAsync(path) {
  return new Promise(resolve => 
    rimraf(path, e => 
      e ? resolve(describe(e, {
          when: 'rimraf',
          path
        })) : resolve(null)))
}

export async function mkdirpAsync(path) {
  return new Promise(resolve => 
    mkdirp(path, e => 
      e ? resolve(describe(e, {
        when: 'mkdirp',
        path
      })) : resolve(null)))
}

export async function readdirAsync(path) {

  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, files) => {
      if (err) return resolve(describe(err, {
        when: 'readdir async',
        path: path
      }))

      resolve(files)
    })
  })
}

export async function readFileAsync(path) {

  return new Promise(resolve => {
    fs.readFile(path, (err, data) => {
      if (err) return resolve(describe(err, {
        when: 'readFile async',
        path 
      }))
      
      resolve(data)
    })
  })
}

export async function testTarballAsync(filepath) {

  return new Promise((resolve, reject) => {
    child.exec(`tar xOzf ${filepath} > /dev/null`, (err, stdout, stderr) => {
      if (err) {
        return resolve(describe(err, {
          when: 'test tar ball',
          stdout, stderr
        }))
      }
      resolve(null)
    })
  })
}

export function tarGzipCherryPick(tarpath, filepath, callback) {

  let gunzip = zlib.createGunzip()
  let extract = tar.extract() 
  let recording = false
  let stringBuffer = null
  let error = null

  extract.on('entry', function(header, stream, done) {
    recording = header.name === filepath ? true : false

    stream.on('data', data => {
      if (recording) {
        if (stringBuffer === null)
          stringBuffer = data.toString()
        else 
          stringBuffer += data.toString() 
      }
    })

    stream.on('end', () => {
      recording = false
      done()
    })

    stream.resume()
  })

  extract.on('error', e => 
    callback(describe(e, {
      when: 'cherry pick from tar.gz',
      tarpath, filepath
    })))

  extract.on('finish', () => {
    callback(null, stringBuffer)
  })

  fs.createReadStream(tarpath).pipe(gunzip).pipe(extract)
}

export async function tarGzipCherryPickAsync(tarpath, filepath) {

  return new Promise((resolve, reject) => {
    tarGzipCherryPick(tarpath, filepath, (err, result) => {
      err ? resolve(err) : resolve(result)
    })
  })
}

function tarballStripInject(oldpath, newpath, filename, data, callback) {

  let error = null
  let injected = false

  let oldTarballStream = fs.createReadStream(oldpath)
  let gunzip = zlib.createGunzip()
  let extract = tar.extract()
  let pack = tar.pack()
  let gzip = zlib.createGzip()
  let newTarballStream = fs.createWriteStream(newpath, { flags: 'w+' })

  // ugly error handlers for pipes, begin
  oldTarballStream.on('error', e => error = describe(e, {
    when: 'appifi tarball injection, read stream',
    oldpath, newpath, filename, data
  }))

  gunzip.on('error', e => error = describe(e, {
    when: 'appifi tarball injection, gunzip',
    oldpath, newpath, filename, data
  }))

  extract.on('error', e => error = describe(e, {
    when: 'appifi tarball injection, extract',
    oldpath, newpath, filename, data
  }))

  pack.on('error', e => describe(e, {
    when: 'appifi tarball injection, pack',
    oldpath, newpath, filename, data
  }))

  gzip.on('error', e => describe(e, {
    when: 'appifi tarball injection, gzip',
    oldpath, newpath, filename, data
  }))

  newTarballStream.on('error', e => error = describe(e, {
    when: 'appifi tarball injection, write stream',
    oldpath, newpath, filename, data
  }))
  // ugly error handlers for pipes, end
   
  extract.on('entry', function(header, stream, done) {

    // strip leading directory and prefix with dot
    header.name = '.' + header.name.slice(header.name.indexOf('/'))
   
    if (!injected) {
      let filepath = './' + filename
      if (header.name.localeCompare(filepath) > 0) { // Positive when the referenceStr occurs after compareStr
        pack.entry({name:filepath}, data)
        injected = true
      }
    }
        
    stream.pipe(pack.entry(header, done))
  })
   
  extract.on('finish', function() {
    if (!injected) {
      let filepath = './' + filename
      pack.entry({name:filepath}, data)
      injected = true
    }
    pack.finalize()
  })

  newTarballStream.on('close', () => {
    error ? callback(error) : callback(null)
  })
   
  // pipe the old tarball to the extractor 
  oldTarballStream.pipe(gunzip).pipe(extract)
   
  // pipe the new tarball the another stream 
  pack.pipe(gzip).pipe(newTarballStream)
}

export async function tarballStripInjectAsync(oldpath, newpath, filename, data) {

  return new Promise(resolve => 
    tarballStripInject(oldpath, newpath, filename, data, (err) => 
     resolve(err)))
}

export async function extractTarballAsync(tarpath, target) {

  let r
 
  r = await rimrafAsync(target)
  if (r instanceof Error)
    return describe(e, { when: 'extract tarball' })

  r = await mkdirpAsync(target)
  if (r instanceof Error)
    return describe(e, { when: 'extract tarball' })

  r = await new Promise(resolve => 
    child.exec(`tar xzf ${tarpath} -C ${target}`, (err, stdout, stderr) => 
      err ? resolve(describe(err, {
        when: 'extracting tarball',
        tarpath, stdout, stderr
      })) : resolve(null)))

  if (r instanceof Error)
    return describe(e, { when: 'extract tarball' })

  return null
}


function splitTagName(tagname) {

  if (typeof tagname !== 'string') return null
  let split = tagname.split('.')
  if (split.length !== 3) return null

  if (!split.every(name => regNum.test(name))) return null

  let major = parseInt(split[0])
  let minor = parseInt(split[1])
  let build = parseInt(split[2])

  return {
    name: tagname,
    major, minor, build,
    value: (major * 1000000 + minor * 1000 + build)
  }
}

function splitFileName(filename) {

  let prefix = 'appifi-'
  let suffix = '.tar.gz'

  if (!filename.startsWith(prefix) || !filename.endsWith(suffix)) return null

  let infix = filename.slice(prefix.length, -suffix.length)  
  let split = infix.split('-')
  if (split.length != 4) return null

  let tag = splitTagName(split[0])
  if (!tag) return null

  let id = split[1]
  if (!regNum.test(id)) return null

  let commit = split[2]
  if (!regCommit.test(commit)) return null

  if (split[3] !== 'pre' && split[3] !== 'rel') return null
  let prerelease = split[3] === 'pre' ? true : false

  return { filename, tag, id, commit, prerelease } 
}

async function _probeTarballs(tarballsDir) {

  let r

  r = await mkdirpAsync(tarballsDir)
  if (r instanceof Error) return r 

  r = await readdirAsync(tarballsDir)
  if (r instanceof Error) return r

  return r.map(f => splitFileName(f))
          .filter(f => f !== null)
          .sort((a, b) => b.tag.value - a.tag.value)
}

export function tagValue(tagname) {

  let split = tagname.split('.')
  let major = parseInt(split[0])
  let minor = parseInt(split[1])
  let build = parseInt(split[2])

  return major * 1000000 + minor * 1000 + build
}

export async function probeTarballs(tarballsDir) {

  let r
  
  r = await mkdirpAsync(tarballsDir)
  if (r instanceof Error) return r

  r = await readdirAsync(tarballsDir)
  if (r instanceof Error) return r

  let balls = []
  let filenames = r
  for (let i = 0; i < filenames.length; i++) {

    let summary = splitFileName(filenames[i])
    if (!summary) continue

    let path = `${tarballsDir}/${filenames[i]}`
    r = await testTarballAsync(path) 
    if (r instanceof Error) continue

    r = await tarGzipCherryPickAsync(path, './.release.json')
    if (r instanceof Error) continue

    r = parseJSON(r)
    if (r instanceof Error) continue

    let release = r
    balls.push({ release, path })
  }

  balls.sort((a, b) => tagValue(b.release.tag_name) - tagValue(a.release.tag_name))
  return balls
}

export async function retrieveReleasesAsync(urlString) {

  return new Promise(resolve => {
    request
      .get(urlString)
      .set('Accept', 'application/json')
      .end((err, res) => {
        if (err) {
          resolve(describe(err, {
            when: 'retrieve releases, agent error',
            url: urlString
          }))
        }
        else if (!res.ok) {
          resolve(describe(err, {
            when: 'retrieve releases, res not ok',
            url: urlString
          })) 
        }
        else {
          resolve(res.body) 
        }
      })
  })
}

// return release file data, or null if not 
export async function probeAppifi() {

  let result
  result = await readFileAsync('appifi/.release.json')
  if (result instanceof Error) {
    return describe(result, {
      when: 'probeAppifi'
    })
  } 

  result = parseJSON(result)
  if (result instanceof Error) {
    return describe(result, {
      when: 'probeAppifi'
    })
  }

  return result
}


