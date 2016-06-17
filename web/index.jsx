import React from 'react'
import ReactDom from 'react-dom'
import { createStore } from 'redux'
import request from 'superagent'

import ReactCSSTransitionGroup from 'react-addons-css-transition-group'

import injectTapEventPlugin from 'react-tap-event-plugin'
import getMuiTheme from 'material-ui/styles/getMuiTheme'
import * as colors from 'material-ui/styles/colors'
import { Avatar, FlatButton, RaisedButton, IconButton, Paper, Snackbar, CircularProgress, LinearProgress} from 'material-ui'
import MoreVert from 'material-ui/svg-icons/navigation/more-vert'

import Polling from './polling'

injectTapEventPlugin()

const defaultState = {
  server: null,
  serverOp: null,
  snackbarOpen: false,
  snackbarMessage: ''
}

const snack = (msg) => dispatch({ type: 'SNACKBAR_OPEN', data: msg })

const dispatchOp = (op, id, callback) => 
  dispatch({ 
    type: 'SERVER_OP', 
    data: { operation: op, id }, 
    callback
  })

const reducer = (state = defaultState, action) => {

  switch(action.type) {
  case 'SERVER_UPDATE':
    if (state.serverOp !== null && state.serverOp.complete) {
      return Object.assign({}, state, { server: action.data, serverOp: null })
    }
    return Object.assign({}, state, { server: action.data })

  case 'SERVER_OP': {
    if (state.serverOp) return state
    polling.stop()

    let callback = action.callback
    let req = request.post('/operation')
      .send({operation: action.data.operation, id: action.data.id})  
      .set('Accept', 'application/json')
      .end((err, res) => {
        dispatch({ type: 'SERVER_REPLY' })
        if (err && err.status) {
          snack(`Server Error: ${err.status} ${err.message}`)
        }
        else if (err) {
          snack(`Error: ${err.message}`)
        }
        else if (res.body && res.body.message) {
          snack(`${res.body.message}`)
        }
        else if (res.body) {
          snack(`Server replied with no message`)
        }
        else {
          snack(`Server replied with no body`)
        }
        if (callback) callback(err, res)
      })

    let serverOp = { 
      request : req, 
      data: action.data, 
      complete: false,
    }
    return Object.assign({}, state, { serverOp })
  }

  case 'SERVER_REPLY': {
    polling.start()
    let serverOp = Object.assign({}, store.getState().serverOp, { complete: true }) 
    return Object.assign({}, state, { serverOp })
  }

  case 'SNACKBAR_OPEN':
    return Object.assign({}, state, { snackbarOpen: true, snackbarMessage: action.data })

  case 'SNACKBAR_CLOSE':
    return Object.assign({}, state, { snackbarOpen: false, snackbarMessage: ''}) 

  default:
    return state
  }
}

const buildItems = () => {

  let {locals, remotes, current} = store.getState().server
  let items = []

  locals.forEach(l => {
    let r = l.release
    let item = {
      id: r.id,
      tag: r.tag_name,
      commit: r.target_commitish,
      prerelease: r.prerelease,
      create_time: r.created_at,
      publish_time: r.published_at,
      local: l,
      remote: null
    }
    items.push(item)
  })

  remotes.forEach(rel => {
    
    let found = items.find(item => item.id === rel.id)
    if (found) {
      found.remote = rel
      return
    }

    items.push({
      id: rel.id,
      tag: rel.tag_name,
      commit: rel.target_commitish,
      prerelease: rel.prerelease,
      create_time: rel.created_at,
      publish_time: rel.published_at,
      local: null,
      remote: rel
    }) 
  })

  return items.sort((a, b) => b.publish_time - a.publish_time)
}

const itemState = (item) => {

  let current = store.getState().server.current
  let downloads = store.getState().server.downloads

  let state
  if (item.local === null) {
    let down = downloads.find(down => down.id === item.id)
    if (down && (!(down.status === 'SUCCESS' || down.status === 'FAILED'))) {
      state = 'DOWNLOADING'
    }
    else {
      state = 'AVAILABLE' // subclass => just downloaded failed 
    }
  } 
  else if (current.id !== item.id) {
    state = 'DOWNLOADED' // subclass => just downloaded
  }
  else {
    state = 'INSTALLED'
  }
  return state
}

const itemDownloadSuccess = (item) => {

  let downloads = store.getState().server.downloads
  let down = downloads.find(down => down.id === item.id)
  if (down && down.status === 'SUCCESS') return true
  return false
}

const itemDownloadFailed = (item) => {
  let downloads = store.getState().server.downloads
  let down = downloads.find(down => down.id === item.id)
  if (down && down.status === 'FAILED') return true
  return false
}

