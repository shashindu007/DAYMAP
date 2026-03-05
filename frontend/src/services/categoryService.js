import api from './api';

const categoryService = {
    /**
     * Get all categories
     */
    getAllCategories: async () => {
        try {
            const response = await api.get('/categories');
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get single category
     */
    getCategory: async (id) => {
        try {
            const response = await api.get(`/categories/${id}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Create new category
     */
    createCategory: async (categoryData) => {
        try {
            const response = await api.post('/categories', categoryData);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Update category
     */
    updateCategory: async (id, categoryData) => {
        try {
            const response = await api.put(`/categories/${id}`, categoryData);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Delete category
     */
    deleteCategory: async (id) => {
        try {
            const response = await api.delete(`/categories/${id}`);
            return response;
        } catch (error) {
            throw error;
        }
    }
};

export default categoryService;
