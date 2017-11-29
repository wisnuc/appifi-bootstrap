const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')

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
  nodePath: 'node',
  tmpDir,
  appBallsDir,
  appifiDir
}

const fakeNoTimeoutScript = `
  process.on('message', 
`

describe(path.basename(__filename) + ' non-start-stop', () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(appBallsDir)
    mkdirp.sync(appifiDir)
    mkdirp.sync(tmpDir)
  })

  it('new Appifi with empty appifi dir should end at Empty state with empty dir', done => {
    let appifi = new Appifi(mctx)
    appifi.once('Empty', () => {
      expect(fs.readdirSync(appifiDir)).to.deep.equal([])
      done()
    })
  }) 

  it('new Appifi with invalid appifi dir should end at Empty state with empty dir', done => {
    mkdirp.sync(path.join(appifiDir, 'hello'))
    let appifi = new Appifi(mctx)
    appifi.once('Empty', () => {
      expect(fs.readdirSync(appifiDir)).to.deep.equal([])
      done()
    })
  })

  it('new Appifi with invalid .release.json should end at Empty state with empty dir', done => {
    fs.writeFileSync(path.join(appifiDir, './release.json'), '^&^&^&*^&*')
    let appifi = new Appifi(mctx)
    appifi.once('Empty', () => {
      expect(fs.readdirSync(appifiDir)).to.deep.equal([])
      done()
    })
  })

  it('new Appifi with valid appifi deployment should end at Stopped state, d277f05f', function (done) {
    this.timeout(5000)

    let tarball = 'testdata/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz'
    child.execSync(`tar xzf ${tarball} -C ${appifiDir}`)
    let appifi = new Appifi(mctx)
    appifi.once('Stopped', () => {
      expect(appifi.release.tag_name).to.equal('0.9.14')
      done()
    })
  })

  it('(low level) uninstall Stopped Appifi should end in Empty', function (done) {
    this.timeout(5000)
    let tarball = 'testdata/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz'
    child.execSync(`tar xzf ${tarball} -C ${appifiDir}`)

    let appifi = new Appifi(mctx)
    appifi.once('Stopped', () => {
      // this is synchronous state transition 
      appifi.state.setState('Empty') 
      expect(fs.readdirSync(appifiDir)).to.deep.equal([]) 
      done()
    })
  })

  it('(low level) new Empty appifi install', function (done) {
    this.timeout(10000)
    let tarball = 'testdata/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz'
    let appifi = new Appifi(mctx)
    appifi.once('Empty', () => {
      appifi.state.setState('Installing', tarball)
      appifi.once('Stopped', () => {
        expect(appifi.release.tag_name).to.equal('0.9.14')
        done()
      })
    })
  })

  it('(low level) start', function (done) {
    this.timeout(10000)

    let tarball = 'testdata/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz'
    child.execSync(`tar xzf ${tarball} -C ${appifiDir}`)
    let appifi = new Appifi(mctx)
    appifi.once('Stopped', () => {
      expect(appifi.release.tag_name).to.equal('0.9.14')
      done()
    })
  })
})

