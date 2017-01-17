appifi-bootstrap manages the startup/shutdown and deployment of appifi

# Three ways to run it

## For Development

`sudo npm run devel`

This target is configured to use `nodemon` and `babel-node` to run the project, with entry file `src/main.js`

This is the best way for development.

## For Production Usage without Back-end Webpack

`npm run build && sudo npm start`

In this target, files in `src` folder are babelled to `build` folder, make it possible to run without babel-node (which is inefficienct).

The entry file is then `build/main.js`

## For Device Deployment

`node pack_and_hash.js` will firstly pack the front end, then back end with all static files (bundle.js/html/css etc) into single JavaScript file.

* `webpack.config.js` is webpack configuration for front-end.
* `backpack.config.js` is webpack configuration for back-end.
* `pack_and_hash.js` is the pack and hash script.
* `public/bundle.js` is the webpack bundle for front-end
* `public/bundle.raw` is a copy of `public/bundle.js`. Webpack pluggin raw-loader won't load .js file (may be the problem of require) and Uglify won't work on file with extension other than .js. So this is a simple workaround.
* `backpack.js` is logically equivalent to `src/main.js`. The syntax of static file loading for webpack, won't work for babel compiler. So we provide two thin wrappers for `src/app.js`. One is `src/main.js` which works for babel and babel-node, the other, `backpack.js` is solely used for back-end webpack.
* `appifi-bootstrap.js` is the webpacked bundle including front-end, back-end, as well as static files.
* `appifi-bootstrap.js.sha1` is the `appifi-bootstrap.fs` pre-pended with a single line of comment, which include the SHA1 hash for the file.

## Deployment and Testing

The real file that deployed onto users computer, is

```
https://raw.githubusercontent.com/wisnuc/appifi-bootstrap/release/appifi-bootstrap.js.sha1
```

in **release** branch. You can verify this in the source code in `appifi-bootstrap-update` repository.

Update to release branch should ALWAYS start from master branch. 

You can manually test the sha1 version through 

```
https://raw.githubusercontent.com/wisnuc/appifi-bootstrap/master/appifi-bootstrap.js.sha1
```


