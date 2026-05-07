import api from './api';

const categoryService = {
    /**
     * Get all categories
     */
    getAllCategories: async () => {
        return api.get('/categories');
    },

    /**
     * Get single category
     */
    getCategory: async (id) => {
        return api.get(`/categories/${id}`);
    },

    /**
     * Create new category
     */
    createCategory: async (categoryData) => {
        return api.post('/categories', categoryData);
    },

    /**
     * Update category
     */
    updateCategory: async (id, categoryData) => {
        return api.put(`/categories/${id}`, categoryData);
    },

    /**
     * Delete category
     */
    deleteCategory: async (id) => {
        return api.delete(`/categories/${id}`);
    }
};

export default categoryService;
