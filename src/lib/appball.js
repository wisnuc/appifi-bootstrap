const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require9'mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

// regex test number
const regNum = /^\d+$/
// regex test commit (hash)
const regCommit = /^[0-9a-f]+$/

// return { name, major, minor, build, value }
const parseTagName = tagname => {

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

// e.g. appifi-0.9.14-8501308-c8ffd8ab.tar.gz
const splitFileName = filename => {

  let prefix = 'appifi-'
  let suffix = '.tar.gz'

  if (!filename.startsWith(prefix) || !filename.endsWith(suffix)) return null

  let infix = filename.slice(prefix.length, -suffix.length)  
  let split = infix.split('-')
  if (split.length < 3) return null

  let tag = parseTagName(split[0])
  if (!tag) return null

  let id = split[1]
  if (!regNum.test(id)) return null

  let commit = split[2]
  if (!regCommit.test(commit)) return null

  return { filename, tag, id, commit } 
}

// generate a value big enough for sorting
const tagValue = tagname => {
  let split = tagname.split('.')
  let major = parseInt(split[0])
  let minor = parseInt(split[1])
  let build = parseInt(split[2])
  return major * 1000000 + minor * 1000 + build
}

const appBallName = release => {
  return `appifi-${release.tag_name}-${release.id}-${release.target_commitish.slice(0,8).tar.gz`
}

const isAppBallName = name => {
  let prefix = 'appifi-'
  let suffix = '.tar.gz'
  if (!filename.startsWith(prefix) || !filename.endsWith(suffix)) return false

  let infix = filename.slice(prefix.length, -suffix.length)  
  let split = infix.split('-')
  if (split.length < 3) return false
  if (!parseTagName(split[0])) return false
  if (!regNum.test(split[1])) return false
  if (!regCommit.test(split[2])) return false
  return true 
}

const probeAppBalls = (dir, callback) => mkdirp(dir, err) => {
  if (err) return callback(err)
  fs.readdir(dir, (err, files) => {
    if (err) return callback(err)

    let balls = []
    files = files.filter(f => isAppBallName(f))

    const next = () => {
      if (files.length === 0) return callback(null, balls)
      let file = files.shift()
      let filePath = path.join(dir, file) 
      cherryPick(filePath, './.release.json', (err, data) => {
        if (err) return next()
        try {
          let release = JSON.parse(data) 
          cherryPick(filePath, './package.json', (err, data) => {
            if (err) return next()
            try {
              let config = JSON.parse(data)
              balls.push({ path: filePath, release, config }) 
            } catch (e) {
              next()
            }
          })
        } catch (e) {
          next()
        }
      })
    }

    next()
  })
})

module.exports = {
  parseTagName,
  appBallName,
  probeAppBalls,
}










