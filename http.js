import { createServer } from 'http'
import http from 'http'
import { Buffer } from 'buffer'
import { promises } from 'fs'
import qs from 'querystring'
import { URL } from 'url'
import { isText } from 'istextorbinary'

import * as pathModule from 'path'
import { fileURLToPath } from 'url'
const __dirname = pathModule.dirname(fileURLToPath(import.meta.url))

/**
 * HTML escape a string
 * @param {String} s string to HTML escape
 * @returns {String} escaped string
 */
export const escapeHTML = s =>
	s.replace(/[^0-9A-Za-z ]/g, c => '&#' + c.charCodeAt(0) + ';')
/**
 * HTML escape an object
 * @param {Object} obj object to HTML escape
 * @returns {Object} object with HTML escaped strings
 */
export const objEscapeHTML = obj =>
	Object.entries(obj).reduce((obj, e) => {
		obj[e[0]] = escapeHTML(e[1])
		return obj
	}, {})

/**
 * Flatten an array and return the first non-array element
 * @param {Array} a
 * @returns {any}
 */
export const arrToFlat = a => (Array.isArray(a) ? arrToFlat(a[0]) : a)
/**
 * flatten arrays in an object - returns the first non-array element for each value in the object
 * @param {Object<Array>} obj object with arrays to flatten as values
 * @returns {Object<Array>} object with flattened arrays as values
 */
export const flatten = obj =>
	Object.entries(obj).reduce((obj, e) => {
		obj[e[0]] = arrToFlat(e[1])
		return obj
	}, {})


