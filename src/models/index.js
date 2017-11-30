const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const UUID = require('uuid')

const { untar } = require('../lib/tarball')
const { probeAppBalls } = require('../lib/appball')

const untarAsync = Promise.promisify(untar)
const probeAppBallsAsync = Promise.promisify(probeAppBalls)

const Appifi = require('./appifi')
const Fetch = require('./fetch')
const Release = require('./release')
const Node = require('./node')

const ERace = Object.assign(new Error('another operation is in progress'), { code: 'ERACE', status: 403 })
const EApp404 = Object.assign(new Error('app not installed'), { code: 'ENOTFOUND', status: 404 })

// const githubUrl = 'https://api.github.com/repos/wisnuc/appifi-release/releases'

class Model extends EventEmitter {

  // root: root directory
  // appBalls: similar to release but has no remote.
  // ctag: current tag_name if found
  constructor(root, githubUrl, appBalls, tagName, isBeta) {
    super()

    this.useBeta = false

    this.root = root
    this.githubUrl = githubUrl
    this.tmpDir = path.join(this.root, 'tmp')
    this.appBallsDir = path.join(this.root, 'appifi-tarballs')
    this.appifiDir = path.join(this.root, 'appifi')

    rimraf.sync(this.tmpDir)
    mkdirp.sync(this.tmpDir)
    mkdirp.sync(this.appifiDir)
    mkdirp.sync(this.appBallsDir)

    // releases
    this.releases = appBalls.map(ball => new Release(this, ball))

    // start fetch  
    this.fetch = new Fetch(this.githubUrl)
    this.fetch.on('update', data => {
      this.updateRemotes(data)
      this.reqSchedule()      
    })

    this.appifi = null

    if (tagName) {
      this.appifi = new Appifi(this, tagName)
      this.useBeta = !!isBeta
    }
  }

  nodePath () {
    return 'node' // TODO
  }

  sort () {
    this.releases = this.releases.sort((a, b) => a.tagValue() - b.tagValue()).reverse()
  }

  updateRemotes (remotes) {
    // update remotes of existing release and create new releases
    remotes
      .reduce((nrs, remote) => {
        let rel = this.releases.find(r => r.tagName() === remote.tag_name)
        if (rel) {
          rel.setRemote(remote)
        } else {
          nrs.push(remote)
        }
        return nrs
      }, [])
      .forEach(remote => {
        let rel = new Release(this, { remote })
        this.releases.push(rel)
      })
  
    this.sort()
  }

  reqSchedule() {
    if (this.scheduled === true) return
    this.scheduled = true
    process.nextTick(() => this.schedule())
  }

  schedule () {
    if (this.operation) return

    this.scheduled = false

    // starting latest release download and stop all others
    this.releases.forEach((r, i) => i === 0 ? r.start() : r.stop())

    // if no appifi, start one (not necessarily latest)
    if (!this.appifi) {
      let latestReady = this.releases.find(r => r.getState() === 'Ready')
      if (latestReady) {
        this.appInstall(latestReady.tagName(), () => {})
      }
    }
  }

  destroy () {
    this.scheduled = true

    if (this.appifi) this.appifi.stop()
    this.releases.forEach(r => r.stop())
  }

  /////////////////////////////////////////////////////////////////////////////

  async startAppifiAsync () {
    if (!this.appifi) throw new Error('appifi not found')
    this.appifi.startAsync()
  }

  async stopAppifiAsync () {
    if (!this.appifi) throw new Error('appifi not found')
    this.appifi.stopAsync()
  }

  async installAsync (tagName) {
    // find release
    let release = this.releases.find(r => r.local && r.local.tag_name === tagName)
    if (!release) {
      let err = new Error('release not found for given tag name')
      err.code = 'ENOTFOUND'
      err.status = 400
      throw err
    }

    if (release.getState() !== 'Ready') {
      let err = new Error('release is not ready for install')
      err.code = 'ENOTREADY'
      err.status = 400
      throw err
    }

    // untar into tmp dir
    let tmpDir = path.join(this.tmpDir, UUID.v4()) 
    await mkdirpAsync(tmpDir)
    try {
      await untarAsync(release.path, tmpDir)
    } catch (e) {
      rimraf(tmpDir, () => {})
      throw e
    }

    // stop appifi if existing
    if (this.appifi) {
      await this.appifi.stopAsync()
      this.appifi = null
    } 

    // move directory
    await rimrafAsync(this.appifiDir)
    await fs.renameAsync(tmpDir, this.appifiDir)

    // start appifi
    this.appifi = new Appifi(this, tagName)
  }

  //////////////////////////////////////////////////////////////////////////////

  view () {
    return {
      beta: this.useBeta,
      operation: this.operation,
      appifi: this.appifi ? this.appifi.view() : null,
      releases: this.releases.map(r => r.view()),
      fetch: this.fetch.view(),
//      node: this.node.view(),
//      deb: this.deb.view()
    }
  }

  appInstall (tagName, callback) {
    if (this.operation) return process.nextTick(() => callback(ERace))
    this.operation = 'appInstall'
    this.installAsync(tagName) 
      .then(() => (this.operation = null, callback(null)))
      .catch(e => (this.operation = null, callback(e)))
  }

  appStart (callback) {
    if (!this.appifi) return process.nextTick(() => callback(EApp404))
    if (this.operation) return process.nextTick(() => callback(ERace))
    this.operation = 'appStart'
    this.appifi.startAsync()
      .then(() => (this.operation = null, callback(null)))  
      .catch(e => (this.operation = null, callback(e)))
  }

  appStop (callback) {
    if (!this.appifi) return process.nextTick(() => callback(EApp404))
    if (this.operation) return process.nextTick(() => callback(ERace))
    this.operation = 'appStop'
    this.appifi.stopAsync()
      .then(() => (this.operation = null, callback(null)))  
      .catch(e => (this.operation = null, callback(e)))
  }

  releaseStart(tagName, callback) {
    let release = this.releases.find(r => r.tagName() === tagName)
    if (!release) {
      let err = new Error('release not found for given tag name')
      err.code = 'ENOTFOUND'
      err.status = 404
      return process.nextTick(() => callback(err))
    }
    release.start()
    callback(null)
  }

  releaseStop(tagName, callback) {
    let release = this.releases.find(r => r.tagName() === tagName)
    if (!release) {
      let err = new Error('release not found for given tag name')
      err.code = 'ENOTFOUND'
      err.status = 404
      return process.nextTick(() => callback(err))
    }
    release.stop()
    callback(null)
  }

  fetchStart(callback) {
    this.fetch.start()
    process.nextTick(() => callback(null))
  }
}

module.exports = Model



