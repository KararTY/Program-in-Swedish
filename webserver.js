const Koa = require('koa')
const KoaStatic = require('koa-static')
const KoaBodyParser = require('koa-bodyparser')
const KoaRouter = require('koa-router')

const fetch = require('node-fetch')

const app = new Koa()
const router = new KoaRouter()

app.use(KoaStatic('./public/'))
app.use(KoaBodyParser())

/**
 * This API can be self-hosted.
 * Check https://github.com/EmilStenstrom/json-tagger
 */
const jsonTaggerURL = 'https://json-tagger.com/tag'

router.post('/api', async ctx => {
  const body = ctx.request.body
  const response = ctx.response
  if (body) {
    const req = await fetch(jsonTaggerURL, { body: body.value, method: 'POST' })
    if (req.status === 200) {
      try {
        const res = await req.json()
        response.body = { result: res.sentences }
      } catch (err) {
        response.status(400)
        response.body = { error: err }
      }
    }
  } else {
    return response.end('No body.')
  }
})

app.use(router.routes())
app.use(router.allowedMethods())

app.listen(3030)
