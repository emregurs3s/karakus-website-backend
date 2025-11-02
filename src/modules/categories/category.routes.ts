import { Router } from 'express';
import * as categoryController from './category.controller.js';

const router = Router();

router.get('/', categoryController.getCategories);

export default router;


