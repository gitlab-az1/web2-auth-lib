import type { RequestHandler, Request, Response, NextFunction } from 'express';



export type EnsureAuthenticatedOptions = {}

export function ensureAuthenticated(options?: EnsureAuthenticatedOptions): RequestHandler {
  return async function(request: Request, response: Response, next: NextFunction): Promise<void> {
    //
  };
}

export default ensureAuthenticated;
