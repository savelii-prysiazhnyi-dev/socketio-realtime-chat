import type { Request, Response, NextFunction } from 'express';
import type { ChannelService } from '../services/channel.service.js';
import { validateRequest } from '../utils/validateRequest.js';
import { groupIdParamsSchema } from '../common/schemas/group.schema.js';
import {
  createChannelSchema,
  channelIdParamsSchema,
} from '../common/schemas/channel.schema.js';

export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  async listByGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId } = validateRequest(
        req,
        groupIdParamsSchema,
        'Invalid group ID path parameter',
        'params',
      );
      const channels = await this.channelService.getChannelsByGroup(
        groupId,
        req.user!.id,
      );
      res.status(200).json(channels);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { channelId } = validateRequest(
        req,
        channelIdParamsSchema,
        'Invalid channel ID path parameter',
        'params',
      );
      const channel = await this.channelService.getChannelById(
        channelId,
        req.user!.id,
      );
      res.status(200).json(channel);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId } = validateRequest(
        req,
        groupIdParamsSchema,
        'Invalid group ID path parameter',
        'params',
      );
      const data = validateRequest(
        req,
        createChannelSchema,
        'Invalid channel creation body',
      );
      const channel = await this.channelService.createChannel(
        groupId,
        req.user!.id,
        data,
      );
      res.status(201).json(channel);
    } catch (err) {
      next(err);
    }
  }
}
