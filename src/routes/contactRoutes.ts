import { Router } from 'express';
import {
    getContactsHandler,
    createContactHandler,
    updateContactHandler,
    deleteContactHandler
} from '../controllers/contactController';

const router = Router();

router.get('/', getContactsHandler);
router.post('/', createContactHandler);
router.put('/:id', updateContactHandler);
router.delete('/:id', deleteContactHandler);

export default router;
