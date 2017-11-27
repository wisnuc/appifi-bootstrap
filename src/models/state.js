const debug = require('debug')('model')

class State {

  constructor(ctx, ...args) {
    this.ctx = ctx
    ctx.state = this
    this.enter(...args)
  }

  setState (state, ...args) {
    this.exit()
    new this.ctx[state](this.ctx, ...args)
  }

  enter () {
    debug(`${this.ctx.constructor.name} enter ${this.constructor.name} state`)
  }

  exit () {
    debug(`${this.ctx.constructor.name} exit ${this.constructor.name} state`)
  }

  destroy () {
    this.exit()
  }
}

module.exports = State

