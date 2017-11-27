const path = require('path')
const fs = require('fs')
const child = require('child_process')
const express = require('express')
const bodyParser = require('body-parser')
const logger = require('morgan')

const respawn = require('respawn')
const UUID = require('uuid')

const hostname = require('./lib/hostname')

const worker = require('./worker')
worker.init().then(r => console.log('worker initialized')).catch(e => console.log(e))

const app = express()

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

app.listen(3001, function() {

  // try to broadcasting
  child.exec('which avahi-publish-service', err => {
    if (err) return consolelog('avahi publish service not found, no broadcasting')

    hostname(() => {})
   
    let pub, args = ['WISNUC Appifi Boostrap', '_http._tcp', '3001']
    const spawn = () => { 
      pub = child.spawn('avahi-publish-service', args)
      pub.on('error', err => console.log('avahi pub error', err))
      pub.stdout.on('data', data => console.log(`avahi pub stdout: ${data}`))
      pub.stderr.on('data', data => console.log(`avahi pub stderr: ${data}`))
      pub.on('close', (code, signal) => {
        console.log(`avahi pub closed with code: ${code}, signal: ${signal}`) 
        // respawn
        setTimeout(() => spawn(), 3000)
      })
    }

    spawn()
  })
})

module.exports = app

