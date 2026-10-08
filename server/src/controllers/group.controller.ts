import type { Request, Response, NextFunction } from 'express';
import type { GroupService } from '../services/group.service.js';
import { validateRequest } from '../utils/validateRequest.js';
import {
  createGroupSchema,
  groupIdParamsSchema,
  addMemberSchema,
} from '../common/schemas/group.schema.js';
import { MemberRole } from '../../generated/prisma/enums.js';

export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const groups = await this.groupService.getUserGroups(req.user!.id);
      res.status(200).json(groups);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId } = validateRequest(
        req,
        groupIdParamsSchema,
        'Invalid group ID path parameter',
        'params',
      );
      const group = await this.groupService.getGroupById(groupId, req.user!.id);
      res.status(200).json(group);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = validateRequest(
        req,
        createGroupSchema,
        'Invalid group creation body',
      );
      const group = await this.groupService.createGroup(req.user!.id, data);
      res.status(201).json(group);
    } catch (err) {
      next(err);
    }
  }

  async listMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId } = validateRequest(
        req,
        groupIdParamsSchema,
        'Invalid group ID path parameter',
        'params',
      );
      const members = await this.groupService.getGroupMembers(
        groupId,
        req.user!.id,
      );
      res.status(200).json(members);
    } catch (err) {
      next(err);
    }
  }

  async addMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { groupId } = validateRequest(
        req,
        groupIdParamsSchema,
        'Invalid group ID path parameter',
        'params',
      );
      const data = validateRequest(
        req,
        addMemberSchema,
        'Invalid add member body',
      );
      const role = data.role ? (data.role as MemberRole) : MemberRole.MEMBER;
      const member = await this.groupService.addMember(
        groupId,
        req.user!.id,
        data.userId,
        role,
      );
      res.status(201).json(member);
    } catch (err) {
      next(err);
    }
  }
}
