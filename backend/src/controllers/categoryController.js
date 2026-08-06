const Category = require('../models/Category');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');

/** Mongo duplicate-key. Reaches here only if the stale index survived boot. */
const isDuplicateKey = (error) => error && (error.code === 11000 || error.code === 11001);

class CategoryController {
    /**
     * Get all categories for user
     * @route GET /api/categories[?kind=task|spend]
     */
    static async getAllCategories(req, res) {
        try {
            // No kind param returns every category, exactly as before the
            // field existed - the change is strictly additive.
            const categories = await Category.findByUser(req.user.id, req.query.kind || null);
            
            res.json({
                success: true,
                data: {
                    categories,
                    count: categories.length
                }
            });
        } catch (error) {
            console.error('Get all categories error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching categories'
            });
        }
    }
    
    /**
     * Get single category
     * @route GET /api/categories/:id
     */
    static async getCategory(req, res) {
        try {
            const category = await Category.findById(req.params.id);
            
            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Category not found'
                });
            }
            
            // Verify ownership
            if (category.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to category'
                });
            }
            
            res.json({
                success: true,
                data: category
            });
        } catch (error) {
            console.error('Get category error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching category'
            });
        }
    }
    
    /**
     * Create new category
     * @route POST /api/categories
     */
    static async createCategory(req, res) {
        try {
            const { name, color, icon, kind } = req.body;
            const resolvedKind = kind === 'spend' ? 'spend' : 'task';

            // Check if category name already exists for user, within this kind
            const exists = await Category.nameExists(req.user.id, name, resolvedKind);
            if (exists) {
                return res.status(400).json({
                    success: false,
                    message: 'Category name already exists'
                });
            }

            const category = await Category.create({
                user_id: req.user.id,
                name,
                color,
                icon,
                kind: resolvedKind
            });

            res.status(201).json({
                success: true,
                message: 'Category created successfully',
                data: category
            });
        } catch (error) {
            // Backstop for a stale { user_id, name } unique index that
            // ensureIndexes did not manage to drop: without this the collision
            // escapes as a 500 rather than the 400 the check above intends.
            if (isDuplicateKey(error)) {
                return res.status(400).json({
                    success: false,
                    message: 'Category name already exists'
                });
            }
            console.error('Create category error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating category'
            });
        }
    }
    
    /**
     * Update category
     * @route PUT /api/categories/:id
     */
    static async updateCategory(req, res) {
        try {
            const category = await Category.findById(req.params.id);
            
            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Category not found'
                });
            }
            
            // Verify ownership
            if (category.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to category'
                });
            }
            
            // Check if new name already exists within this category's own kind
            if (req.body.name && req.body.name !== category.name) {
                const exists = await Category.nameExists(req.user.id, req.body.name, category.kind);
                if (exists) {
                    return res.status(400).json({
                        success: false,
                        message: 'Category name already exists'
                    });
                }
            }

            const updatedCategory = await Category.update(req.params.id, req.body);

            res.json({
                success: true,
                message: 'Category updated successfully',
                data: updatedCategory
            });
        } catch (error) {
            if (isDuplicateKey(error)) {
                return res.status(400).json({
                    success: false,
                    message: 'Category name already exists'
                });
            }
            console.error('Update category error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating category'
            });
        }
    }
    
    /**
     * Delete category
     * @route DELETE /api/categories/:id
     */
    static async deleteCategory(req, res) {
        try {
            const category = await Category.findById(req.params.id);
            
            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: 'Category not found'
                });
            }
            
            // Verify ownership
            if (category.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access to category'
                });
            }
            
            // A spend category with expenses cannot be removed: Expense stores
            // category_id, so deleting would leave rows pointing at nothing and
            // silently drop them out of every budget rollup.
            if (category.kind === 'spend') {
                const inUse = await Expense.countByCategory(req.user.id, req.params.id);
                if (inUse > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `This category has ${inUse} expense${inUse === 1 ? '' : 's'}. Move or delete them first.`
                    });
                }
                // No expenses, so any budgets for it are now unreachable rows.
                await Budget.deleteByCategory(req.user.id, req.params.id);
            }

            await Category.delete(req.params.id);

            res.json({
                success: true,
                message: 'Category deleted successfully'
            });
        } catch (error) {
            console.error('Delete category error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting category'
            });
        }
    }
}

module.exports = CategoryController;
