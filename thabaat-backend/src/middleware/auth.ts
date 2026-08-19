import { Request, Response, NextFunction } from 'express'

// Placeholder — verify Supabase JWT on protected routes
// Jenna implements this when securing the notify endpoint
export function verifyAuth(req: Request, res: Response, next: NextFunction) {
  next() // Remove this line when implementing real auth
}