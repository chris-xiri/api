import { Router } from 'express';
import { scrapeVendorsHandler, updateVendorHandler, importLeadsHandler, getVendorsHandler, createVendorHandler } from '../controllers/vendorController';

const router = Router();

router.get('/', getVendorsHandler);
router.post('/', createVendorHandler);
router.post('/scrape', scrapeVendorsHandler);
router.post('/import', importLeadsHandler);
router.put('/:id', updateVendorHandler);

export default router;
