const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const expect = require('chai').expect

const { parseTagName, appBallName, probeAppBalls } = require('src/lib/appball')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest') 

const origBallName = '0.9.14.tar.gz'
const testBallName = 'appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz'

describe(path.basename(__filename), () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(tmptest)
  })

  it('probe empty dir should return []', done => {
    probeAppBalls(tmptest, (err, appballs) => {
      if (err) return done(err)
      expect(appballs).to.deep.equal([])
      done()
    })
  })

  it('probe origBall should return []', function (done) {
    this.timeout(20000)
    fs.copyFileSync(path.join('testdata', origBallName), path.join(tmptest, origBallName))
    probeAppBalls(tmptest, (err, appballs) => {
      if (err) return done(err)
      expect(appballs).to.deep.equal([])
      done()
    })
  })


  it('probe faked testBall should return []', function (done) {
    this.timeout(20000)
    // named testBallName but is actually origBall (w/o .release.json)
    fs.copyFileSync(path.join('testdata', origBallName), path.join(tmptest, testBallName))
    probeAppBalls(tmptest, (err, appballs) => {
      if (err) return done(err)
      expect(appballs).to.deep.equal([])
      done()
    })
  })


  it('probe testBall should succeed', function (done) {
    this.timeout(20000)

    fs.copyFileSync(path.join('testdata', testBallName), path.join(tmptest, testBallName))
    probeAppBalls(tmptest, (err, appballs) => {

      console.log(appballs)

      if (err) return done(err)
      expect(appballs.length).to.equal(1)
      let rel = appballs[0]
      expect(rel.path).to.equal(path.join(tmptest, testBallName))
      expect(rel.local.tag_name).to.equal('0.9.14')
      expect(rel.config.name).to.equal('appifi')
      done()
    })
  })
})
