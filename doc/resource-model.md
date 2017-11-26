# Resource Model

Resource model is the internal model describing the resources and their states (behavior). It is not directly mapped to restful api.



## Releases

A Release has the following properties:

1. manifest: from github release api. identified by tag_name (eg 0.9.14)
   1. the manifest may be retrieved from remotes or cherry picked from tarball, if both exists, the remotes win. ( it is possible that local is beta and remote is release)
2. local tarball file
   1. null, 
   2. retrieving, (running state)
   3. failed (with an error)
   4. ready
3. node dependency: retrieved from package.json file
4. deb dependency: retrieved from package.json file
5. installed (if same as installed version)
6. running (if installed and running)
7. arm and x86_64 are different



```javascript
release {
  manifest: // json,
  tarball: null, or release downloader (if failed stay or error),
  node requirement: {}
  deb: checking (or checked),
  installed: null, or { state }
}
```



## Nodes

```bash
# the smallest one is base, used for system service
/wisnuc/node/8.9.1/
```



node 

version



## Deb package (utility)

check and install deb package 