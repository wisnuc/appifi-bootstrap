const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)

const expect = require('chai').expect

const Node = require('src/models/node')

const cwd = process.cwd()
const tmptest = path.join(cwd, 'tmptest') 
const nodeDir = path.join(tmptest, 'node')
const tmpDir = path.join(tmptest, 'tmp')

describe(path.basename(__filename), () => {

  beforeEach(() => {
    rimraf.sync(tmptest)
    mkdirp.sync(nodeDir)
    mkdirp.sync(tmpDir)
  })

  it('scan empty dir', done => {
    let node = new Node(nodeDir, tmpDir)
    done()
  })
})
