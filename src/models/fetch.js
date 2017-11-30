const EventEmitter = require('events')

const request = require('superagent')

const State = require('./state')

/** constants **/
const defaultUrl = 'https://api.github.com/repos/wisnuc/appifi-release/releases'
const HOUR = 3600 * 1000

class Pending extends State {

  enter (err, data) {
    super.enter()
    this.ctx.last = {
      time: new Date().getTime(),
      error: err || null,
      data: data || null
    }

    this.startTime = new Date().getTime()
    this.timeout = err ? 1 * HOUR : 24 * HOUR
    this.timer = setTimeout(() => this.setState('Working'), this.timeout) 

    if (data) this.ctx.emit('update', data)
  }

  exit () {
    clearTimeout(this.timer)
    super.exit()
  }

  view () {
    return {
      startTime: this.startTime,
      timeout: this.timeout,
    }  
  }

  start () {
    this.setState('Working')
  }
}

class Working extends State {

  enter () {
    super.enter()
    this.req = request
      .get(this.ctx.url)
      .end((err, res) => {
        if (err) {
          this.setState('Pending', err)
        } else if (!res.ok) {
          let err = new Error('http error')
          err.code = 'EHTTPSTATUS' 
          err.res = res
          this.setState('Pending', err)
        } else {
          this.setState('Pending', null, res.body)
        }
      })
  }

  exit () {
    this.req.abort()
    super.exit()
  }

  start () {}
}

class Fetch extends EventEmitter {

  constructor (url) {
    super() 
    this.url = url || defaultUrl 
    this.last = null

    new Working(this)
  }

  getState() {
    return this.state.constructor.name
  }

  start () {
    this.state.start()
  }

  view () {
    let last = null
    if (this.last) {
      last = Object.assign({}, this.last)
      if (last.error) {
        last.error = {
          message: last.error.message,
          code: last.error.code
        }
      }
    }

    return {
      state: this.getState(),
      view: this.state.view(),
      last,
    } 
  }

  destroy () {
    this.state.destroy()
  }
}

Fetch.prototype.Pending = Pending
Fetch.prototype.Working = Working

module.exports = Fetch
