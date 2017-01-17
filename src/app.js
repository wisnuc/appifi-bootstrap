var fs = require('fs')
var path = require('path')
var child = require('child_process')
var express = require('express')
var bodyParser = require('body-parser')
var logger = require('morgan')
var respawn = require('respawn')
var UUID = require('node-uuid')

import worker from './worker'
worker.init().then(r => console.log('worker initialized')).catch(e => console.log(e))

var app = express()

app.use(logger('dev', {
  skip: (req) => {
    if (req.path.endsWith('/status')) return true
    return false
  }
}))

app.use(bodyParser.json())

app.get('/state/status', (req, res) =>
  res.status(200).json(worker.getStatus()))

app.get('/state', (req, res) =>
  res.status(200).json(worker.getState()))

app.get('/test', (req, res) => {
  res.status(200).json({hello: 'world'})
})

app.get('/developer', (req, res) => {
  worker.dispatch({ type: 'DEVMODE_ON' })
  res.status(200).send('<html><head><meta http-equiv="refresh" content="3;url=/" /></head>' +
    '<body><h3>Beta release available now, redirecting in 3 seconds...</h3></body></html>')
})

app.get('/log', (req, res) => {

  let cmd
  try {
    cmd = child.spawn('journalctl', ['-u', 'appifi-bootstrap'])  
  }
  catch (e) {
    console.log(e)
    return res.status(500).json({ message: 'spawn failed' })
  }

  cmd.stdout.pipe(res)
})

app.delete('/fruitmix', (req, res) => {

  // developer mode must be on
  if (!worker.getState().devmode)
    return res.status(404).end()

  // dangerous file (or directory) must exists
  fs.stat('/run/wisnuc/dangerous', (err, stats) => {
    if (err) return res.status(404).end() 
    worker.deleteFruitmix(err => {
      if (err) return res.status(500).json(err)
      return res.status(200).json({ message: 'success' })
    }) 
  })
})

app.post('/operation', (req, res) => {
  worker.operation(req.body, (e, r) => {
    if (e) return res.status(500).json({ message: e.message })
    return res.status(200).json(r)
  })
})

const sysinfo = (callback) => {

  fs.stat('/proc/BOARD_io', (err, stats) => {

    let model, serial, uuid, count

    const finish = () => (!--count) && callback(null, { model, serial, uuid })

    if (err && err.code === 'ENOENT') {

      model = 'generic'
      count = 2

      child.exec('dmidecode -s system-serial-number', (err, stdout) =>
        finish(err || (serial = stdout.toString().trim())))
      child.exec('dmidecode -s system-uuid', (err, stdout) =>
        finish(err || (uuid = stdout.toString().trim())))
    }
    else if (err) {
      callback(err)
    }
    else {

      model = 'ws215i'
      count = 1

      child.exec('dd if=/dev/mtd0ro bs=1 skip=1697760 count=11', (err, stdout) =>
        finish(err || (serial = stdout.toString().trim())))
    }
  })
}

const sanitize = (string) => {

  if (string.startsWith('VMware-')) {
    let sub = string.slice(7).replace('-', ' ').split(' ').join('')
    if (/^[0-9a-fA-F]{32}$/.test(sub))
      string = sub 
  }

  return string.split('').filter(c => /^[A-Za-z0-9]$/.test(c)).join('') 
}

app.listen(3001, function() {

  let tmp001 = "VMware-56 4d 6d 71 82 d1 fe a9-63 e4 03 75 4e d5 34 7a"
  let tmp002 = "564D6D71-82D1-FEA9-63E4-03754ED5347A"

  console.log(`sanitize "${tmp001}" to ${sanitize(tmp001)}`)
  console.log(`sanitize "${tmp002}" to ${sanitize(tmp002)}`)

  console.log('WiSNuC Appifi Bootstrap listening on port 3001!')

  child.exec('which avahi-publish-service', err => {

    if (err) {
      console.log('avahi publish service not found, no broadcasting')
      return
    }

    var pub = respawn([
      'avahi-publish-service',
      'WISNUC Appifi Boostrap',
      '_http._tcp',
      '3001'
    ], {
      maxRestarts: 1000,
      sleep: 30000,
    })

    pub.on('spawn', () =>
      console.log('avahi advertising "WISNUC Appifi Bootstrap" @ http:3001'))
    pub.on('exit', (code, signal) =>
      console.log(`avahi-publish-service exit with code: ${code}, signal: ${signal}, respawn later`))

    pub.start()

  })

  sysinfo((err, info) => {

    let hostname
    if (err)
      hostname = `wisnuc-tmp-${UUID.v4()}`
    else {

      let { model, serial, uuid } = info
      serial = sanitize(serial)
      if (uuid) uuid = sanitize(uuid)

      if (typeof serial === 'string' && serial.length >= 8)
        hostname = `wisnuc-${model}-${serial}`
      else if (typeof uuid === 'string' && uuid.length >= 8)
        hostname = `wisnuc-${model}-${uuid.slice(0, 8)}`
      else
        hostname = `wisnuc-tmp-${sanitize(UUID.v4()).slice(0, 8)}`
    }

    child.exec(`avahi-set-host-name ${hostname}`, err => {
      console.log(`avahi set hostname to ${hostname}`)
    })
  })
})

export default app
