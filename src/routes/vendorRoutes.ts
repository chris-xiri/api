import { Router } from 'express';
import { scrapeVendorsHandler, updateVendorHandler, importLeadsHandler, getVendorsHandler, createVendorHandler } from '../controllers/vendorController';

import { startOutreachSequenceHandler, unsubscribeVendorHandler } from '../controllers/outreachController';

const router = Router();

router.get('/', getVendorsHandler);
router.post('/', createVendorHandler);
router.post('/scrape', scrapeVendorsHandler);
router.post('/import', importLeadsHandler);
router.put('/:id', updateVendorHandler);
router.post('/:id/start-sequence', startOutreachSequenceHandler);
router.get('/:id/unsubscribe', unsubscribeVendorHandler);

export default router;
