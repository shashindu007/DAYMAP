const Category = require('../models/Category');

class CategoryController {
    /**
     * Get all categories for user
     * @route GET /api/categories
     */
    static async getAllCategories(req, res) {
        try {
            const categories = await Category.findByUser(req.user.id);
            
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
                message: 'Error fetching categories',
                error: error.message
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
                message: 'Error fetching category',
                error: error.message
            });
        }
    }
    
    /**
     * Create new category
     * @route POST /api/categories
     */
    static async createCategory(req, res) {
        try {
            const { name, color, icon } = req.body;
            
            // Check if category name already exists for user
            const exists = await Category.nameExists(req.user.id, name);
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
                icon
            });
            
            res.status(201).json({
                success: true,
                message: 'Category created successfully',
                data: category
            });
        } catch (error) {
            console.error('Create category error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating category',
                error: error.message
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
            
            // Check if new name already exists
            if (req.body.name && req.body.name !== category.name) {
                const exists = await Category.nameExists(req.user.id, req.body.name);
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
            console.error('Update category error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating category',
                error: error.message
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
            
            await Category.delete(req.params.id);
            
            res.json({
                success: true,
                message: 'Category deleted successfully'
            });
        } catch (error) {
            console.error('Delete category error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting category',
                error: error.message
            });
        }
    }
}

module.exports = CategoryController;
