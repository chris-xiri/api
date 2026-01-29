import { Router } from 'express';
import { submitAuditHandler } from '../controllers/auditController';

const router = Router();

router.post('/submit', submitAuditHandler);

export default router;
