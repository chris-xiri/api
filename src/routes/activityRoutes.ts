import { Router } from 'express';
import { getActivitiesHandler } from '../controllers/activityController';

const router = Router();

router.get('/', getActivitiesHandler);

export default router;
