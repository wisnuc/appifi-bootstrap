const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const child = require('child_process')
const EventEmitter = require('events')

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const UUID = require('uuid')

const debug = require('debug')('node')

const download = require('../lib/download')

const Base = require('./state')

class State extends Base {

}

// this is hard-coded now
const defaultBaseVersion = '8.9.1'
const defaultBaseVersionUrl = process.arch === 'x64' 
  ? 'https://nodejs.org/dist/v8.9.1/node-v8.9.1-linux-x64.tar.xz'
  : 'https://nodejs.org/dist/v8.9.1/node-v8.9.1-linux-arm64.tar.xz'

const getNodeVersion = name => {
  let major, minor, build

  let arr = name.split('.')
  if (arr.length !== 3) return null

  major = parseInt(arr[0]) 
  minor = parseInt(arr[1])
  build = parseInt(arr[2])

  // is natural number 
  const isNN = number => Number.isInteger(number) && number >= 0

  return isNN(major) && isNN(minor) && isNN(build)
    ? { major, minor, build }
    : null
}


class Init extends State {

  enter () {
    super.enter()

    this.scanAsync()
      .then(nodes => {
        if (nodes.length === 0) {
          this.setState('Downloading', defaultBaseVersion, defaultBaseVersionUrl)
        } else {
          this.ctx.nodes = nodes
          this.setState('Idle')
        } 
      })
      .catch(err => console.log(err) || this.setState('Idle', err))
  }

  async scanAsync () {
    let base, entries, nodes 

    await mkdirpAsync(this.ctx.nodeDir)
    entries = await fs.readdirAsync(this.ctx.nodeDir)
    
    // generate node objects
    nodes = entries.reduce((acc, name) => {
      let node = getNodeVersion(name)
      if (node) acc.push(Object.assign({ name }, node))
      return acc
    }, [])

    if (entries.includes('base')) {
      let basePath = path.join(this.ctx.nodeDir, 'base')
      let stat = await fs.lstatAsync(basePath)
      if (!stat.isSymbolicLink()) {
        throw new Error('node base is not a symlink')
      } else {
        let linkString = await fs.readlinkAsync(basePath)
        let baseNode = nodes.find(n => n.name === linkString)
        if (!baseNode) {
          throw new Error('node base link string not found')
        }

        baseNode.isBase = true
      }
    }

    return nodes
  }

}

class Idle extends State {

  enter (err, data) {
    super.enter()
    this.err = err || null
    this.data = data || null
  }
}

class Downloading extends State {

  enter (name, url) {
    super.enter()

    this.name = name
    this.url = url
    this.tmpFile = path.join(this.ctx.tmpDir, UUID.v4()) 
    this.tmpDir = path.join(this.ctx.tmpDir, UUID.v4())
    this.target = path.join(this.ctx.nodeDir, name)

    let baselink = path.join(this.ctx.nodeDir, 'base')
    
    this.download = download(url, this.tmpFile, err => {
      this.download = null
      if (err) return this.setState('Failed', err)

      mkdirp(this.tmpDir, err => {
        let cmd = `tar xJf ${this.tmpFile} -C ${this.tmpDir} --strip-components=1`
        child.exec(cmd, (err, stdout, stderr) => {
          fs.rename(this.tmpDir, this.target, err => {
            fs.symlink(this.name, baselink, err => {
              console.log(err)
              this.setState('Idle')
            })
          })
        })
      })

    }) 
  }
}

/**

In current version the sole purpose of this module is to install base version, aka, 8.9.1

*/

// node accepts a rootdir 
class Node extends EventEmitter {

  constructor(nodeDir, tmpDir) {
    super()
    this.nodeDir = nodeDir
    this.tmpDir = tmpDir
    this.nodes = []

    new Init(this)
  }

  getBaseNode () {
    return this.nodes.find(n => n.isBase)
  }
}

Node.prototype.Init = Init
Node.prototype.Idle = Idle
Node.prototype.Downloading = Downloading

module.exports = Node






