import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const start = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      console.log(`[HTTP] ${method} ${url} -> ${status} (${duration}ms)`);
    });

    next();
  }
}