const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const expect = require('chai').expect

const Release = require('src/models/release')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest') 

const mctx = {
  tmpDir: path.join(tmptest, 'tmp'),
  appBallsDir: path.join(tmptest, 'appifi-tarballs')
}

const mjson = `
  {
    "url": "https://api.github.com/repos/wisnuc/appifi-release/releases/8501308",
    "assets_url": "https://api.github.com/repos/wisnuc/appifi-release/releases/8501308/assets",
    "upload_url": "https://uploads.github.com/repos/wisnuc/appifi-release/releases/8501308/assets{?name,label}",
    "html_url": "https://github.com/wisnuc/appifi-release/releases/tag/0.9.14",
    "id": 8501308,
    "tag_name": "0.9.14",
    "target_commitish": "c8ffd8ab973c916f88c14e4df47292e2bc0d71a3",
    "name": "fix hash stream NOMEM",
    "draft": false,
    "author": {
      "login": "matianfu",
      "id": 376881,
      "avatar_url": "https://avatars0.githubusercontent.com/u/376881?v=4",
      "gravatar_id": "",
      "url": "https://api.github.com/users/matianfu",
      "html_url": "https://github.com/matianfu",
      "followers_url": "https://api.github.com/users/matianfu/followers",
      "following_url": "https://api.github.com/users/matianfu/following{/other_user}",
      "gists_url": "https://api.github.com/users/matianfu/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/matianfu/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/matianfu/subscriptions",
      "organizations_url": "https://api.github.com/users/matianfu/orgs",
      "repos_url": "https://api.github.com/users/matianfu/repos",
      "events_url": "https://api.github.com/users/matianfu/events{/privacy}",
      "received_events_url": "https://api.github.com/users/matianfu/received_events",
      "type": "User",
      "site_admin": false
    },
    "prerelease": false,
    "created_at": "2017-11-14T00:45:57Z",
    "published_at": "2017-11-14T00:47:23Z",
    "assets": [

    ],
    "tarball_url": "https://api.github.com/repos/wisnuc/appifi-release/tarball/0.9.14",
    "zipball_url": "https://api.github.com/repos/wisnuc/appifi-release/zipball/0.9.14",
    "body": ""
  }
`

const mrel = JSON.parse(mjson)

const mconf = {

}

const mball = {
  path: '/home/wisnuc/appifi-bootstrap/tmptest/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz',
  local: mrel,
  config: mconf
}

describe(path.basename(__filename), () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(mctx.tmpDir)
    mkdirp.sync(mctx.appBallsDir)
  })

  it('new Release from ball should have ctx, tmpDir, appBallsDir, path, local, config, but not remote', 
    done => {
      let r = new Release(mctx, mball)
      expect(r.hasOwnProperty('ctx')).to.be.true
      expect(r.hasOwnProperty('tmpDir')).to.be.true
      expect(r.hasOwnProperty('appBallsDir')).to.be.true
      expect(r.hasOwnProperty('path')).to.be.true
      expect(r.hasOwnProperty('local')).to.be.true
      expect(r.hasOwnProperty('config')).to.be.true
      expect(r.hasOwnProperty('remote')).to.be.false
      done()
    })

  it('new Release from ball should be in Idle state', done => {
    let r = new Release(mctx, mball)
    expect(r.state.constructor.name).to.equal('Idle')
    done()
  })

  it('new Release from ball should have tag name, value, and attr', done => {
    let r = new Release(mctx, mball)
    expect(r.tagName()).to.equal('0.9.14')
    expect(r.tagValue()).to.equal(9014)
    expect(r.tagAttr()).to.deep.equal({
      name: '0.9.14',
      major: 0,
      minor: 9,
      build: 14,
      value: 9014
    })
    done()
  })

  it('new Release from remote should have ctx, tmpDir, appBallsDir, remote, but not path, local, config', 
    done => {
      let r = new Release(mctx, { remote: mrel })
      expect(r.hasOwnProperty('ctx')).to.be.true
      expect(r.hasOwnProperty('tmpDir')).to.be.true
      expect(r.hasOwnProperty('appBallsDir')).to.be.true
      expect(r.hasOwnProperty('path')).to.be.false
      expect(r.hasOwnProperty('local')).to.be.false
      expect(r.hasOwnProperty('config')).to.be.false
      expect(r.hasOwnProperty('remote')).to.be.true
      done()
    })

  it('new Release from remote should be in Idle state', done => {
    let r = new Release(mctx, { remote: mrel })
    expect(r.state.constructor.name).to.equal('Idle')
    done()
  })

  it('new Release from remote should have tag name, value, and attr', done => {
    let r = new Release(mctx, { remote: mrel })
    expect(r.tagName()).to.equal('0.9.14')
    expect(r.tagValue()).to.equal(9014)
    expect(r.tagAttr()).to.deep.equal({
      name: '0.9.14',
      major: 0,
      minor: 9,
      build: 14,
      value: 9014
    })
    done()
  })

  it('try download', function (done) {
    this.timeout(0) 

    let r = new Release(mctx, { remote: mrel })
    r.download(err => {
      if (err) return done(err)

      expect(r.path).to.equal('/home/wisnuc/appifi-bootstrap/tmptest/appifi-tarballs/appifi-0.9.14-8501308-c8ffd8ab.tar.gz')
      expect(r.remote).to.deep.equal(r.local)
      expect(r.config.name).to.equal('appifi')
      done()
    })
  })
})
