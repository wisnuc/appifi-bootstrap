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

const initAsync = async (root, githubUrl) => {

  let appifiDir = path.join(root, 'appifi')
  let appBallsDir = path.join(root, 'appifi-tarballs')
  let tmpDir = path.join(root, 'tmp')

  await mkdirpAsync(root)
  await mkdirpAsync(appifiDir)  
  await mkdirpAsync(appBallsDir)

  let appBalls = await probeAppBallsAsync(appBallsDir)

  let tagName, isBeta
  try {
    let release = await probeAppifiAsync(appifiDir)

    if (release) {
      let localTagNames = appBalls.map(ball => ball.local.tag_name)
      if (localTagnames.includes(release.tag_name)) {
        tagName = release.tag_name
        isBeta = release.prerelease
      } else {
        throw new Error('current tag name not found')
      }
    } 
  } catch (e) {
    await rimrafAsync(appifiDir)
    await mkdirpAsync(appifiDir)
  }

  return new Model(root, githubUrl, appBalls, tagName, isBeta) 
}

const init = (root, githubUrl, callback) => initAsync(root, githubUrl)
  .then(model => callback(null, model))
  .catch(e => callback(e))

module.exports = init

