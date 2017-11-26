

const debug = require('debug')('deb')

const State = require('./state')

class Idle extends State {

  enter () {
    super.enter()
  }

}

const isDpkgInstalled = (name, callback) => 
  child.exec(`dpkg -s ${name}`, (err, stdout) => err
    ? callback(err)
    : callback(null, !!stdout.toString()
        .split('\n')
        .filter(l => l.length)
        .map(l => l.trim())
        .find(l => l.startsWith('Status:') && l.endsWith('installed'))))

class Installing extends State {

  enter (name) {
    super.enter()

    this.name = name 
    child.exec(`apt-get -y install ${name}`, opts, err => {
      // FIXME
    })
  } 
}

const isDpkgInstalled = (name, callback) => 
  child.exec(`dpkg -s ${name}`, (err, stdout) => err
    ? callback(err)
    : callback(null, !!stdout.toString()
        .split('\n')
        .filter(l => l.length)
        .map(l => l.trim())
        .find(l => l.startsWith('Status:') && l.endsWith('installed'))))

const opts = {
  stdio: ['ignore', process.stdout, process.stderr],
  timeout: 1000 * 120
}

class Deb {

  constructor() {
    this.map = new Map()
  }

  add (name) {
    if (this.map.has(name) return

    
  }

  view () {
    return null
  }
}

Deb.Idle = Idle
Deb.Installing = Installing

module.exports = Deb

