import { Router } from 'express';
import { scrapeVendorsHandler, updateVendorHandler, importLeadsHandler } from '../controllers/vendorController';

const router = Router();

router.post('/scrape', scrapeVendorsHandler);
router.post('/import', importLeadsHandler);
router.put('/:id', updateVendorHandler);

export default router;
