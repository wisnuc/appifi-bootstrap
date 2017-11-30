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
    // backward compatiblility
    app.get('/developer', (req, res) => {
      // worker.dispatch({ type: 'DEVMODE_ON' })
      model.useBeta = true
      res.status(200).send('<html><head><meta http-equiv="refresh" content="3;url=/" /></head>' +
        '<body><h3>Beta release available now, redirecting in 3 seconds...</h3></body></html>')
    })

    app.get('/v1', (req, res) => res.status(200).json(model.view()))
  }  

  app.listen(3001, function() {
    console.log('Bootstrap started')
  }) 

})








