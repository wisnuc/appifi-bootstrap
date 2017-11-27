const path = require('path')

const express = require('express')
const bodyParser = require('body-parser')
const morgan = require('morgan')

const Model = require('./model')

// const model = new Model()
const app = express()

app.use(morgan('combined'))
app.use(bodyParser.json())

app.get('/ping', (req, res) => res.status(200).json({ message: 'pong' }))

app.listen(3001, function() {
  console.log('appifi-bootstrap listening on port 3001')  
})

