




class Release extends EventEmitter {

  constructor(ctx, remote, local) {
    super()
    this.ctx = ctx
    this.remote = remote  // remote manifest
    this.local = local
  }

  // it is possible that the local is created first
  updateRemote (remote) {
  }

  download () {
  }
}



