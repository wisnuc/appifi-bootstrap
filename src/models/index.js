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

// const githubUrl = 'https://api.github.com/repos/wisnuc/appifi-release/releases'

class Model extends EventEmitter {

  // root: root directory
  // appBalls: similar to release but has no remote.
  // ctag: current tag_name if found
  constructor(root, githubUrl, appBalls, tagName) {
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

    // this.node = new Node()

    this.appifi = tagName ? new Appifi(this, tagName) : null
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
    if (this.operating) return

    this.scheduled = false

    // starting latest release download and stop all others
    this.releases.forEach((r, i) => i === 0 ? r.start() : r.stop())

    // if no appifi, start one (not necessarily latest)
    if (!this.appifi) {
      let latestReady = this.releases.find(r => r.getState() === 'Ready')
      if (latestReady) {
        this.install(latestReady.tagName(), () => {})
      }
    }
  }

  install (tagName, callback) {
    this.operating = 'install'
    this.installAsync(tagName) 
      .then(() => (this.operating = null, callback(null)))
      .catch(e => (this.operating = null, callback(e)))
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
    if (!release) throw new Error('no downloaded file for given tag name')

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

  view () {
    return {
      beta: this.useBeta,
      appifi: this.appifi.view(),
      releases: this.releases.map(r => r.view()),
      node: this.node.view(),
      deb: this.deb.view()
    }
  }

  destroy () {
    this.scheduled = true

    if (this.appifi) this.appifi.stop()
    this.releases.forEach(r => r.stop())
  }
}

module.exports = Model