const appifiInstalling = () => {

  let serverOp = store.getState().serverOp
  if (serverOp && serverOp.data && serverOp.data.operation === 'INSTALL')
    return true
  return false
}

const appifiUninstalling = () => {

  let serverOp = store.getState().serverOp
  if (serverOp && serverOp.data && serverOp.data.operation === 'UNINSTALL')
    return true
  return false
}

const itemInstalling = (item) => {

  let serverOp = store.getState().serverOp
  if (serverOp && serverOp.data && serverOp.data.operation === 'INSTALL' && serverOp.data.id === item.id)
    return true
  return false
}

const appifiStarting = () => {

  let serverOp = store.getState().serverOp
  if (serverOp && serverOp.data && serverOp.data.operation === 'START_APPIFI')
    return true
  return false
}

const appifiStopping = () => {

  let serverOp = store.getState().serverOp
  if (serverOp && serverOp.data && serverOp.data.operation === 'STOP_APPIFI')
    return true
  return false
}


// install button
const renderLeftButton = (item) => {

  let current = store.getState().server.current
  let state = itemState(item)

  switch (state) {
  case 'AVAILABLE':
    return null
  case 'DOWNLOADING':
    return null
  case 'DOWNLOADED':
    if (current.id) return null
    if (itemInstalling(item)) return null 
    return <RaisedButton style={{marginRight:16}} label='install this version' primary={true}
      onTouchTap={ () => dispatchOp('INSTALL', item.id) } />
  case 'INSTALLED':
    return null
  }
}

// download, cancel, delete button
const renderRightButton = (item) => {

  let current = store.getState().server.current
  let locals = store.getState().server.locals
  let state = itemState(item)

  switch(state) {
  case 'AVAILABLE':
    if (locals.length === 0)
      return <RaisedButton label='download' primary={true} onTouchTap={() => dispatchOp('DOWNLOAD', item.id)} /> 
    else
      return <FlatButton label='download' onTouchTap={() => dispatchOp('DOWNLOAD', item.id)} />

  case 'DOWNLOADING':
    return <div style={{width:200}}><LinearProgress /></div>
  case 'DOWNLOADED':
    return <FlatButton label='delete' onTouchTap={() => dispatchOp('DELETE', item.id)} /> 
  case 'INSTALLED':
    return null
  } 
}

const itemMessage = (item) => {

  let downloads = store.getState().server.downloads
  let r, state = itemState(item)

  if (state === 'AVAILABLE') {
    if (itemDownloadFailed(item)) {
      return 'Download failed'
    }
    return 'Available'
  } 
  else if (state === 'DOWNLOADING') {
    let down = downloads.find(d => d.id === item.id)
    switch(down.status) {
    case 'INIT':
      return 'Prepareing for download'
    case 'RETRIEVE_REDIRECT_LINK':
      return 'Retrieving file download link'
    case 'RETRIEVE_DOWNLOAD_STREAM':
      return 'Connecting to file download server'
    case 'DOWNLOADING':
      r = down.contentLength ? down.contentLength : '(file size unknown)'
      return `Downloading ${down.bytesWritten} / ${r}`
    case 'VERIFYING':
      return `Checking downloaded file integrity`
    case 'REPACKING':
      return `Repacking downloaded file with release information`
    case 'VERIFYING_REPACKED':
      return `Checking repacked file integrity`
    default:
      return `Unexpected status code: ${down.status}`  
    }
  }
  else if (state === 'DOWNLOADED') {
    if (itemDownloadSuccess(item))
      return 'Download success, ready to install.'
    else 
      return 'Downloaded, ready to install.'
  }
  else {
    return 'This version is currently installed.'
  }
}

