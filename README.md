# tinyServ

A tiny NodeJS server.

This simple server is a wrapper around the http module.
It makes it easier to create routes, just like express and fastify. It also tries to offer great security features while keeping the size small.

## Example

This is an example of a minimal setup:

```js
import * as app from './http.js'

app.onGet('/', async (req, res) => {
	res.render('index.html', {name: 'LiveOverflow'})
})
app.onPost('/submit', async (req, res) => {
	let data = await req.getPostData()
	res.render('index.html', {name: data.name})
})

let server = await app.start()

```

<br>

Let's look at the example in more detail.

```js
app.onGet('/', async (req, res) => {
	res.render('index.html', {name: 'LiveOverflow'})
})
```
`app.onGet` registers the handler for the GET request to this route. The handler needs to be an async function to be able to await data.

`res.render` renders the page and closes the connection.

<br>

```js
app.onPost('/submit', async (req, res) => {
	let data = await req.getPostData()
	res.render('index.html', {name: data.name})
})
```
`app.onPost` registers a POST route.

You can get the POST data with `req.getPostData`. That is an async function so you have to await it.

<br>

```js
let server = await app.start()
```
`app.start` starts the server and returns the http server instance.

You can pass it the port number you want (default `80`):

```js
let server = await app.start(3000)
```

#### ServerOptions

You can start the server with options, like this:

```js
let server = await app.start(3000, {
    flattenData: true,
	escapeRender: true,
	whitelistPaths: true,
	maxRequestsPerSecond: 20,
	DDOStimeoutMinutes: 5
})
```
These are the defaults for the options.

`whitelistPaths` is explained in its own section after *Security measures*.

The other options are security options.
They are explained in detail in the *Security measures* section below.

## More interesting examples

In this part we will look at some other examples. The following code snippets can be inserted right before

```js
let server = await app.start()
```

### Cookies

You can read cookies using `req.getCookie`.

```js
app.onGet('/fromCookie', async (req, res) => {
    nameCookie = await req.getCookie('name')
	res.render('index.html', {name: nameCookie})
})
```
You can also set cookies using `res.setCookie`.

```js
app.onPost('/submitCookie', async (req, res) => {
	let data = await req.getPostData()
    res.setCookie('name', data.name)
	res.render('index.html', {name: data.name})
})
```

### Redirect

Redirecting is simply done with `res.redirect`.

```js
app.onGet('/invalid', async (req, res) => {
	res.redirect('/')
})
```

### Advanced rendering

You have already seen an example of how to render a simple page. The code looks like this:

```js
app.onGet('/', async (req, res) => {
	res.render('index.html', {name: 'LiveOverflow'})
})
```
The file `index.html` looks like this:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Home</title>
    </head>
    <body>
        <h1>Welcome, {{name}}</h1>
        <p>This is the home page</p>
        <form method="post" action="submit">
            <input type="text" name="name" placeholder="Enter your name">
            <input type="submit" value="Submit">
        </form>
    </body>
</html>
```
As you can see, the key between the curly brackets ( here `{{name}}` ) will be replaced with the matching value of the object passed to `render`.

You can do more with the `render` function.
By default, the `render` function will render files from `/public/`. If you call it like this

```js
res.render('about.html', true)
```
it will render a file from the `/public/static/` directory.

You can also pass it a different status code:

```js
res.render('index.html', {name: 'LiveOverflow'}, 204)
```

#### Escaping

By default, the `render` function will escape all non-alphanumerical characters in the input. To prevent that, call it like this:

```js
res.render('index.html', {name: '<b>LiveOverflow</b>', noEscape: true})
```

## Security measures

*Settings* mean **ServerOptions** passed when starting the server.

### HTML escaping

As you saw above, the `render` function automatically escapes characters. This can be disabled by setting `escapeRender` to `false`. You can still escape the data with

```js
app.objEscapeHTML(data)
```

you can also escape a single string using

```js
app.escapeHTML(string)
```

### Data flattening

Query data and POST body data is automatically flattened. If the data contains arrays, it is recursive replaced with its first element. Setting `flattenData` to `false` in the ServerOptions will disable this behavior. You can flatten data yourself by using

```js
app.flatten(data)
```

and flatten arrays using

```js
app.arrToFlat(array)
```

### DDOS protection

This server contains automatic DDOS protection. If a user makes more requests per second than allowed, they are banned for a certain amount of time. The number of requests is customizable through the option `maxRequestsPerSecond`, the ban time in minutes is set with `DDOStimeoutMinutes`.

## WhitelistPaths

WhitelistPaths is a feature that speeds up 404 request handling. It works by caching all files in the `/public/` directory when the server starts. When the server is running it only checks if a page renderer is already available, and does not try to generate a new one, slowing the server down with file system operations. This might be useful to reduce the impact of the first load of a page after a server start. A downside is the increased startup time as the server traverses all directories in the `/public/` directory and generates renderers on startup.
