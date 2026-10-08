import type { Request, Response, NextFunction } from 'express';
import type { MessageService } from '../services/message.service.js';
import { validateRequest } from '../utils/validateRequest.js';
import { channelIdParamsSchema } from '../common/schemas/channel.schema.js';
import {
  createMessageSchema,
  getMessagesQuerySchema,
} from '../common/schemas/message.schema.js';

export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  async listByChannel(req: Request, res: Response, next: NextFunction) {
    try {
      const { channelId } = validateRequest(
        req,
        channelIdParamsSchema,
        'Invalid channel ID path parameter',
        'params',
      );
      const query = validateRequest(
        req,
        getMessagesQuerySchema,
        'Invalid messages query parameters',
        'query',
      );
      const result = await this.messageService.getChannelMessages(
        channelId,
        req.user!.id,
        query.limit,
        query.cursor,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { channelId } = validateRequest(
        req,
        channelIdParamsSchema,
        'Invalid channel ID path parameter',
        'params',
      );
      const { content } = validateRequest(
        req,
        createMessageSchema,
        'Invalid message creation body',
      );
      const message = await this.messageService.createMessage(
        channelId,
        req.user!.id,
        content,
      );
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  }
}
