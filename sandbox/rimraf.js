const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')

const expect = require('chai').expect

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest')


/**

These tests proves that rimraf will remove the symbolic link, at least for file

*/

describe(path.basename(__filename), () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(tmptest)
    // write tmptest/hello with world
    fs.writeFileSync(path.join(tmptest, 'hello'), 'world')
    fs.symlinkSync('hello', 'tmptest/link-to-hello')
  })

  it('readback tmptest/link-to-hello should get world', done => {
    let data = fs.readFileSync('tmptest/link-to-hello')
    expect(data.toString()).to.equal('world')
    done()
  })

  it('readback tmptest/link-to-hello should get world', done => {
    rimraf('tmptest/link-to-hello', err => {
      if (err) return done(err)
      // hello is intact
      let data = fs.readFileSync('tmptest/hello')
      expect(data.toString()).to.equal('world')
      
      // link removed
      fs.lstat('tmptest/link-to-hello', err => {
        expect(err.code).to.equal('ENOENT')
        done()
      })
    })
  })
})


