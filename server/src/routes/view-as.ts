import { Router } from 'express';
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { findViewAsTarget } from '../services/view-as.js';

const router = Router();
router.use(requireAuth, requireAdmin);

/** Identity of the user an admin is previewing, for the view-as banner. */
router.get('/:userId', async (req: AuthenticatedRequest, res) => {
  try {
    const target = await findViewAsTarget(req.params.userId as string);
    if (!target) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No viewable user with that id' } });
      return;
    }
    res.json({ success: true, data: { id: target.id, name: target.name, role: target.role } });
  } catch (err) {
    console.error('View-as lookup error:', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  }
});

export default router;
