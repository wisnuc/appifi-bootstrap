const Promise = require('bluebird')
const path = require('path')
const fs = require('fs')
const child = require('child_process')
const EventEmitter = require('events')

const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

const Base = require('./state')

class State extends Base {
  start () {}
  stop () {}
}

class Stopped extends State {

  start () {
    this.setState('Starting')
  }
}

class Starting extends State {

  enter () {
    super.enter()

    const opts = {
      cwd: this.ctx.appifiDir,
      env: { NODE_ENV: 'production' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'] 
    }
    let appPath = path.join(this.ctx.appifiDir, 'build', 'app.js')
    let args = [appPath]

    this.appifi = child.spawn(this.ctx.nodePath(), args, opts)
    this.appifi.on('error', err => console.log('Appifi Error in Starting: neglected', err))
    this.appifi.on('message', message => this.setState('Started', this.appifi))
    this.appifi.on('close', (code, signal) => (this.appifi = null, this.setState('Failed', { code, signal })))
    
    // to be removed in future version TODO
    this.timer = setTimeout(() => this.setState('Started', this.appifi), 8000)
  }

  stop () {
    this.setState('Stopping', this.appifi)
  }

  exit () {
    if (this.appifi) this.appifi.removeAllListeners()
    clearTimeout(this.timer)
    super.exit()
  }
}

class Started extends State {

  enter (appifi) {
    super.enter()

    this.appifi = appifi
    this.appifi.on('error', err => console.log('Appifi Error in Started: neglected', err))
    this.appifi.on('close', (code, signal) => (this.appifi = null, this.setState('Failed', { code, signal})))

    this.ctx.ctx.emit('appifiStarted')
  }

  stop () {
    this.setState('Stopping', this.appifi)
  }

  exit () {
    if (this.appifi) this.appifi.removeAllListeners()
    super.exit()
  }
}

// Stopping can only be entered when being stopped externally, so it always goes to Stopped state
class Stopping extends State {

  enter (appifi) {
    super.enter()
    appifi.kill()
    appifi.on('error', err => console.log('Appifi Error in Started: neglected', err))
    appifi.on('close', (code, signal) => this.setState('Stopped'))
  }
}

// Failed and Started are XOR destination of start operation
class Failed extends State {

  enter (err) {
    super.enter()
    this.error = err
    this.timer = setTimeout(() => this.setState('Starting'), 100) 

    this.startCbs.forEach(cb => cb(this.error))
    this.startCbs = []
    // failed can only be landed on start request
    // this.stopCbs.forEach(cb => cb(this.error))
  }

  start () {
    this.setState('Starting')
  }

  stop () {
    this.setState('Stopped')
  }

  exit () {
    clearTimeout(this.timer) 
    super.exit()
  }
}

class Appifi extends EventEmitter {

  /**
  ctx is the model. ctx.releases is guaranteed to be available.
  */
  constructor(ctx, tagName) {
    super()
    this.ctx = ctx
    this.tagName = tagName
    this.appifiDir = ctx.appifiDir

    // mutual exclusive
    this.startCbs = []
    this.stopCbs = []

    new Starting(this)
  }

  getState() {
    return this.state.constructor.name
  }

  nodePath () {
    return this.ctx.nodePath()
  }

  // start may land started or failed
  start (callback = () => {}) {
    if (this.stopCbs.length) {
      let err = new Error('appifi is requested to stop')
      err.code = 'ERACE'
      process.nextTick(() => callback(err))
      return
    }

    if (this.getState() === 'Started') {
      process.nextTick(() => callback(null))
      return
    }

    if (!this.startCbs.length) {
      const f = err => (this.startCbs.forEach(cb => cb(err)), this.startCbs = [])
      const startedHandler = () => (this.removeListener('Failed', failedHandler), f(null))
      const failedHandler = () => (this.removeListener('Started', startedHandler), f(this.state.error))
      this.once('Started', startedHandler)
      this.once('Failed', failedHandler)
      process.nextTick(() => this.state.start())
    }

    this.startCbs.push(callback)
  }

  async startAsync () {
    return new Promise((res, rej) => this.start(err => err ? rej(err) : res(null)))
  }

  // stop may land stopped
  stop (callback = () => {}) {
    if (this.startCbs.length) {
      let err = new Error('appifi is requested to start')
      err.code = 'ERACE'
      process.nextTick(() => callback(err))
      return
    }

    if (this.getState() === 'Stopped') {
      process.nextTick(() => callback(null))
      return
    }

    if (!this.stopCbs.length) {
      this.once('Stopped', () => (this.stopCbs.forEach(cb => cb(null)), this.stopCbs = []))
      process.nextTick(() => this.state.stop())
    }

    this.stopCbs.push(callback)
  }

  async stopAsync () {
    return new Promise((res, rej) => this.stop(err => err ? rej(err) : res(null)))
  }

  view () {
    return {
      state: this.getState(),
      tagName: this.tagName
    }
  }
}

Appifi.prototype.Stopped = Stopped
Appifi.prototype.Starting = Starting
Appifi.prototype.Started = Started
Appifi.prototype.Stopping = Stopping
Appifi.prototype.Failed = Failed

module.exports = Appifi
