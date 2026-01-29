import { Router } from 'express';
import { generateJobsHandler } from '../controllers/jobController';

const router = Router();

router.post('/generate', generateJobsHandler);

export default router;
