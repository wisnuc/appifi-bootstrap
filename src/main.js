import path from 'path'

import app from './app'

app.get('/', (req, res) => 
  res.set('Content-Type', 'text/html')
    .sendFile(path.join(__dirname, '../public/index.html')))

app.get('/bundle.js', (req, res) => 
  res.set('Content-Type', 'application/javascript')
    .sendFile(path.join(__dirname, '../public/bundle.raw')))

app.get('/stylesheets/style.css', (req, res) => 
  res.set('Content-Type', 'text/css')
    .sendFile(path.join(__dirname, '../public/stylesheets/style.css')))


