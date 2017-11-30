GET /v1

```javascript
{
  beta: false,            // true or false, use beta
  operation: 'appInstall' // appStart, appStop, appInstall
  appifi: {               // null or object
    state: 'Starting'     // 'Starting', 'Started', 'Stopping', 'Stopped',
    tagName: '0.9.14'
  },
  releases: [             // array
    {
      state:              // 'Idle', 'Failed', 'Ready', 'Downloading', 'Repacking', 'Verifying', 
                          // ('Downloaded' not used now)
      view: null          /** null or object
                              Failed {
                                startTime:  // timer start time
                                timeout:    // timer timeout duration
                                message:    // error message
                                code:       // error code
                              } 
                              Downloading {
                                length:     // number or null
                                bytesWritten:     // downloaded
                              }
                          **/
      remote:             // release from github api
      local:              // release extracted from local tarball
    }
  ],
  fetch: {
    state: 'Pending'      // or 'Working'
    view:                 // 
    last: null or object  /**
                          {
                            time: when last is updated,
                            error: null or { message, code },
                            data: last retrieved data
                          }
                          **/
  },
  node: null              // not used
  deb: null               // not used
}
```

The following three operations are mutual exclusive, if 
PATCH /app
{
  state: 'Started' or 'Stopped'
}

PUT   /app
{
  tagName: new
}

PATCH /releases/:tagname
{
  state: 'Ready', 'Idle'
}

PATCH /fetch
{
  state: 'Pending' or 'Working'
}

