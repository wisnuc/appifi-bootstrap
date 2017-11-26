const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

const expect = require('chai').expect

const { inject, cherryPick, untarDry, untar } = require('src/lib/tarball') 

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')

describe(path.basename(__filename), () => {

  let dirPath = path.join(tmptest, 'dir')

  beforeEach(() => {
    rimraf.sync(tmptest) 
    mkdirp.sync(dirPath)
  })

  it('should inject hello (world) into 0.9.14.tar.gz', function (done) {
    // 10 seconds
    this.timeout(10000)

    let newPath = path.join(tmptest, 'output.tar.gz')
    inject('testdata/0.9.14.tar.gz', newPath, 'hello', 'world', err => {
      if (err) return done(err)
      let cmd = `tar xzf ${newPath} -C ${dirPath}`
      console.log('cmd: ', cmd)
      child.execSync(cmd)
      let hello = fs.readFileSync(path.join(dirPath, 'hello'))      
      expect(hello.toString()).to.equal('world')
      done()
    })
  })

  it('cherryPick .release.json from appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz, 663d20f6', function (done) {
    cherryPick('testdata/appifi-0.9.14-8501308-c8ffd8ab-rel.tar.gz', './.release.json', (err, out) => {
      let obj = JSON.parse(out)
      expect(obj['target_commitish']).to.equal('c8ffd8ab973c916f88c14e4df47292e2bc0d71a3')
      done()
    })
  })

  it('untarDry 0.9.14.tar.gz should succeed, c4b67930', done => {
    untarDry('testdata/0.9.14.tar.gz', err => done(err))
  }) 

  it('untar 0.9.14.tar.gz should succeed, b3793b22', done => {
    untar('testdata/0.9.14.tar.gz', dirPath, err => done(err))
  }) 
})