let renderFns = {}
async function genRenderFn(filePath) {
	let buffer = await promises.readFile(filePath)
	if (!isText(filePath, buffer)) {
		renderFns[filePath] = () => buffer
		return
	}
	let text = buffer.toString('utf8')
	let matches = []
	text = text
		.replace(/\\/g, '\\\\')
		.replace(/\`/g, '\\`')
		.replace(/\$/g, '\\$')
		.replace(/\{\{.*?\}\}/gs, match => {
			match = match.slice(2, -2)
			matches.push(match)
			return '${' + match + '}'
		})
	renderFns[filePath] = eval(`({${matches.join(',')}}) => \`${text}\``)
}
async function render(path, data = null) {
	if (data === null) data = {}
	let filePath
	if (data === true)
		filePath = pathModule.join(__dirname, 'public', 'static', path)
	else
		filePath = pathModule.join(__dirname, 'public', path)
	if (!filePath.startsWith(pathModule.join(__dirname, 'public'))) return null
	if (!renderFns[filePath])
		if (serverOptions.whitelistPaths)
			return null
		try {
			await genRenderFn(filePath)
		} catch (e) {
			return null
		}
	if (serverOptions.escapeRender && !data.noEscape)
		data = objEscapeHTML(data)
	return renderFns[filePath](data)
}
async function* getFiles(dir) {
	const dirents = await promises.readdir(dir, { withFileTypes: true })
	for (const dirent of dirents) {
		const res = pathModule.resolve(dir, dirent.name)
		if (dirent.isDirectory()) {
			yield* getFiles(res)
		} else {
			yield res
		}
	}
}
async function generateWhitelistPaths() {
	const basePath = pathModule.join(
		__dirname,
		'public'
	)
	for await (const f of getFiles('./public')) {
		await genRenderFn(f)
	}
}

/** @param {string} path */
async function getMIMEtype(path) {
	return {
		'.html': 'text/html',
		'.css': 'text/css',
		'.js': 'text/javascript',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.gif': 'image/gif',
		'.svg': 'image/svg+xml',
		'.ico': 'image/x-icon',
		'.json': 'application/json',
		'.pdf': 'application/pdf',
		'.txt': 'text/plain',
		'.mp4': 'video/mp4',
		'.webm': 'video/webm',
		'.mp3': 'audio/mpeg',
		'.wav': 'audio/wav',
		'.ogg': 'audio/ogg',
		'.woff': 'font/woff',
		'.woff2': 'font/woff2',
		'.eot': 'application/vnd.ms-fontobject',
		'.otf': 'font/opentype',
		'.ttf': 'font/truetype',
		'.zip': 'application/zip',
		'.rar': 'application/x-rar-compressed',
		'.7z': 'application/x-7z-compressed',
		'.tar': 'application/x-tar',
		'.gz': 'application/x-gzip',
		'.bz2': 'application/x-bzip2',
		'.xz': 'application/x-xz'
	}[path.slice(path.lastIndexOf('.'))] || 'text/plain'
}

export class Request {
	/** @param {http.IncomingMessage} req */
	constructor(req) {
		this.req = req
		this.ip = req.socket.remoteAddress
		this.url = new URL(req.url, `http://${req.headers.host}`)
		this.path = this.url.pathname
		this.query = this.url.search
		this.params = flatten(
			Object.fromEntries(this.url.searchParams.entries())
		)
	}
	/** @returns {Promise<qs.ParsedUrlQuery>} post data */
	async getPostData() {
		const buffers = []
		for await (const chunk of this.req) {
			buffers.push(chunk)
		}
		const data = Buffer.concat(buffers).toString()
		if (serverOptions.flattenData)
			return flatten(qs.parse(data))
		return qs.parse(data)
	}
	/**
	 * @param {String} name
	 * @returns {Promise<String>} cookie value
	 */
	async getCookie(name) {
		const cookies = this.req.headers.cookie
		if (!cookies) return null
		const cookie = cookies
			.split(';')
			.find(c => c.trim().startsWith(name + '='))
		if (!cookie) return null
		const cookieSplit = cookie.split('=')
		cookieSplit.shift()
		return cookieSplit.join('=')
	}
}

export class Response {
	/** @param {http.ServerResponse} res */
	constructor(res) {
		this.res = res
	}
	/**
	 * @param {String} name valid cookie name
	 * @param {String} value valid cookie value
	 * @param {Date | Number} expires `Date` object or unix timestamp
	 * @param {String} path path must start with this string
	 * @param {Boolean} secure only send cookie over https
	 * @param {Boolean} httpOnly forbid client side javascript to access cookie
	 * @param {String} domain domain at which the cookie is accessible
	 * @param {Number} maxAge seconds until expiration - precedence over expires
	 * @param {String} sameSite from what origin: { `Strict`: only when coming from this site , `Lax`: Strict + following a link , `None`: from everywhere }
	 */
	async setCookie(
		name,
		value,
		expires = null,
		path = null,
		secure = false,
		httpOnly = true,
		domain = null,
		maxAge = null,
		sameSite = null
	) {
		let cookie =
			`${name || ''}=${value || ''}` +
			(expires != null ? `; Expires=${new Date(expires).toUTCString()}` : '') +
			(maxAge != null ? `; Max-Age=${maxAge}` : '') +
			(domain != null ? `; Domain=${domain}` : '') +
			(path != null ? `; Path=${path}` : '') +
			(secure ? '; Secure' : '') +
			(httpOnly ? '; HttpOnly' : '') +
			(sameSite != null ? `; SameSite=${sameSite}` : '')
		this.res.setHeader(
			'Set-Cookie',
			cookie
		)
	}
	/** @param {String} location */
	async redirect(location) {
		this.res.writeHead(302, {
			Location: location
		})
		this.res.end()
	}
	/**
	 * render file at relative path, replacing `{{}}` with data
	 *
	 * renders files from `/public/` or `/public/static/`
	 *
	 * If you have set escapeRender to true, set `data.noEscape` to true to prevent escaping for this particular render.
	 * You can always escape data by using `objEscapeHTML(data)`
	 * @param {String} path relative path to file
	 * @param {Object | Boolean} data data to replace `{{}}` with - if set to `true` will render static file (`/public/static/`)
	 * @param {Number} code response status code
	 */
	async render(path, data = null, code = 200) {
		let r = await render(path, data)
		if (r) {
			this.res.writeHead(code, {
				'Content-Type': await getMIMEtype(path) + '; charset=utf-8'
			})
			this.res.end(r)
		} else {
			throw `Requested file: ${path} not found`
		}
	}
	async return(string, contentType = 'text/plain', code = 200) {
		this.res.writeHead(code, { 'Content-Type': contentType + '; charset=utf-8' })
		this.res.end(string)
	}
}

let getCBs = {}
/**
 * Set get handler
 * @param {String} path
 * @param {{(req: Request, res: Response)=>{}}} callback
 */
export function onGet(path, callback) {
	getCBs[path] = callback
}
let postCBs = {}
/**
 * Set post handler
 * @param {String} path
 * @param {{(req: Request, res: Response)=>{}}} callback
 */
export function onPost(path, callback) {
	postCBs[path] = callback
}

/**
 * @param {Request} req
 * @param {Response} res
 * @param {Object.<String,{(req: Request, res: Response)=>{}}>} CBobj
 */
async function answer(req, res, CBobj) {
	let cb = CBobj[req.path] || CBobj.default
	if (cb) {
		cb(req, res)
	} else {
		if (req.path === '/') req.path = '/index.html'
		if (!req.path.includes('.')) req.path += '.html'
		try {
			await res.render(req.path, true)
		} catch {
			if (CBobj.err404)
				CBobj.err404(req, res)
			else
				try {
					await res.render('404.html', true)
				} catch {
					res.res.writeHead(404)
					res.res.end()
				}
		}
	}
}
/**
 * execute get handler
 * @param {Request} req
 * @param {Response} res
 * @param {String} path if specified, will be used instead of `req.path`
 */
export async function get(req, res, path = null) {
	if (path) req.path = path
	answer(req, res, getCBs)
}
/**
 * execute post handler
 * @param {Request} req
 * @param {Response} res
 * @param {String} path if specified, will be used instead of `req.path`
 */
export async function post(req, res, path = null) {
	if (path) req.path = path
	answer(req, res, postCBs)
}

class RequestCounter extends Array {
	tick() {
		this.push(Date.now())
		while (this[0] < Date.now() - 1000) this.shift()
		if (this.length > serverOptions.maxRequestsPerSecond)
			this.timeoutUntil = Date.now() + serverOptions.DDOStimeoutMinutes * 60 * 1000
	}
	isInvalid() {
		return this.timeoutUntil && this.timeoutUntil > Date.now()
	}
}
const reqIPs = {}
/** @param {http.IncomingMessage} req @param {http.ServerResponse} res */
async function handleReq(req, res) {
	if (!reqIPs[req.socket.remoteAddress])
		reqIPs[req.socket.remoteAddress] = new RequestCounter()
	reqIPs[req.socket.remoteAddress].tick()
	if (reqIPs[req.socket.remoteAddress].isInvalid()) {
		console.log(`access denied to ${req.socket.remoteAddress} for spamming`)
		res.writeHead(429, {'Retry-After': serverOptions.DDOStimeoutMinutes / 60})
		res.end()
		return
	}
	let request = new Request(req)
	let response = new Response(res)
	if (req.method === 'GET') return get(request, response)
	if (req.method === 'POST') return post(request, response)
	return get(request, response)
}

/**
 * @typedef {Object} serverOptions
 * @prop {Boolean} flattenData flatten get and post data
 * @prop {Boolean} escapeRender HTML escape render data
 * @prop {Boolean} whitelistPaths generate render functions for each file on start and reject all requests to other files
 * @prop {Number} maxRequestsPerSecond maximum number of requests per second before DDOS protection kicks in
 * @prop {Number} DDOStimeoutMinutes minutes of timeout when banned by DDOS protection
 */
export const serverOptions = {
	flattenData: true,
	escapeRender: true,
	whitelistPaths: true,
	maxRequestsPerSecond: 20,
	DDOStimeoutMinutes: 5
}
/**
 * Start the http server
 *
 * `options` are passed as an object like this:
 * @example
 * {
 * 	flattenData: true, // flatten get and post data
 * 	escapeRender: true, //HTML escape render data
 * 	whitelistPaths: true, // generate render functions for each file on start and reject all requests to other files
 * 	maxRequestsPerSecond: 20, // maximum number of requests per second before DDOS protection kicks in
 * 	DDOStimeoutMinutes: 5 // minutes of timeout when banned by DDOS protection
 * }
 * @param {Number} port
 * @param {serverOptions} options
 * @returns {Promise<http.Server>}
 */
export async function start(port = 80, options = {}) {
	Object.assign(serverOptions, options)
	if (serverOptions.whitelistPaths)
		await generateWhitelistPaths()
	let httpServer = createServer(handleReq)
	httpServer.listen(port)
	return httpServer
}
