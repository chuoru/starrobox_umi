import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Needs the compose stack up, 60 seeded synthetic episodes, and Microsoft Edge installed.
// The bulk-status steps change episode statuses. Restore them with backend/seed_synthetic.py --clean.
const BASE = process.env.UMI_URL ?? 'http://localhost:5173'
const EVIDENCE = fileURLToPath(new URL('../../verification-evidence/web/', import.meta.url))
mkdirSync(EVIDENCE, { recursive: true })
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`) }
const api = async (p) => (await fetch(`${BASE}/api${p}`)).json()
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

// ---- Overview
await page.goto(`${BASE}/overview`); await page.waitForSelector('article.card')
const cards = page.locator('article.card')
check('overview renders cards', (await cards.count()) > 3, `${await cards.count()} in DOM`)

await cards.nth(0).click()
await cards.nth(2).click({ modifiers: ['Shift'] })
const bar = page.locator('[role=toolbar][aria-label="Bulk actions"]')
const barText = await bar.innerText().catch(() => '')
check('click + shift-click select, bulk bar appears', /selected/.test(barText), barText.split('\n')[0])
const selected = await page.$$eval('article.card[aria-pressed=true]', els => els.map(e => e.getAttribute('aria-label').split(',')[0]))
check('selected ids resolved', selected.length >= 1, selected.join(','))

await bar.getByRole('button', { name: 'Curate' }).click(); await sleep(800)
const afterCurate = await Promise.all(selected.map(id => api(`/episodes/${id}`)))
check('bulk Curate persisted through API', afterCurate.every(e => e.status === 'curated'), afterCurate.map(e => e.status).join(','))

await page.keyboard.press('Escape'); await sleep(200)
check('Escape clears selection', (await page.locator('[role=toolbar][aria-label="Bulk actions"]').count()) === 0)

// rollback on failure
errors.length = 0
await page.route('**/api/episodes/*', route => route.request().method() === 'PATCH' ? route.abort() : route.continue())
const target = await cards.nth(5).getAttribute('aria-label'); const tid = target.split(',')[0]
const before = (await api(`/episodes/${tid}`)).status
await cards.nth(5).click()
await page.locator('[role=toolbar]').getByRole('button', { name: 'Exclude' }).click(); await sleep(800)
const alertShown = (await page.locator('[role=alert]').count()) > 0
const afterFail = (await api(`/episodes/${tid}`)).status
const cardLabel = await page.locator(`article.card[aria-label^="${tid},"]`).getAttribute('aria-label')
check('failed PATCH shows error alert', alertShown)
check('failed PATCH leaves server status unchanged', afterFail === before, `${before} -> ${afterFail}`)
check('failed PATCH rolls back card in UI', !/excluded/i.test(cardLabel) || before === 'excluded', cardLabel.slice(0, 60))
await page.unroute('**/api/episodes/*'); await page.keyboard.press('Escape')

// histogram brush
const count = async () => +((await page.evaluate(() => document.body.innerText)).match(/(\d+)\s*\/\s*60/)?.[1])
const total0 = await count()
const hist = page.locator('[role=group][aria-label^="Duration"]').first()
const box = await hist.boundingBox()
await page.mouse.move(box.x + box.width * 0.45, box.y + box.height / 2)
await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: 8 }); await page.mouse.up(); await sleep(500)
const url = page.url()
const total1 = await count()
check('histogram drag writes filter to URL', /dur=/.test(url), url.replace(BASE, ''))
check('histogram drag reduces matching episodes (N / 60)', total1 < total0, `${total0} -> ${total1}`)
await page.screenshot({ path: EVIDENCE + 'overview-brushed.png' })

// open link
await page.goto(`${BASE}/overview`); await page.waitForSelector('article.card')
await page.locator('article.card a, article.card [aria-label^="Open"]').first().click(); await page.waitForURL(/\/episode\//)
check('Open navigates to /episode/<id>', /\/episode\/syn_/.test(page.url()), page.url().replace(BASE, ''))

// ---- Episode keyboard
const frame = async () => { const t = await page.evaluate(() => document.body.innerText); const m = t.match(/frame\s+(\d+)\s*\/\s*(\d+)/); return m ? +m[1] : null }
await page.goto(`${BASE}/episode/syn_0002`); await page.waitForFunction(() => /frame\s+\d+\s*\/\s*\d+/.test(document.body.innerText))
await page.locator('body').click({ position: { x: 5, y: 5 } })
const f0 = await frame()
await page.keyboard.press('ArrowRight'); await sleep(150); const f1 = await frame()
check('ArrowRight steps +1 frame', f1 === f0 + 1, `${f0} -> ${f1}`)
await page.keyboard.press('Shift+ArrowRight'); await sleep(150); const f2 = await frame()
check('Shift+ArrowRight steps +1 s (30 frames)', f2 === f1 + 30, `${f1} -> ${f2}`)
await page.keyboard.press('Space'); await sleep(1200); const f3 = await frame()
check('Space plays: frame advances', f3 > f2 + 10, `${f2} -> ${f3}`)
await page.keyboard.press('Space'); await sleep(200); const f4 = await frame(); await sleep(500); const f5 = await frame()
check('Space pauses: frame holds', f4 === f5, `${f4} == ${f5}`)
await page.keyboard.press('Home'); await sleep(150)
check('Home goes to the first frame (shown as 1)', (await frame()) === 1)
await page.keyboard.press('KeyN'); await sleep(150); const fn = await frame()
check('N jumps to next lost-segment edge', fn > 0, `frame ${fn}`)
await page.keyboard.press('BracketRight'); await sleep(150); const fk = await frame()
check(']' + ' jumps to next keyframe', fk > fn, `${fn} -> ${fk}`)
await page.keyboard.press('End'); await sleep(150); const fe = await frame()
check('End goes to last frame', fe > 1000, `frame ${fe}`)
// drag-scrub on timeline
await page.keyboard.press('Home')
const tl = page.locator('canvas').last(); const tb = await tl.boundingBox()
await page.mouse.move(tb.x + tb.width * 0.2, tb.y + tb.height * 0.5); await page.mouse.down()
await page.mouse.move(tb.x + tb.width * 0.5, tb.y + tb.height * 0.5, { steps: 6 }); await page.mouse.up(); await sleep(200)
const fs = await frame()
check('dragging the timeline scrubs', fs > 100, `frame ${fs}`)
// handler cleanup: leave the page, keys must not move anything / throw
await page.goto(`${BASE}/overview`); await page.waitForSelector('article.card'); await page.keyboard.press('Space'); await sleep(200)

errors.splice(0, errors.length, ...errors.filter(e => !/ERR_FAILED/.test(e)))
check('no console errors (the aborted PATCH is expected and filtered)', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
const failed = results.filter(r => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0)
