import { Router } from 'express';
import { scrapeProspectsHandler, importProspectsHandler, getProspectsHandler } from '../controllers/crmController';

const router = Router();

router.get('/prospects', getProspectsHandler);
router.post('/prospects/search', scrapeProspectsHandler);
router.post('/prospects/import', importProspectsHandler);

export default router;