/**
Stopped -> Starting -> Started (timeout)
Stopped -> Starting -> Started (message)
Stopped -> Starting (unexpected exit)
Stopped -> Starting (kill)
Stopped -> Starting -> Started (unexpected exit)
Stopped -> Starting -> Started (kill)
**/
describe(path.basename(__filename) + ' start-stop', () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(appBallsDir)
    mkdirp.sync(appifiDir)
    mkdirp.sync(tmpDir)
  })


  it('Stopped -> Starting -> Started by timeout (16s), f4408b40', function (done) {
    this.timeout(30000)

const fakeScript1 = `setInterval(() => console.log('tick'), 1000)`

    let tarball = 'testdata/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz'
    child.execSync(`tar xzf ${tarball} -C ${appifiDir}`)
    let appPath = path.join(appifiDir, 'build', 'app.js')
    fs.writeFileSync(appPath, fakeScript1)

    let appifi = new Appifi(mctx)
    appifi.once('Stopped', () => {
      
      appifi.state.setState('Starting')
      appifi.once('Started', () => {
        console.log(appifi)
        done()
      })
    })
  })

  it('Stopped -> Starting -> Started (message), dcb48b67', function (done) {
    this.timeout(30000)

const fakeScript2 = `
setInterval(() => console.log('tick'), 1000)
setTimeout(() => process.send('started ------------ '), 1000)
`

    let tarball = 'testdata/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz'
    child.execSync(`tar xzf ${tarball} -C ${appifiDir}`)
    let appPath = path.join(appifiDir, 'build', 'app.js')
    fs.writeFileSync(appPath, fakeScript2)

    let appifi = new Appifi(mctx)
    appifi.once('Stopped', () => {
      
      appifi.state.setState('Starting')
      appifi.once('Started', () => {
        done()
      })
    })
  }) 

  it('Stopped -> Starting (unexpected exit), ecc3791f', function (done) {
    this.timeout(30000)

const fakeScript = `setTimeout(() => process.exit(1), 3000)`

    let tarball = 'testdata/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz'
    child.execSync(`tar xzf ${tarball} -C ${appifiDir}`)
    let appPath = path.join(appifiDir, 'build', 'app.js')
    fs.writeFileSync(appPath, fakeScript)

    let appifi = new Appifi(mctx)
    appifi.once('Stopped', () => {
      appifi.state.setState('Starting')
      appifi.on('Starting', () => {
        console.log('Appifi starting again, and again')
      })
    })
   
  }) 

  it('Stopped -> Starting (kill), 786874fb', function (done) {
    this.timeout(30000)

const fakeScript = `setInterval(() => console.log('tick'), 1000)`

    let tarball = 'testdata/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz'
    child.execSync(`tar xzf ${tarball} -C ${appifiDir}`)
    let appPath = path.join(appifiDir, 'build', 'app.js')
    fs.writeFileSync(appPath, fakeScript)

    let appifi = new Appifi(mctx)
    appifi.once('Stopped', () => {
      appifi.state.setState('Starting')
      setTimeout(() => {
        appifi.state.kill()

        appifi.once('Stopped', () => done())

      }, 1000)
    })
  }) 

  it('Stopped -> Starting -> Started (unexpected exit), 01211d54', function (done) {
    this.timeout(30000)

const fakeScript = `
setInterval(() => console.log('tick'), 1000)
setTimeout(() => process.send('child started'), 1000)
setTimeout(() => process.exit(1), 3000)
`

    let tarball = 'testdata/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz'
    child.execSync(`tar xzf ${tarball} -C ${appifiDir}`)
    let appPath = path.join(appifiDir, 'build', 'app.js')
    fs.writeFileSync(appPath, fakeScript)

    let appifi = new Appifi(mctx)
    appifi.once('Stopped', () => {
      appifi.state.setState('Starting') 
      appifi.on('Starting', () => {
        console.log('Appifi starting again and again')
      })
    })
  })

  it('Stopped -> Starting -> Started (kill), 9e2a38e2', function (done) {
    this.timeout(30000)

const fakeScript = `
setInterval(() => console.log('tick'), 1000)
setTimeout(() => process.send('child started'), 1000)
`

    let tarball = 'testdata/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz'
    child.execSync(`tar xzf ${tarball} -C ${appifiDir}`)
    let appPath = path.join(appifiDir, 'build', 'app.js')
    fs.writeFileSync(appPath, fakeScript)

    let appifi = new Appifi(mctx)
    appifi.once('Stopped', () => {
      appifi.state.setState('Starting')
     
      appifi.on('Started', () => {
        setImmediate(() => {
          appifi.state.kill()

          appifi.once('Stopped', () => done())
        })
      }) 
    })
  }) 

})
