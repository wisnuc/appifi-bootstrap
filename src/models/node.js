const path = require('path')
const fs = require('fs')

const mkdirp = require('mkdirp')
const UUID = require('uuid')

const debug = require('debug')('node')

const download = require('./download')

class State {

  constructor(ctx, ...args) {
    this.ctx = ctx
    this.enter()
  }

  setState (state, ...args) {
    this.exit()
    let Next = this.ctx[state]
    new Next(this.ctx, ...args)
  }

  enter () {
    debug(`node enter ${this.constructor.name} state`)
  }

  exit () {
    debug(`node exit ${this.constructor.name} state`)
  }

  destroy () {
    this.exit()
  }
}

// this is hard-coded now
const defaultBaseVersion = '8.9.1'

const getNodeVersion = name => {
  let major, minor, build

  let arr = name.split('.')
  if (arr.length !== 3) return null

  let major = parseInt(arr[0]) 
  let minor = parseInt(arr[1])
  let build = parseInt(arr[2])

  // is natural number 
  const isNN = number => Number.isInteger(number) && number >= 0

  return isNN(major) && isNN(minor) && isNN(build)) 
    ? { major, minor, build }
    : null
}


class Init extends State {

  enter () {
    super.enter()

    this.scanAsync()
      .then(nodes => {
        if (nodes.length === 0) {
          this.setState('Downloading')
        } else {
          this.ctx.nodes = nodes
          this.setState('Idle')
        } 
      })
      .catch(e => this.setState('Failed', err))
  }

  // retrieve base link and dirs
  scan (callback) {
    this.scanAsync()
      .then(x => this.setState('Idle', x))
      .catch(err => this.setState('Failed', err))
  }

  async scanAsync () {
    let base, entries, nodes 

    await mkdirpSync(this.ctx.rootDir)
    entries = await fs.readdirAsync(this.ctx.rootDir)
    
    // generate node objects
    let nodes = entries.reduce((acc, name) => {
      let node = getNodeVersion(name)
      if (node) acc.push(Object.assign({ name }, node))
      return acc
    })

    if (entries.includes('base')) {
      let basePath = path.join(this.ctx.rootDir, 'base')
      let stat = await fs.lstatAsync(basePath)
      if (!stat.isSymbolicLink()) {
        await rimrafAsync(basePath) 
      } else {
        base = await fs.readlinkAsync(err, linkString)
      }
    }

    return { base, nodes }
  }

}

class Downloading extends State {

  enter (name, url) {
    super.enter()

    this.name = name
    this.url = url
    this.tmpFile = path.join(this.ctx.tmpDir, UUID.v4()) 
    this.tmpDir = path.join(this.ctx.tmpDir, UUID.v4())
    
    this.download = download(url, this.tmpFile, err => {
      this.download = null
      if (err) return this.setState('Failed', err)

      this.untar = untar(this.tmpFile, this.tmpDir, err => {
        this.untar = null
        if (err) return this.setState('Failed', err)

        let newPath = path.join(this.ctx.rootDir, this.name)
        fs.rename(this.tmpDir, newPath, err => {
          if (err) return this.setState('Failed', err)

          // enter idle TODO
        })
      })  
    }) 
  }
}

class Node {

  constructor(rootDir) {
    this.rootDir = rootDir
    this.nodes = []
    new Init(this)
  }


}

Node.Init = Init
Node.Downloading = Downloading

module.exports = Node






