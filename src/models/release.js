const EventEmitter = require('events')
const State = require('./state')

class Idle extends State {

  enter (props) {
    super.enter()
    Object.assign(this.ctx, props)
  } 

}

class Downloading extends State {

  enter () {
    super.enter()

    this.tmpFile = path.join(this.ctx.tmpDir, UUID.v4())
    this.tmpDir = path.join(this.ctx.tmpDir, UUID.v4())
    this.download = download(this.ctx.release.tarball_url, this.tmpFile, err => {
      this.download = null  
      if (err) return this.setState('Failed', err)
    })
  }

  exit () {
    if (this.download) this.download.destroy()
    super.exit()
  }
}

class Repacking extends State {

  enter (tmpFile) {
    super.enter()

    let oldPath = tmpFile
    let newPath = path.join(this.ctx.tmpDir, UUID.v4())

    this.inject = inject(oldPath, newPath, '.release.json', JSON.stringify(this.ctx.remote), err => {
      if (err) return this.setState('Failed', err)
     
    }) 
  }
}

class Verifying extends State {

  enter (tmpFile) {
    super.enter()

    cherryPick(tmpFile, './.release.json', (err, data) => {
      if (err || !data) return this.setState('Failed', err)
      let local
      try {
        local = JSON.parse(data)
      } catch (e) {
        let err = new Error('error parsing cherry-picked .release.json')
        this.setState('Failed', err)
      }

      cherryPick(tmpFile, './package.json', (err, data) => {
        if (err || !data) return this.setState('Failed', err)
        try {
          config = JSON.parse(data)
          let props = 
          this.setState('Idle', props)
        } catch (e) {
          let err = new Error('error parsing cherry-picked package.json')
          this.setState('Failed', err)
        }
      })
    })
  }
}

class Failed extends State {
}

/**
{ path: '/home/wisnuc/appifi-bootstrap/tmptest/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz',
  local: 
   { url: 'https://api.github.com/repos/wisnuc/appifi-release/releases/8501308',
     assets_url: 'https://api.github.com/repos/wisnuc/appifi-release/releases/8501308/assets',
     upload_url: 'https://uploads.github.com/repos/wisnuc/appifi-release/releases/8501308/assets{?name,label}',
     html_url: 'https://github.com/wisnuc/appifi-release/releases/tag/0.9.14',
     id: 8501308,
     tag_name: '0.9.14',
     target_commitish: 'c8ffd8ab973c916f88c14e4df47292e2bc0d71a3',
     name: 'fix hash stream NOMEM',
     draft: false,
     author: [Object],
     prerelease: false,
     created_at: '2017-11-14T00:45:57Z',
     published_at: '2017-11-14T00:47:23Z',
     assets: [],
     tarball_url: 'https://api.github.com/repos/wisnuc/appifi-release/tarball/0.9.14',
     zipball_url: 'https://api.github.com/repos/wisnuc/appifi-release/zipball/0.9.14',
     body: '' },
  config: 
   { name: 'appifi',
     version: '0.9.0',
     private: true,
     scripts: [Object],
     dependencies: [Object],
     devDependencies: [Object],
     wisnuc: [Object] } }
*/

// a release can be created by a local ball object
// or a remote release
class Release extends EventEmitter {

  // ctx is the model
  constructor(ctx, props) {
    super()
    this.ctx = ctx
    this.tmpDir = ctx.tmpDir
    this.appBallsDir = ctx.appBallsDir

    Object.assign(this, props)

    // alias
    Object.defineProperty(this, 'model', { 
      get: function () {
        return this.ctx
      } 
    })
  }

  tagName () {
    return this.remote
      ? this.remote.tag_name
      : this.local.tag_name
  }

  tagValue () {
    
  }

  // it is possible that the local is created first
  setRemote (remote) {
    this.remote = remote
  }

  download () { 
  }
}

Release.prototype.Idle = Idle
Release.prototype.Downloading = Downloading
Release.prototype.Repacking = Repacking
Release.prototype.Verifying = Verifying
Release.prototype.Failed = Failed

module.exports = Release


