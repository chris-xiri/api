import { Router } from 'express';
import { scrapeVendorsHandler } from '../controllers/vendorController';

const router = Router();

router.post('/scrape', scrapeVendorsHandler);

export default router;