const simpleHash = (string) => {

  var char, i, hash = 0;
  if (string.length == 0) return hash;
  for (i = 0; i < string.length; i++) {
    char = string.charCodeAt(i);
    hash = ((hash<<5)-hash)+char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

const renderItemMessage = (item) => {

  let state = itemState(item)
  let message = itemMessage(item) 
  let fontWeight = state === 'INSTALLED' ? 'bold' : 'normal'
  return ( 
    <div key={simpleHash(message)} style={{paddingLeft:16, paddingRight:16, flex:1, fontSize:16, color:rowFontColor(item) }}>
      <div style={{opacity:0.87}}>{ itemMessage(item) }</div>
    </div>
  )
}


const avatarColor = (item) => {

  let running = store.getState().server.current.process ? true : false

  let state = itemState(item)
  switch (state) {
  case 'AVAILABLE':
    return '#FFF'
  case 'DOWNLOADING':
    return '#FFF'
  case 'DOWNLOADED':
    return colors.grey500
  case 'INSTALLED':
    return colors.blueGrey500
  default:
    return '#FFF' 
  } 
}

const rowFontColor = (item) => {

  let running = store.getState().server.current.process ? true : false
 
  let state = itemState(item)
  switch (state) {
  case 'AVAILABLE':
    return '#000'
  case 'DOWNLOADING':
    return '#000'
  case 'DOWNLOADED':
    return '#000'
  case 'INSTALLED':
    return '#000'
  default:
    return '#000'
  } 
}

const renderItemRow = (item) => {

  let containerStyle = {display:'flex', alignItems:'center'}
  return (
    <Paper key={item.id} style={{width:'66%'}} zDepth={1}>
      <div style={{display:'flex', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center'}}>
          <div style={{width:40, height:40, padding:16}}>
            <Avatar style={{transition:'all 300ms'}} backgroundColor={avatarColor(item)}  />
          </div>
          <div style={{paddingTop:16, paddingBottom:16, paddingLeft:0, width:200, color:rowFontColor(item) }}>
            <div style={{fontSize:14, lineHeight:1.5, opacity:0.87}}>Version: {item.tag}</div>
            <div style={{fontSize:14, lineHeight:1.5, opacity:0.54}}>{item.publish_time}</div>
          </div>
        </div>
          <ReactCSSTransitionGroup
            style={{width:'100%', height:80, display:'flex', alignItems:'center'}}
            component='div'
            transitionName="example"
            transitionAppear={true}
            transitionEnter={true}
            transitionLeave={false}
            transitionAppearTimeout={100}
            transitionEnterTimeout={100}
            transitionLeaveTimeout={0}
          >
            <ReactCSSTransitionGroup
              id={`ticker-container-${item.id}`}
              style={{position:'relative', height:24, lineHeight:'24px', fontSize:16, flex:1}}
              component='div'
              transitionName="fxample"
              transitionAppear={false}
              transitionEnter={true}
              transitionLeave={true}
              transitionAppearTimeout={0}
              transitionEnterTimeout={290}
              transitionLeaveTimeout={290}
            >
              <div key={simpleHash(itemMessage(item))} style={{position: 'absolute', opacity:0.87, width:'100%'}}>{ itemMessage(item) }</div>
            </ReactCSSTransitionGroup>
          { renderLeftButton(item) }
            { renderRightButton(item) }
            <div style={{width:16}} />
          </ReactCSSTransitionGroup>
      </div>
    </Paper>
  )
}

const renderPanel = () => {

  let server = store.getState().server
  if (!server) return <div/>

  let current = server.current
  let installed = (current && current.id) ? true : false
  let running = (current && current.process) ? true : false

  let startButtonOnTouchTap = () => 
    dispatch({ type: 'SERVER_OP', data: { operation: 'START_APPIFI'}})
  let stopButtonOnTouchTap = () => 
    dispatch({ type: 'SERVER_OP', data: { operation: 'STOP_APPIFI' }})
  let uninstallButtonOnTouchTap = () => 
    dispatchOp('UNINSTALL')
  let goToAppifiButtonOnTouchTap = () => 
    window.open(`http://${window.location.hostname}:3000`) 

  let paperStyle = {backgroundColor: !installed ? colors.grey500 : (running ? colors.orange500 : colors.blueGrey500), width:'100%', marginBottom:32}

  let renderAppifiButton = () => {
    if (appifiInstalling() || appifiUninstalling()) return null
    if (!installed) return null
    if (running) 
      return (
        <div style={{width:'100%', height:64, display:'flex', alignItems:'flex-start', justifyContent:'flex-end'}} >
          <FlatButton style={{color:'#FFF', marginTop:8, marginRight:8}} label='appifi' onTouchTap={goToAppifiButtonOnTouchTap} /> 
        </div>
      )
    return null
  }

  let renderUninstallButton = () => {
    if (appifiInstalling() || appifiUninstalling()) return null
    if (!installed) return null
    if (!running)
      return (
        <div style={{width:'100%', height:64, display:'flex', alignItems:'flex-start', justifyContent:'flex-end'}} >
          <FlatButton style={{color:'#FFF', marginTop:8, marginRight:8}} label='uninstall' onTouchTap={uninstallButtonOnTouchTap} /> 
        </div>
      )
    return null
  }

  let renderCornerButtonPlaceHolder = () => (!installed || appifiInstalling() || appifiUninstalling()) ? <div style={{width:'100%', height:64}} /> : null

  let renderSubHeading = () => {
    if (installed && !appifiUninstalling())
      return (
        <div id='sub-heading-current-version' style={{height:24, fontSize:16, fontWeight:'bold', lineHeight:1.5, color:'#FFF'}}>
          <div style={{opacity:0.7}}>current version</div>
        </div>
      )
    else 
      return null
  }

  let renderSubHeadingPlaceHolder = () => {
    if (!installed || appifiInstalling() || appifiUninstalling()) {
      return <div style={{height:24}} />} 
  }

  let titleStyle = {height:100, fontSize:56, fontWeight:'lighter', lineHeight:1.5, color:'#FFF', 
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}


  let shouldRenderTitle = appifiInstalling() || appifiUninstalling()
  let renderTitle = () => {
    if (shouldRenderTitle) return null
    let title
    if (installed)
      title = server.locals.find(l => l.release.id === current.id).release.tag_name
    else
      title = 'Install Appifi'
    return <div id={installed ? 'title-installed' : 'title-not-installed'} style={titleStyle}>{title}</div> 
  }

  let renderBusyWaiting = () => {
    if (!shouldRenderTitle) return null
    return ( 
      <div style={titleStyle}>
        <div>
        <div id="block_1" className="barlittle"></div>
        <div id="block_2" className="barlittle"></div>
        <div id="block_3" className="barlittle"></div>
        <div id="block_4" className="barlittle"></div>
        <div id="block_5" className="barlittle"></div>
        </div>
      </div>
    )    
  }

  let renderStop = () => {
    if (!installed) return null
    if (appifiInstalling() || appifiUninstalling()) return null
    if (!running || appifiStopping()) return null
    return <div style={{height:36, padding:16, display:'flex'}}><FlatButton style={{color:'#FFF'}} label='stop' onTouchTap={stopButtonOnTouchTap} /></div>
  }

  let renderStart = () => {
    if (!installed) return null
    if (appifiInstalling() || appifiUninstalling()) return null
    if (running || appifiStarting()) return null
    return <div style={{height:36, padding:16, display:'flex'}}><RaisedButton label='start' secondary={true} onTouchTap={startButtonOnTouchTap} /></div>
  }
  
  let renderSSPlaceHolder = () => {
    if (!installed || appifiInstalling() || appifiUninstalling()) 
      return <div style={{height:36, padding:16}} />
  }

  return (
    <Paper style={paperStyle} zDepth={2}>
      <ReactCSSTransitionGroup
        style={{height:256, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start'}}
        transitionName="example"
        transitionAppear={true}
        transitionEnter={true}
        transitionLeave={false}
        transitionAppearTimeout={0}
        transitionEnterTimeout={150}
        transitionLeaveTimeout={0}
      >
        { renderUninstallButton() }
        { renderAppifiButton() }
        { renderCornerButtonPlaceHolder() }

        { renderSubHeading() }
        { renderSubHeadingPlaceHolder() }

        { renderBusyWaiting() }
        { renderTitle() }

        { renderStart() }
        { renderStop() }
        { renderSSPlaceHolder() }
      </ReactCSSTransitionGroup>
    </Paper>
  )
}

const renderServerState = () => {

  if (store.getState().server === null) return null
  
  let items = buildItems()

  const snackbarOnRequestClose = () => dispatch({ type: 'SNACKBAR_CLOSE', }) 

  return (
    <div>
      { renderPanel() }
      <div id='flex-container' style={{width:'100vw', display:'flex', flexDirection:'column', alignItems:'center'}}>
        { items.map(renderItemRow) }
        <div style={{height:1024}} />
      </div>
      <Snackbar open={store.getState().snackbarOpen} message={store.getState().snackbarMessage} 
        autoHideDuration={4000} onRequestClose={snackbarOnRequestClose} />
    </div>
  )
}

class App extends React.Component {

  getChildContext() {
    let muiTheme = getMuiTheme({
      palette: {
        primary1Color: colors.blueGrey500,
        primary2Color: colors.blueGrey800,
        pickerHeaderColor: colors.blueGrey500,
        accent1Color: colors.orangeA200
      },
      appBar: {
        height: 50
      }
    })
    return {muiTheme}
  }

  render() {
    return renderServerState()
  }
}

App.childContextTypes = {
  muiTheme: React.PropTypes.object.isRequired
}

let store = createStore(reducer) 

const dispatch = (action) => store.dispatch(action)

const render = () => {
  console.log(store.getState())
  ReactDom.render(<App/>, document.getElementById('app'))
}

store.subscribe(render)
window.store = store
render()

let polling = Polling('/state', 'SERVER_UPDATE', 1000)
polling.start()


