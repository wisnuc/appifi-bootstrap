const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const expect = require('chai').expect

const Fetch = require('src/models/fetch')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest') 

const defaultUrl = 'https://api.github.com/repos/wisnuc/appifi-release/releases'

describe(path.basename(__filename), () => {

  it('new Fetch should have default url', done => {
    let fetch = new Fetch() 
    expect(fetch.url).to.equal(defaultUrl)
    done()  
  }) 

  it('new Fetch should have given url', done => {
    let url = 'https://www.google.com'
    let fetch = new Fetch(url) 
    expect(fetch.url).to.equal(url)
    done()  
  }) 

  it('new Fetch should be in Working', done => {
    let fetch = new Fetch() 
    expect(fetch.state.constructor.name).to.equal('Working')
    done()  
  }) 

  it('new Fetch should retrieve default github release url', function (done) {
    this.timeout(10000)

    let fetch = new Fetch() 
    fetch.on('update', (err, data) => {
      if (err) {
        console.log(err)
        return done(err)
      }
      expect(data).to.be.an('array')
      expect(data.every(item => item.hasOwnProperty('tag_name'))).to.be.true
      done()
    })
  }) 

  it('new Fetch should fail with ENOTFOUND for [UUID].com', function (done) {
    this.timeout(0)

    let fetch = new Fetch('https://bd239c4e-df40-4f6a-b245-c074af937d18.com') 
    fetch.on('update', (err, data) => {
      expect(err.code).to.equal('ENOTFOUND')
      done()
    })

  }) 

  it('aborting idle fetch should do nothing', done => {
    let fetch = new Fetch() 
    fetch.on('update', (err, data) => {

      fetch.abort()  
      expect(fetch.state.constructor.name).to.equal('Idle')
      done()
    })
  }) 

  it('aborting working fetch should succeed', done => {
    let fetch = new Fetch() 

    fetch.on('update', (err, data) => {
      expect(err.code).to.equal('EABORT')
      expect(fetch.state.constructor.name).to.equal('Idle')
      done()
    })

    setImmediate(() => fetch.abort())
  })

})
