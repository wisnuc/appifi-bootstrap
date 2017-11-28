const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const expect = require('chai').expect

const Appifi = require('src/models/appifi')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest') 

const appBallsDir = path.join(tmptest, 'appifi-tarballs')
const appifiDir = path.join(tmptest, 'appifi')
const tmpDir = path.join(tmptest, 'tmp')

const mctx = {
  tmpDir,
  appBallsDir,
  appifiDir
}

describe(path.basename(__filename), () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(appBallsDir)
    mkdirp.sync(appifiDir)
    mkdirp.sync(tmpDir)
  })

  it('new Appifi with empty appifi dir should fall into Empty state', done => {
    let appifi = new Appifi(mctx)
    appifi.once('Empty', () => {
      console.log(appifi)
      done()
    })
  }) 
})
