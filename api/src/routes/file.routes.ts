import express, { type Request, type Response, type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  readFile,
  writeFile,
  deleteFile,
  listDirectory,
  createDirectory,
  getFileStats,
  deleteDirectory,
} from '../services/fileManager.js';

const router: Router = express.Router();

// Todos los endpoints requieren autenticación
router.use(requireAuth);

/**
 * GET /api/files/?path=/home/user
 * Lee un archivo o lista contenido de un directorio
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'path query parameter is required',
      });
    }

    try {
      const stats = await getFileStats(filePath);

      if (stats.type === 'directory') {
        // Si es un directorio, listar contenido
        const listing = await listDirectory(filePath);
        res.json({
          success: true,
          data: listing,
        });
      } else if (stats.type === 'file') {
        // Si es un archivo, leer contenido
        const fileContent = await readFile(filePath);
        res.json({
          success: true,
          data: fileContent,
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Path is a symlink or unsupported type',
        });
      }
    } catch (error: any) {
      if (error.message.includes('ENOENT')) {
        return res.status(404).json({
          success: false,
          error: 'File or directory not found',
        });
      }
      throw error;
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/files
 * Escribe contenido en un archivo
 *
 * Body:
 * {
 *   "path": "/home/user/test.txt",
 *   "content": "file content",
 *   "append": false
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { path: filePath, content, append } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'path is required',
      });
    }

    if (content === undefined) {
      return res.status(400).json({
        success: false,
        error: 'content is required',
      });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'content must be a string',
      });
    }

    const result = await writeFile(filePath, content, { append: append === true });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/files?path=/home/user/test.txt
 * Elimina un archivo
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'path query parameter is required',
      });
    }

    try {
      const result = await deleteFile(filePath);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message.includes('ENOENT')) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }
      throw error;
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/files/mkdir
 * Crea un directorio
 *
 * Body:
 * {
 *   "path": "/home/user/newdir"
 * }
 */
router.post('/mkdir', async (req: Request, res: Response) => {
  try {
    const { path: dirPath } = req.body;

    if (!dirPath) {
      return res.status(400).json({
        success: false,
        error: 'path is required',
      });
    }

    const result = await createDirectory(dirPath);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/files/rmdir?path=/home/user/emptydir
 * Elimina un directorio vacío
 */
router.delete('/rmdir', async (req: Request, res: Response) => {
  try {
    const dirPath = req.query.path as string;

    if (!dirPath) {
      return res.status(400).json({
        success: false,
        error: 'path query parameter is required',
      });
    }

    try {
      const result = await deleteDirectory(dirPath);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message.includes('ENOENT')) {
        return res.status(404).json({
          success: false,
          error: 'Directory not found',
        });
      }
      throw error;
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
