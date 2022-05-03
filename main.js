import * as app from './http.js'

app.onGet('/', async (req, res) => {
	res.render('index.html', {name: 'LiveOverflow'})
})
app.onPost('/submit', async (req, res) => {
	let data = await req.getPostData()
	res.render('index.html', {name: data.name})
})

let server = await app.start()
