# APIs

## 读取状态 

```
GET /v1
```

### 返回 200

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
                                startTime:        // timer start time
                                timeout:          // timer timeout duration
                                message:          // error message
                                code:             // error code
                              } 
                              Downloading {
                                length:           // number or null
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

### 返回 503

此时Bootstrap初始化失败，无法启动。返回数据包括`{ message, code}`，为错误详细信息。

## 安装、启动和停止应用服务

以下三个方法为互斥方法：
1. 任何一个在服务时，其他不可用。
2. 启动或停止服务的同类并发方法不会返回错误。

### 安装应用服务

提供`tagName`，来自`releases`资源列表。

```
PUT   /app
```

**body**
```json
{
  "tagName": "0.9.14"
}
```

**return**
+ 200
+ 400, ENOTFOUND, 如果没有找到给定tag name的release
+ 400, ENOTREADY, 如果给定tag name的release未处于Ready状态
+ 403, ERACE，操作冲突
+ 500, 内部错误

### 启动或停止应用服务

```
PATCH /v1/app
```

**body**
```json
{
  "state": "Started"
}
```

`state`可以是`Started`或`Stopped`。

## 启动或停止一个Release

启动指启动下载，包括Release的tarball下载，及其依赖性包的下载和安装。

```
PATCH /v1/releases/:tagname
```

**body**
```json
{
  "state": "Ready"
}
```

`state`可以是`Ready`或`Idle`。

**return**


## 检查更新

```
PATCH /v1/fetch
```

**body**
```
{
  "state": "Pending"
}
```

`state`可以是`Pending`（意味着停止）或`Working`（意味着启动）。

**return**
200
