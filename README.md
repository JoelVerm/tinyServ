# tinyServ

A tiny NodeJS server.

This simple server is a wrapper around the http module.
It makes it easier to create routes, just like express and fastify. It also tries to offer great security features while keeping the size small.

## Example

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

## Documentation

Documentation and more examples are available in [the documentation file](/documentation.md).

## Bugs

If you encounter any issues or bugs, please open an issue, make a pull request or send an email to joel.vermeulen5@outlook.com.
