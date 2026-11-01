// Audit script: measured checks for things the main drive does not cover.
// Needs the compose stack up, 60 seeded synthetic episodes, Microsoft Edge, and (for the video check) ffmpeg on PATH.
// Run: npm run audit. Exit code is 1 when any check fails.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const BASE = process.env.UMI_URL ?? 'http://localhost:5173'
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const VIDEO = `${ROOT}data/episodes/syn_0002/video.mp4`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const check = (name, ok, detail = '') => {
	if (!ok) failed++
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

// Contrast of every visible text element against its effective background (WCAG 2.x ratio).
// Not covered: text drawn on a canvas, and backgrounds that are images or gradients.
function measureContrast() {
	const parse = (c) => {
		const m = c.match(/rgba?\(([^)]+)\)/)
		if (!m) return null
		const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
		return { r, g, b, a }
	}
	const over = (top, bottom) => {
		const a = top.a + bottom.a * (1 - top.a)
		const mix = (t, b) => (t * top.a + b * bottom.a * (1 - top.a)) / (a || 1)
		return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a }
	}
	const lum = ({ r, g, b }) => {
		const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
		return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
	}
	const rows = []
	for (const el of document.querySelectorAll('body *')) {
		const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
		if (!own.length) continue
		const rect = el.getBoundingClientRect()
		const style = getComputedStyle(el)
		if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden' || style.display === 'none') continue
		if (el.closest('.visually-hidden, [disabled], fieldset:disabled, script, style, canvas')) continue
		if (el.closest('.open') && !document.body.dataset.revealed) continue
		let bg = { r: 255, g: 255, b: 255, a: 1 }
		let opacity = 1
		const chain = []
		for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.unshift(n)
		for (const n of chain) {
			const s = getComputedStyle(n)
			const c = parse(s.backgroundColor)
			if (c && c.a > 0) bg = over(c, bg)
			opacity *= Number(s.opacity)
		}
		let fg = parse(style.color)
		if (!fg) continue
		fg = over({ ...fg, a: fg.a * opacity }, bg)
		const l1 = lum(fg)
		const l2 = lum(bg)
		const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
		const px = parseFloat(style.fontSize)
		const bold = Number(style.fontWeight) >= 700
		const large = px >= 24 || (px >= 18.66 && bold)
		rows.push({
			text: own.map((n) => n.textContent.trim()).join(' ').slice(0, 40),
			sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
			fg: `rgb(${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)})`,
			bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
			ratio: Math.round(ratio * 100) / 100,
			need: large ? 3 : 4.5,
			px,
		})
	}
	return rows
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const newPage = async (w = 1500, h = 900) => {
	const page = await browser.newPage({ viewport: { width: w, height: h } })
	page.errors = []
	page.on('pageerror', (e) => page.errors.push(String(e)))
	return page
}

// 1. Contrast on every screen
for (const path of ['/overview', '/overview?status=curated', '/episode/syn_0002', '/episode/syn_0002?t=8.3', '/triage']) {
	const page = await newPage()
	await page.goto(BASE + path)
	await page.waitForFunction(() => document.body.innerText.length > 80)
	await sleep(700)
	const rows = await page.evaluate(measureContrast)
	const bad = rows.filter((r) => r.ratio < r.need)
	const groups = new Map()
	for (const r of bad) {
		const k = `${r.fg} on ${r.bg}`
		const g = groups.get(k) ?? { ...r, count: 0 }
		g.count++
		groups.set(k, g)
	}
	check(`contrast: ${path} (${rows.length} text elements)`, bad.length === 0, bad.length ? `${bad.length} below WCAG AA` : '')
	for (const g of groups.values()) console.log(`        ${g.ratio}:1 (need ${g.need}) ${g.fg} on ${g.bg}  x${g.count}  e.g. <${g.sel}> "${g.text}" ${g.px}px`)
	if (path === '/overview') {
		await page.locator('article.card').first().hover()
		await sleep(300)
		await page.evaluate(() => { document.body.dataset.revealed = '1' })
		const open = (await page.evaluate(measureContrast)).filter((r) => r.sel.includes('open'))
		const worst = open.reduce((a, b) => (b.ratio < a.ratio ? b : a), { ratio: 99, need: 4.5 })
		check('contrast: the hover-revealed Open link', open.length > 0 && worst.ratio >= worst.need, `${worst.ratio}:1 ${worst.fg} on ${worst.bg}`)
	}
	await page.close()
}

