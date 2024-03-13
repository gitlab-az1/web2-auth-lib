import type { RequestHandler, Request, Response, NextFunction } from 'express';

import * as inet from '../../_internals/inet';
import type { Writable } from '../../_internals/types';
import { uuidWithoutSlashes } from '../../_internals/id';
import { type SessionDocument } from '../../_internals/models/sessions';


declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      readonly inet: {
        readonly ip: inet.IPv4 | inet.IPv6;
      };

      readonly context?: {
        [key: string]: any;

        readonly session?: SessionDocument<{ userId: string }>;
      };

      readonly requestId: string;
      readonly timestamp: number;
    }
  }
}

export function requestInitializer(): RequestHandler {
  return async function(request: Request, _: Response, next: NextFunction): Promise<void> {
    if(!!request.requestId && /^[a-f0-9]{32}$/i.test(request.requestId)) return next();

    (<Writable<Request>>request).timestamp = Date.now();
    (<Writable<Request>>request).requestId = uuidWithoutSlashes();

    (<Writable<Request>>request).inet = {
      ip: inet.extractIPFromRequest(request),
    };

    (<Writable<Request>>request).context ??= {};
    next();
  };
}

export default requestInitializer;
