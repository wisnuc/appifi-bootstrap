var path = require('path')
var express = require('express')
var bodyParser = require('body-parser')
var logger = require('morgan')
var respawn = require('respawn')

import worker from './worker'
worker.init().then(r => console.log(r)).catch(e => console.log(e))

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

app.post('/operation', (req, res) => {
  worker.operation(req.body, (e, r) => {
    if (e) return res.status(500).json({ message: e.message }) 
    return res.status(200).json(r)  
  })
})

app.listen(3001, function() {

  console.log('WISNUC Bootstrap listening on port 3001!')

  var pub = respawn([
    'avahi-publish-service', 
    'WISNUC Appifi Bootstrap', 
    '_http._tcp', 
    '3001'
  ], {
    maxRestarts: 1000,
    sleep: 30000,
  })

  pub.on('spawn', () => 
    console.log('publishing WISNUC:Bootstrap @ http:3001'))
  pub.on('exit', (code, signal) => 
    console.log(`avahi publish exit with code: ${code}, signal: ${signal}`))

  pub.start()
})

export default app