// 2. Error and empty states
{
	const page = await newPage()
	await page.route('**/api/episodes', (route) => route.abort())
	await page.goto(BASE + '/overview')
	await page.getByText('Could not load episodes').waitFor({ timeout: 5000 }).catch(() => {})
	check('load failure shows the error card with Try again', (await page.getByText('Could not load episodes').count()) === 1 && (await page.getByRole('button', { name: 'Try again' }).count()) === 1)
	await page.unroute('**/api/episodes')
	await page.getByRole('button', { name: 'Try again' }).click()
	await page.waitForSelector('article.card', { timeout: 5000 }).catch(() => {})
	check('Try again recovers and shows the episodes', (await page.locator('article.card').count()) > 0)
	await page.close()
	const empty = await newPage()
	await empty.route('**/api/episodes', (route) => route.fulfill({ json: [] }))
	await empty.goto(BASE + '/overview')
	await empty.getByText('No episodes yet').waitFor({ timeout: 5000 }).catch(() => {})
	check('an empty dataset shows "No episodes yet"', (await empty.getByText('No episodes yet').count()) === 1)
	await empty.close()
	const gone = await newPage()
	await gone.goto(BASE + '/episode/does_not_exist')
	await sleep(1200)
	const goneText = await gone.evaluate(() => document.body.innerText)
	check('an unknown episode id shows an error, not a blank page', /not found|could not|error|404/i.test(goneText), goneText.replace(/\s+/g, ' ').slice(120, 220))
	await gone.close()
}

// 3. Narrow viewports: no horizontal page overflow
for (const path of ['/overview', '/episode/syn_0002', '/triage']) {
	const page = await newPage(700, 900)
	await page.goto(BASE + path)
	await page.waitForFunction(() => document.body.innerText.length > 80)
	await sleep(500)
	const over = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
	check(`700px wide: ${path} has no horizontal page scroll`, over.sw <= over.cw, `scrollWidth ${over.sw} vs ${over.cw}`)
	await page.close()
}

// 4. The <video> path, with a real file
{
	if (!existsSync(VIDEO)) {
		try {
			mkdirSync(`${ROOT}data/episodes/syn_0002`, { recursive: true })
			execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30', '-t', '38.4', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-movflags', '+faststart', VIDEO])
		} catch (e) {
			console.log('SKIP  video checks: ffmpeg is not available')
		}
	}
	if (existsSync(VIDEO)) {
		const page = await newPage()
		await page.goto(BASE + '/episode/syn_0002?t=8.3')
		await page.waitForSelector('video', { timeout: 8000 }).catch(() => {})
		check('an episode with video.mp4 renders a <video>', (await page.locator('video').count()) === 1)
		check('the "No video imported" tile is gone', (await page.getByText('No video imported').count()) === 0)
		await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2, null, { timeout: 8000 }).catch(() => {})
		const dur = await page.evaluate(() => document.querySelector('video')?.duration)
		check('the video loads from the API with the right duration', Math.abs(dur - 38.4) < 0.2, `duration ${dur}`)
		await sleep(400)
		const t0 = await page.evaluate(() => document.querySelector('video')?.currentTime)
		check('?t=8.3 seeks the video to 8.3 s', Math.abs(t0 - 8.3) < 0.15, `currentTime ${t0}`)
		await page.locator('body').click({ position: { x: 5, y: 5 } })
		await page.keyboard.press('Shift+ArrowRight'); await sleep(500)
		const t1 = await page.evaluate(() => document.querySelector('video')?.currentTime)
		check('Shift+ArrowRight moves the video forward 1 s', Math.abs(t1 - (t0 + 1)) < 0.2, `${t0} -> ${t1}`)
		await page.keyboard.press('Space'); await sleep(1500)
		const playing = await page.evaluate(() => ({ t: document.querySelector('video').currentTime, paused: document.querySelector('video').paused, text: document.body.innerText.match(/frame\s+(\d+)\s*\/\s*\d+/)?.[1] }))
		check('Space plays the video', !playing.paused && playing.t > t1 + 0.8, `currentTime ${t1} -> ${playing.t}`)
		check('the video stays in sync with the frame counter', Math.abs(playing.t - (Number(playing.text) - 1) / 30) < 0.25, `video ${playing.t.toFixed(2)} s vs frame ${playing.text}`)
		await page.keyboard.press('Space'); await sleep(400)
		check('Space pauses the video', await page.evaluate(() => document.querySelector('video').paused))
		await page.keyboard.press('Home'); await sleep(400)
		check('Home rewinds the video to 0', (await page.evaluate(() => document.querySelector('video').currentTime)) < 0.1)
		check('no page errors while playing video', page.errors.length === 0, page.errors.join(' | '))
		await page.close()
		rmSync(VIDEO)
	}
}

await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
