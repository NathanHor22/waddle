import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  createSession,
  getSessions,
  getSession,
  appendSessionMessage,
  deleteSession,
} from '../db/queries/sessions.js'
import type { SessionMessage } from '../types.js'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const sessions = await getSessions()
  res.json(sessions)
})

router.post('/', async (req: Request, res: Response) => {
  const { title, threadId } = req.body
  if (!title?.trim() || !threadId?.trim()) {
    res.status(400).json({ error: 'title and threadId are required' })
    return
  }
  const session = await createSession(title.trim(), threadId.trim())
  res.json(session)
})

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const result = await getSession(req.params.id)
  if (!result) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.json(result)
})

router.post('/:id/messages', async (req: Request<{ id: string }>, res: Response) => {
  const { role, content } = req.body as { role: SessionMessage['role']; content: string }
  if (!role || !content) {
    res.status(400).json({ error: 'role and content are required' })
    return
  }
  const msg = await appendSessionMessage(req.params.id, role, content)
  res.json(msg)
})

router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  await deleteSession(req.params.id)
  res.json({ ok: true })
})

export default router
