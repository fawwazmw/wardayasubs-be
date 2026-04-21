import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  icon: z.string().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

export const createCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validatedData = createCategorySchema.parse(req.body);

    // Check if category name already exists for this user
    const existingCategory = await prisma.category.findUnique({
      where: {
        userId_name: {
          userId,
          name: validatedData.name,
        },
      },
    });

    if (existingCategory) {
      res.status(400).json({ error: 'Category name already exists' });
      return;
    }

    const category = await prisma.category.create({
      data: {
        ...validatedData,
        userId,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCategories = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const categories = await prisma.category.findMany({
      where: { userId },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const category = await prisma.category.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        subscriptions: true,
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validatedData = updateCategorySchema.parse(req.body);

    // Verify category belongs to user
    const existingCategory = await prisma.category.findFirst({
      where: { id, userId },
    });

    if (!existingCategory) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    // Check if new name conflicts with existing category
    if (validatedData.name && validatedData.name !== existingCategory.name) {
      const nameConflict = await prisma.category.findUnique({
        where: {
          userId_name: {
            userId,
            name: validatedData.name,
          },
        },
      });

      if (nameConflict) {
        res.status(400).json({ error: 'Category name already exists' });
        return;
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: validatedData,
    });

    res.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCategory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify category belongs to user
    const category = await prisma.category.findFirst({
      where: { id, userId },
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    await prisma.category.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
