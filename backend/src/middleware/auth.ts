import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getUserById } from '../db/queries/users.js'
import type { User } from '../db/queries/users.js'

declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    const user = await getUserById(payload.userId)
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req)
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
      req.user = await getUserById(payload.userId) ?? undefined
    } catch {
      // Token invalid — continue as anonymous
    }
  }
  next()
}

function extractToken(req: Request): string | null {
  // Standard Authorization header
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  // SSE query param fallback (EventSource can't set headers)
  if (typeof req.query.token === 'string') return req.query.token
  return null
}
