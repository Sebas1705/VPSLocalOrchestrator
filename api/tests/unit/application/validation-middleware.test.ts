import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  sendValidatedResponse,
  sendErrorResponse,
} from '../../../src/application/validation-middleware.js';
import { ErrorResponseSchema } from '../../../src/application/validation-schemas.js';

describe('validation middleware', () => {
  const buildRes = () => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    return res;
  };

  describe('validateBody', () => {
    it('passes and attaches validatedBody on success', () => {
      const schema = z.object({ name: z.string() });
      const req: any = { body: { name: 'ok' } };
      const res = buildRes();
      const next = jest.fn();

      const middleware = validateBody(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).validatedBody).toEqual({ name: 'ok' });
    });

    it('returns 400 on validation failure', () => {
      const schema = z.object({ name: z.string() });
      const req: any = { body: { name: 123 } };
      const res = buildRes();
      const next = jest.fn();

      const middleware = validateBody(schema);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ code: 'VALIDATION_ERROR' }) })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    it('validates query params and attaches validatedQuery', () => {
      const schema = z.object({ page: z.string() });
      const req: any = { query: { page: '1' } };
      const res = buildRes();
      const next = jest.fn();

      const middleware = validateQuery(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).validatedQuery).toEqual({ page: '1' });
    });

    it('returns 400 on invalid query params', () => {
      const schema = z.object({ page: z.string().regex(/^\d+$/) });
      const req: any = { query: { page: 'bad' } };
      const res = buildRes();
      const next = jest.fn();

      const middleware = validateQuery(schema);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ code: 'VALIDATION_ERROR' }) })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('sendValidatedResponse', () => {
    it('sends data when schema matches', () => {
      const schema = z.object({ value: z.number() });
      const res = buildRes();

      sendValidatedResponse(res as any, schema, { value: 42 });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ value: 42 });
    });

    it('returns 500 when response payload fails validation', () => {
      const schema = z.object({ value: z.string() });
      const res = buildRes();

      sendValidatedResponse(res as any, schema, { value: 99 } as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ code: 'INTERNAL_SERVER_ERROR' }) })
      );
    });
  });

  describe('sendErrorResponse', () => {
    it('formats error responses using schema', () => {
      const res = buildRes();
      sendErrorResponse(res as any, 'SAMPLE_ERROR', 'Something went wrong', 418, { foo: 'bar' });

      expect(res.status).toHaveBeenCalledWith(418);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ code: 'SAMPLE_ERROR' }) })
      );
    });

    it('falls back to generic error when schema validation fails', () => {
      const res = buildRes();
      jest.spyOn(ErrorResponseSchema, 'safeParse').mockReturnValue({ success: false } as any);

      sendErrorResponse(res as any, 'BAD', 'Invalid');

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ code: 'INTERNAL_SERVER_ERROR' }) })
      );
    });
  });
});
