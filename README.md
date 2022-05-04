# tinyServ
a simple NodeJS server

This simple server is a wrapper around the http module.
It makes it easier to create routes, just like express and fastify. It looks almost the same too:

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
res.render('index.html', {name: 'LiveOverflow'}, )
```
