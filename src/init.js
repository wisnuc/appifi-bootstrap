const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const { untar } = require('./lib/tarball')
const { probeAppBalls } = require('./lib/appball')
const Model = require('./models')

const untarAsync = Promise.promisify(untar)
const probeAppBallsAsync = Promise.promisify(probeAppBalls)

// pick .release.json
const probeAppifi = (dir, callback) => 
  fs.readFile(path.join(dir, './release.json'), (err, data) => {
    if (err) return callback(err)
    try {
      callback(null, JSON.parse(data))
    } catch (e) {
      callback(e)
    }
  })

const probeAppifiAsync = Promise.promisify(probeAppifi)

const initAsync = async root => {

  let appifiDir = path.join(root, 'appifi')
  let appBallsDir = path.join(root, 'appifi-tarballs')
  let tmpDir = path.join(root, 'tmp')

  await mkdirpAsync(root)
  await mkdirpAsync(appifiDir)  
  await mkdirpAsync(appBallsDir)

  let appBalls = await probeAppBallsAsync(appBallsDir)

  let tagName
  try {
    let release = await probeAppifiAsync(appifiDir)

    if (release) {
      let localTagNames = appBalls.map(ball => ball.local.tag_name)
      if (localTagnames.includes(release.tag_name)) {
        tagName = release.tag_name
      } else {
        throw new Error('current tag name not found')
      }
    } 
  } catch (e) {
    await rimrafAsync(appifiDir)
    await mkdirpAsync(appifiDir)
  }

  return new Model(root, appBalls, tagName) 
}

const init = (root, callback) => initAsync(root)
  .then(model => callback(null, model))
  .catch(e => callback(e))

module.exports = init

