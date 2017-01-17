import https from 'https'
import fs from 'fs'
import child from 'child_process'

import respawn from 'respawn'
import rimraf from 'rimraf'
import { createStore, combineReducers } from 'redux'

import releaseDownloader from './releaseDownloader'
import { describe, parseJSON, mkdirpAsync, readdirAsync, 
  readFileAsync, rimrafAsync, testTarballAsync, probeTarballs, probeAppifi,
  retrieveReleasesAsync, extractTarballAsync, tagValue } from './utils'

const releasesUrl = 'https://api.github.com/repos/wisnuc/appifi-release/releases'

const tarballsDir = '/wisnuc/appifi-tarballs'
const tmpDir = '/wisnuc/appifi-tmp'
const appifiDir = '/wisnuc/appifi'

const defaultCurrentState = {
  id : null,
  process: null,
}

const devmode = (state = false, action) => {

  switch(action.type) {
  case 'DEVMODE_ON':
    return true
  default:
    return state
  }
}

const current = (state = defaultCurrentState, action) => {

  switch(action.type) {
  case 'APPIFI_INSTALLED':
    return { id: action.data.id, process: null }

  case 'APPIFI_UNINSTALLED':
    return defaultCurrentState

  case 'APPIFI_STARTED':
    return Object.assign({}, state, { process: action.data })

  case 'APPIFI_STOPPED':
    return Object.assign({}, state, { process: null })

  default:
    return state
  }
}

const locals = (state = [], action) => {

  let r

  switch(action.type) {
  case 'LOCALS_UPDATE':
    return action.data

  case 'LOCAL_DELETE':
    return [...state.slice(0, action.data), ...state.slice(action.data+1)]

  case 'LOCAL_ADD':
    r = [...state, action.data].sort((a, b) => 
      tagValue(b.release.tag_name) - tagValue(a.release.tag_name))
    return r
  
  default:
    return state
  }
}

const remotes = (state = [], action) => {

  switch(action.type) {
  case 'REMOTES_UPDATE':
    return action.data

  default:
    return state
  }
}

const releaseLoading = (state = false, action) => {

  switch(action.type) {
  case 'RELEASE_LOAD_START':
    return true 

  case 'RELEASE_LOAD_STOP':
    return false

  default:
    return state
  }
}

const downloads = (state = [], action) => {

  switch(action.type) {
  case 'DOWNLOAD_START': { 
    let index = state.findIndex(d => d.release.id === action.data.release.id)
    if (index === -1) {
      return [...state, action.data]
    }
    return [...state.slice(0, index), ...state.slice(index + 1), action.data]
  }
 
  default:
    return state
  }
}

let store = createStore(combineReducers({devmode, current, locals, remotes, releaseLoading, downloads}))
let status = 0

store.subscribe(() => { status++ })

const dispatch = (action) => store.dispatch(action)

let appifi

function startAppifi() {

  appifi = respawn(['node', 'build/app.js'], {
    cwd: appifiDir,
    env: {NODE_ENV: 'production'},
    sleep: [1000, 2000, 4000, 8000, 16000, 32000, 64000],
    maxRestarts: -1,
    stdio: 'inherit',
  })

  appifi.on('start', () => {
    console.log('[respawn]: appifi started')
    dispatch({
      type: 'APPIFI_STARTED',
      data: appifi 
    })
  })

  appifi.on('stop', () => {
    console.log('[respawn]: appifi stopped')
    dispatch({
      type: 'APPIFI_STOPPED'
    })
  })

  appifi.on('crash', () => console.log('[respawn]: appifi crashed'))
  appifi.on('sleep', () => console.log('[respawn]: appifi slept'))
  appifi.on('spawn', process => 
    console.log(`[respawn]: appifi spawned with pid ${process.pid}`))
  appifi.on('exit', (code, signal) => 
    console.log(`[respawn]: appifi exited with code ${code}, signal ${signal}`))

  appifi.start()
}

