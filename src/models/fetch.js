const EventEmitter = require('events')

const request = require('superagent')

const State = require('./state')

class Idle extends State {

  enter (err, data) {
    super.enter()
    this.ctx.error = err
    this.ctx.data = data

    this.timer = this.setTimeout(() => this.setState('Working'), err ? 6 * 3600 * 1000 : 24 * 3600 * 1000) 

    this.emit('update', err, data)    
  }

  exit () {
    clearTimeout(this.timer)
    super.exit()
  }
}

const url = 'https://api.github.com/repos/wisnuc/appifi-release/releases'

class Working extends State {

  enter () {
    super.enter()
    this.req = request
      .get(url)
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
}

class Fetch extends EventEmitter {

  constructor () {
    super() 
    new Working(this)
  }
}

module.exports = Fetch
