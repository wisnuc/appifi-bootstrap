const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const { untar } = require('./lib/tarball')
const { probeAppBalls } = require('./lib/appball')

const untarAsync = Promise.promisify(untar)
const probeAppBallsAsync = Promise.promisify(probeAppBalls)

const State = require('./models/state')

const Fetch = require('./models/fetch')
const Release = require('./models/release')

const releasesUrl = 'https://api.github.com/repos/wisnuc/appifi-release/releases'
const appBallsDir = '/wisnuc/appifi-tarballs'
const tmpDir = '/wisnuc/appifi-tmp'
const appifiDir = '/wisnuc/appifi'

const probeAppifi = (dir, callback) => 
  mkdirp(dir, err => err 
    ? callback(err)
    : fs.readFile(path.join(dir, './release.json'), (err, data) => {
        try {
          if (err && err.code === 'ENOENT') {
            throw err
          } else if (err) {
            callback(err)
          } else {
            callback(null, JSON.parse(data))
          }
        } catch (e) {
          // recursion
          rimraf(dir, err => err ? callback(err) : probeAppifi(dir, callback))
        }
      }))

const probeAppifiAsync = Promise.promisify(probeAppifi)

class Init extends State {

  /**
  probe all local appballs and current
  if current has local appball, start it; otherwise, remove it
  if appballs exists, extract and start newest one 
  */
  enter () {
    super.enter()
    probeAsync()
      .then(data => {
        this.setState('Ready', data)
        this.ctx.emit('Initialized')
      })
      .catch(err => {
        this.setState('Failed', err)
        this.ctx.emit('Initialized')
      })
  }

  /**
  returns { releases, current }
  releases may be empty array. current may be undefined/null
  */
  async probeAsync () {
    let current
    let releases = await probeAppBallsAsync(this.ctx.appBallsDir)
    let release = await probeAppifiAsync(this.ctx.appifiDir)
  
    if (release) {
      current = releases.find(rel => rel.local.tag_name === release.tag_name)
      if (current) {
        return { releases, current }
      } else {
        // if not found, remove current appifi
        await rimrafAsync(this.ctx.appifiDir)
        await mkdirpAsync(this.ctx.appifiDir)
      }
    }

    if (releases.length) {
      let current = releases[0]
      await untarAsync(current.path, appifiDir)
    }
   
    return { releases, current } 
  }

} 

class Ready extends State {
  
  enter ({ releases, current }) {
    super.enter()

    this.ctx.releases = releases.map(rel => new Release(this.ctx, rel))
    this.ctx.fetch = new Fetch() 
    this.ctx.node = new Node()
    this.ctx.deb = new Deb()

    if (current) {
      this.ctx.appifi = new Appifi()
    } else {
      this.ctx.appifi = null
    }
  }
}

class Failed extends State {

  enter (err) {
    super.enter()
    this.err = err
  }
}

class Model extends EventEmitter {

  constructor(root) {
    super()

    this.root = root || '/wisnuc'
    this.tmpDir = path.join(this.root, 'tmp')
    this.appBallsDir = path.join(this.root, 'appifi-tarballs')
    this.appifiDir = path.join(this.root, 'appifi')

    rimraf.sync(this.tmpDir())
    mkdirp.sync(this.tmpDir())
    mkdirp.sync(this.appBallsDir())
    
    new Init(this)
  }

  view () {
    return {
      hello: 'world'
    }
  }

}

Model.prototype.Init = Init
Model.prototype.Ready = Ready
Model.prototype.Failed = Failed

module.exports = Model