function deleteFruitmix(callback) {
  
  if (!appifi) return callback(new Error('not started'))
  fs.readFile('/etc/wisnuc.json', (err, data) => {
    if (err) return callback(err)

    let obj
    try {
      obj = JSON.parse(data.toString())        
    }
    catch (e) {
      if (e) return callback(new Error('wisnuc json parse failed'))
    }

    if (!obj.lastUsedVolume) return callback(new Error('no last used volume found'))

    let fruitroot = `/run/wisnuc/volumes/${obj.lastUsedVolume}/wisnuc/fruitmix`

    console.log(`fruitmix root is set to ${fruitroot}`)
    console.log('stopping appifi')
    appifi.stop(() => {
      console.log('removing fruitmix root')
      rimraf(fruitroot, err => {
        if (err) return callback(err)
        console.log('starting appifi')
        appifi.start()
        callback(null)
      })
    })
  })
}

// This function probe tarballs first,
// then probe appifi
// 1) if appifi not installed, extract latest release and start it
// 2) if appifi deployed but not in locals, remove it and goto 1)
// 3) if appifi deployed and in locals, start it
async function probeTarballAndStartAppifi() {

  let r = await probeTarballs(tarballsDir)
  if (r instanceof Error) return 
  dispatch({type: 'LOCALS_UPDATE', data: r})
  let locals = r
  console.log(`${locals.length} locals found`)
  
  r = await probeAppifi(appifiDir)
  if (r instanceof Error) {
    console.log(`appifi not found, rimraf anyway`)
    await rimrafAsync(appifiDir)
    r = null
  }

  if (r && locals.find(l => l.release.id === r.id)) {
    console.log(`appifi found deployed, with release id ${r.id}`)
    dispatch({type: 'APPIFI_INSTALLED', data: r })
    if (r.prerelease === true) dispatch({type: 'DEVMODE_ON'})
    startAppifi()
    return null
  }

  if (r) {
    console.log(`appifi found deployed but not in locals, with release id ${r.id}`)
    r = await rimrafAsync(appifiDir)
    if (r instanceof Error) return r
    console.log(`polluted appifi removed`)
  }

  if (locals.length === 0) return null
  r = await extractTarballAsync(locals[0].path, appifiDir) 
  if (r instanceof Error) return r
  dispatch({type: 'APPIFI_INSTALLED', data: locals[0].release})
  if (locals[0].release.prerelease === true) dispatch({type: 'DEVMODE_ON'})
  console.log(`appifi deployed with release id ${locals[0].release.id}`) 
  startAppifi()
  return null
}

async function init() {

  let r

  await rimrafAsync(tmpDir)
  await mkdirpAsync(tmpDir)
  await mkdirpAsync(tarballsDir)

  console.log(`first trial of probing tarballs and start appifi`)
  await probeTarballAndStartAppifi()  

  return await loadRelease()
}

const getCurrentState = () => {

  let current = store.getState().current
  let process = current.process ? true : false
  return Object.assign({}, current, { process })
}

const getDownloadStates = () => {
  
  return store.getState().downloads.map(down => {
    return {
      id: down.release.id,
      status: down.status,
      bytesWritten: down.bytesWritten,
      contentLength: down.contentLength
    }
  })
}

const getState = () => {

  let state = store.getState()
  return Object.assign({}, state, {
    status,
    remotes: state.devmode ? state.remotes : state.remotes.filter(r => r.prerelease !== true),
    current: getCurrentState(),
    downloads: getDownloadStates(),
    releaseLoading: state.releaseLoading
  })
}

const getStatus = () => { return { status }}

async function downloadAndUpdateLocals(release) {

  const desc = (e) => 
    describe(e, {
      when: 'downloadAndUpdateLocals',
      release
    })

  let download = new releaseDownloader(release, tarballsDir, tmpDir)
  download.on('update', d => dispatch({ type: 'TRIGGER' })) 
  dispatch({ type: 'DOWNLOAD_START', data: download })

  let r = await download.startAsync()
  if (r instanceof Error) return desc(r)

  dispatch({ type: 'LOCAL_ADD', data: {
    path: download.target,
    release
  }})

  return `id: ${release.id} tag: ${release.tag_name} successfully downloaded` 
}

