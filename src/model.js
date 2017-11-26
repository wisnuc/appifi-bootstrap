const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const { probeAppBalls } = require('./lib/appball')

const State = require('./models/state')

const Fetch = require('./models/fetch')
const Release = require('./models/release')



const releasesUrl = 'https://api.github.com/repos/wisnuc/appifi-release/releases'
const appBallsDir = '/wisnuc/appifi-tarballs'
const tmpDir = '/wisnuc/appifi-tmp'
const appifiDir = '/wisnuc/appifi'

class Initializing extends State {

  enter () {
    super.enter()
    probeAppBalls(appBallsDir, (err, balls) => {
      if (err) return this.setState('InitFailed', err)

      this.setState('Initialized', balls)
    })
  }
} 

class Initialized extends State {
  
  enter (balls) {
    super.enter()

    this.ctx.map = new Map()

    this.ctx.fetch = new Fetch() 
    this.ctx.node = new Node()
    this.ctx.deb = new Deb()
  }
}

class InitFailed extends State {

  enter (err) {
    super.enter()
    this.err = err
  }
}

class Model {

  constructor(root) {

    this.root = root || '/wisnuc'
    this.tmpDir = path.join(this.root, 'tmp')
    this.appBallsDir = path.join(this.root, 'appifi-tarballs')
    this.appifiDir = path.join(this.root, 'appifi')

    rimraf.sync(this.tmpDir())
    mkdirp.sync(this.tmpDir())
    mkdirp.sync(this.appBallsDir())
    
    new Initializing(this)
  }

}

module.exports = Model




