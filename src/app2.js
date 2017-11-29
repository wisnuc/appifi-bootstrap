const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))

const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimraf = require('rimraf')
const rimrafAsync = Promise.promisify(rimraf)

const express = require('express')
const bodyParser = require('body-parser')
const morgan = require('morgan')

const init = require('./init')

const app = express()

app.use(morgan('combined'))
app.use(bodyParser.json())

app.get('/ping', (req, res) => res.status(200).json({ message: 'pong' }))

init((err, 

  app.listen(3001, function() {
    console.log('appifi-bootstrap listening on port 3001')  
  })
 
init(

/** constants **/

const githubUrl = 'https://api.github.com/repos/wisnuc/appifi-release/releases'

init((err, model) => {

  
})