async function deleteOp(id) {

  let r, {current, locals, remotes, downloads} = store.getState()

  if (id === current.id)
    return `Error: ${id} is installed`
  let index = locals.findIndex(l => l.release.id === id)
  if (index === -1)
    return `Error: ${id} not found in locals`

  await rimrafAsync(locals[index].path) 
  dispatch({type: 'LOCAL_DELETE', data: index})
  return 'deleted'
}

async function installOp(id) {

  let r, {current, locals, remotes, downloads} = store.getState()

  if (current.process) 
    return 'Error: appifi is running'

  if (current.id)
    return 'Error: already installed'

  r = locals.find(l => l.release.id === id)
  if (!r) return `Error: release id ${id} not found`

  let local = r

  r = await extractTarballAsync(local.path, appifiDir) 
  if (r instanceof Error) {
    r = describe(r, { 
      when: 'installOp', 
      local
    }) 
    console.log(r)
    return 'Error: extracting tarball failed'
  }

  dispatch({type: 'APPIFI_INSTALLED', data: local.release})
  console.log(`appifi deployed with release id ${local.release.id}`) 

  return 'successfully installed'
}

async function uninstallOp() {

  let {current, locals, remotes, downloads} = store.getState()

  if (current.process)
    return 'Error: appifi is running'
  if (!current.id)
    return 'Error: not installed'

  await rimrafAsync(appifiDir)
  dispatch({type: 'APPIFI_UNINSTALLED'})

  console.log(`appifi uninstalled`)
  return 'successfully uninstalled'
}

async function loadRelease() {

  let r

  dispatch({ type: 'RELEASE_LOAD_START' })

  console.log(`retrieving remote releases`)
  r = await retrieveReleasesAsync(releasesUrl) 
  if (!(r instanceof Error)) { 
    dispatch({ type: 'REMOTES_UPDATE', data: r })
    console.log(`${r.length} remotes found`)
  }
  else {
    console.log(`failed to load releases`)
  }

  dispatch({ type: 'RELEASE_LOAD_STOP' })
  return (r instanceof Error) ? r : null
}

function operation(data, callback) {

  let {current, locals, remotes, downloads} = store.getState()

  const m = (msg) => callback(null, {message: msg})

  switch(data.operation) {
  case 'RELOAD_RELEASE': {
    if (!store.getState().releaseLoading) 
      loadRelease().then(() => {}).catch(e => {})
    return m('Loading')
  }

  case 'DOWNLOAD': {
    if (locals.find(l => l.release.id === data.id))
      return m('Error: already downloaded')
    if (downloads.find(d => d.id === data.id))
      return m('Error: already downloading')

    let r = remotes.find(r => r.id === data.id)
    if (!r)
      return m(`Error: release id ${id} not found`)

    downloadAndUpdateLocals(r)
      .then(r => console.log(r))
      .catch(e => console.log(e))
    return m('download started')
  }

  case 'DELETE': {
    deleteOp(data.id)
      .then(r => callback(null, {message: r}))
      .catch(e => {
        console.log(e)
        callback(e)
      })
    return
  }

  case 'INSTALL':
    installOp(data.id)
      .then(r => callback(null, {message: r}))
      .catch(e => callback(e))  
    return

  case 'UNINSTALL':
    uninstallOp()
      .then(r => callback(null, {message: r}))
      .catch(e => callback(e))
    return

  case 'STOP_APPIFI':
    if (!current.id)
      return callback(null, {message: 'Error: appifi not installed'})
    if (!current.process) {
      return callback(null, {message: 'WARNING: appifi is not running'})
    }
    current.process.stop()
    return callback(null, {message: 'KILL signal sent to appifi process'})

  case 'START_APPIFI':
    if (!current.id) 
      return callback(null, {message: 'Error: appifi not installed'})
    if (current.process) 
      return callback(null, {message: 'Error: appifi is already running'})
    startAppifi()
    return callback(null, {message: 'appifi started'})
 
  default:
    return callback(null, {message: `ERROR: ${data.operation} not implemented`})
  }
}

export default { init, getState, getStatus, operation, dispatch, deleteFruitmix }








