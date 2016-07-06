var path = require('path')
var express = require('express')
var bodyParser = require('body-parser')
var logger = require('morgan')

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

app.get('/devmode', (req, res) => {
  worker.dispatch({ type: 'DEVMODE_ON' }) 
  console.log('<<< developer mode on >>>')
  res.status(200).json({ message: 'developer mode enabled!'})
})

app.post('/operation', (req, res) => {
  worker.operation(req.body, (e, r) => {
    if (e) return res.status(500).json({ message: e.message }) 
    return res.status(200).json(r)  
  })
})

app.listen(3001, function() {
  console.log('Example app listening on port 3001!')
})

export default app
