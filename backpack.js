const app = require('./src/app')
const html = require('raw!./public/index.html')
const js = require('raw!./public/bundle.raw')
const css = require('raw!./public/stylesheets/style.css')

app.get('/', (req, res) => res.set('Content-Type', 'text/html').send(html))
app.get('/bundle.js', (req, res) => res.set('Content-Type', 'application/javascript').send(js))
app.get('/stylesheets/style.css', (req, res) => res.set('Content-Type', 'text/css').send(css))


