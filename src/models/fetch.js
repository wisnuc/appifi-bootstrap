const EventEmitter = require('events')

const request = require('superagent')

const State = require('./state')

/** constants **/
const defaultUrl = 'https://api.github.com/repos/wisnuc/appifi-release/releases'
const HOUR = 3600 * 1000

class Idle extends State {

  enter (err, data) {
    super.enter()
    this.ctx.error = err || null
    if (data) this.ctx.data = data

    this.timer = setTimeout(() => 
      this.setState('Working'), err ? 1 * HOUR : 24 * HOUR) 

    this.ctx.emit('update', err, data)    
  }

  exit () {
    clearTimeout(this.timer)
    super.exit()
  }

  // do nothing
  abort () {
  }
}

class Working extends State {

  enter () {
    super.enter()
    this.req = request
      .get(this.ctx.url)
      .end((err, res) => {
        if (err) {
          this.setState('Idle', err)
        } else if (!res.ok) {
          let err = new Error('http error')
          err.code = 'EHTTPSTATUS' 
          err.res = res
          this.setState('Idle', err)
        } else {
          this.setState('Idle', null, res.body)
        }
      })
  }

  exit () {
    this.req.abort()
    super.exit()
  }

  abort () {
    let err = new Error('aborted')
    err.code = 'EABORT'
    this.setState('Idle', err)
  }
}

class Fetch extends EventEmitter {

  constructor (url) {
    super() 
    this.url = url || defaultUrl 
    this.error = null
    this.data = null
    new Working(this)
  }

  abort() {
    this.state.abort()
  }
}

Fetch.prototype.Idle = Idle
Fetch.prototype.Working = Working

module.exports = Fetch
