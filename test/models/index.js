const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const express = require('express')
const logger = require('morgan')
const bodyParser = require('body-parser')

const expect = require('chai').expect

const Model = require('src/models')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest') 

const githubUrl = 'https://api.github.com/repos/wisnuc/appifi-release/releases'

const appifiDir = path.join(tmptest, 'appifi')
const appBallsDir = path.join(tmptest, 'appifi-tarballs')
const tmpDir = path.join(tmptest, 'tmp')

const fakeRelease = JSON.parse(`
[
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
    "assets": [],
    "tarball_url": "http://localhost:4567/file",
    "zipball_url": "https://api.github.com/repos/wisnuc/appifi-release/zipball/0.9.14",
    "body": ""
  }
]
`)

const fakeUrl = 'http://localhost:4567'

describe(path.basename(__filename), () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(appifiDir)
    mkdirp.sync(appBallsDir)
    mkdirp.sync(tmpDir)
  })

  it('do nothing', function (done) {
    this.timeout(0)

    mkdirp.sync(path.join(tmptest, 'proj', 'build'))
    fs.writeFileSync(path.join(tmptest, 'proj', 'build', 'app.js'), 
      `setInterval(() => console.log('tick'), 1000)`) 
    fs.writeFileSync(path.join(tmptest, 'proj', 'package.json'), JSON.stringify({ name: 'appifi' }))
    child.execSync(`tar czf tmptest/file.tar.gz -C tmptest/proj .`)

    const app = express()    
    app.get('/', (req, res) => res.status(200).json(fakeRelease))
    app.get('/file', (req, res) => res.status(200).sendFile(path.join(tmptest, 'file.tar.gz')))

    const server = app.listen(4567, () => {
      let model = new Model(tmptest, githubUrl, [], null)
      model.on('appifiStarted', () => {
        model.destroy()
        setTimeout(() => server.close(() => done()), 1000)
      })
    })
  })
})
