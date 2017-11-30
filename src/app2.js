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

/** constants **/
const githubUrl = 'https://api.github.com/repos/wisnuc/appifi-release/releases'

const rootarg = process.argv
  .find((arg, idx, arr) => {
    if (idx === 0) return false
    if (arr[idx - 1] === '--root') return true
    return false
  })

const root = path.resolve(rootarg) || '/wisnuc'

console.log(`root is ${root}`)

const html = `
<html>
  <title>WISNUC Bootstrap</title>
  <body>
    <p>请使用PC，Mac或移动应用程序访问此页面。</p>
    <p>請使用PC，Mac或移動應用程序訪問此頁面。</p>
    <p>Please use PC, Mac, or mobile apps to access this page.</p>
  </body>
</html>
`

const app = express()
app.use(morgan('dev'))
app.use(bodyParser.json())

app.get('/', (req, res) => res.status(200).send(html))
app.get('/ping', (req, res) => res.status(200).json({ message: 'pong' }))

init(root, githubUrl, (err, model) => {

  if (err) {
    console.log('init error', err)
    app.get('/v1', (req, res) => res.status(503).json({ message: err.message, code: err.code }))
  } else {

    // GET whole view
    app.get('/v1', (req, res) => res.status(200).json(model.view()))

    // Start or Stop App
    app.patch('/v1/app', (req, res, next) => {
      let { state } = req.body
      if (state !== 'Started' && state !== 'Stopped') {
        res.status(400).json({ message: 'state must be either Started or Stopped'})
      } else {
        if (state === 'Started') {
          model.appStart(err => err ? next(err) : res.status(200).end())
        } else {
          model.appStop(err => err ? next(err) : res.status(200).end())
        }
      }
    })

    // Install App
    app.put('/v1/app', (req, res, next) => 
      model.appInstall(req.body.tagName, err => err ? next(err) : res.status(200).end()))

    // Start download instantly
    app.patch('/v1/releases/:tagName', (req, res, next) => 
      model.releaseStart(req.params.tagName, err => err ? next(err) : res.status(200).end()))

    // Stop download instantly
    app.patch('/v1/releases/:tagName', (req, res, next) => 
      model.releaseStop(req.params.tagName, err => err ? next(err) : res.status(200).end()))

    // Start refresh instantly
    app.patch('/v1/fetch', (req, res, next) => 
      model.fetchStart(err => err ? next(err) : res.status(200).end()))
  }  

  app.use(function (req, res, next) {
    let err = new Error('404 not found')
    err.status = 404
    next(err)
  })

  app.use(function (err, req, res, next) {
    res.status(err.status || 500).json({
      message: err.message,
      code: err.code,
      xcode: err.xcode 
    }) 
  })

  app.listen(3001, err => {
    if (err) {
      console.log('failed to listen on port 3001, process exit')
      return process.exit(1)
    } else {
      console.log('Bootstrap started')
    }
  }) 

})








