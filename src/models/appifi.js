const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const EventEmitter = require('events')
const State = require('./state')


// 1. retrieve .release.json, -> Empty if failed
// 2. if release is not valid, -> Empty
// 3. if release is valid -> Starting
class Init extends State {

  enter () {
    super.enter()

    this.probe((err, release) => {
      if (err) {
        rimraf(this.ctx.appifiDir, () => {
          this.setState('Empty')
          this.ctx.emit('Initialized')
        })
      } else {
        this.ctx.release = release
        this.setState('Stopped')
        this.ctx.emit('Initialized')
      }
    })
  } 

  probe (callback) {
    fs.readFile(path.join(this.ctx.appifiDir, './release.json'), (err, data) => {
      if (err) return callback(err) 
      try {
        callback(null, JSON.parse(data))
      } catch (e) {
        callback(e)
      }
    })
  }
}

class Empty extends State {

  enter () {
    super.enter()
    
    this.ctx.emit('Empty')
  } 
}

class Installing extends State {

}

class Uninstalling extends State {

  enter () {
    super.enter()

    
  }
}

class Stopped extends State {

  enter (retry) {
    super.enter()

    this.ctx.emit('Stopped')
  }

}

class Starting extends State {

  enter () {
    super.enter()

    this.ctx.args = [path.join(this.ctx.appifiDir, 'build', 'app.js')]
    let appifi = child.spawn(this.ctx.nodePath, args)
    appifi.on('error', err => {})
    appifi.on('close', (code, signal) => {
      console.log(`appifi exit with code: ${code} and signal: ${signal}`)
      this.ctx.appifi = null
      this.setState('Failed')
    })
    
    this.ctx.appifi = appifi
  }

  exit () {
    if (this.ctx.appifi) {
      this.ctx.appifi.removeAllListeners()
    }
    super.exit()
  }
}

class Started extends State {

  enter () {
    super.enter()

    let appifi = this.ctx.appifi
    appifi.on('error', err => {})
    appifi.on('close', (code, signal) => {
      console.log(`appifi exit with code: ${code} and signal: ${signal}`)
      this.ctx.appifi = null
      this.setState('Failed')
    })
  }

  exit () {
    if (this.ctx.appifi) {
      this.ctx.appifi.removeAllListeners()
    }
    super.exit()
  }
}

class Stopping extends State {
}

class Appifi extends EventEmitter {

  /**
  ctx is the model. ctx.releases is guaranteed to be available.
  */
  constructor(ctx, appifiDir) {
    super()
    this.ctx = ctx
    this.appifiDir = ctx.appifiDir

    new Init(this)
  }

  nodePath () {
    return this.ctx.nodePath
  }
}

Appifi.prototype.Init = Init
Appifi.prototype.Empty = Empty
Appifi.prototype.Installing = Installing
Appifi.prototype.Uninstalling = Uninstalling
Appifi.prototype.Stopped = Stopped
Appifi.prototype.Starting = Starting
Appifi.prototype.Started = Started
Appifi.prototype.Stopping = Stopping

module.exports = Appifi
