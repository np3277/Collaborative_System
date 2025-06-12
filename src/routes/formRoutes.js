// src/routes/formRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');

/**
 * @route POST /api/forms
 * @description Creates a new form. Requires admin role.
 * @access Private (Admin)
 */
router.post('/', authenticateToken, authorizeRoles(['admin']), async (req, res) => { // Removed '/forms'
    try {
        const { name, description, fields } = req.body;
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Only administrators can create forms.' });
        }

        if (!name || !fields || !Array.isArray(fields) || fields.length === 0) {
            return res.status(400).json({ message: 'Form name and at least one field are required.' });
        }

        const isValidFields = fields.every(field =>
            field.type && ['text', 'number', 'dropdown'].includes(field.type) &&
            field.name && typeof field.name === 'string' &&
            field.label && typeof field.label === 'string'
        );

        if (!isValidFields) {
            return res.status(400).json({ message: 'Invalid fields format provided.' });
        }

        const adminId = req.user.id;

        const newForm = await Form.create({ name, description, fields }, adminId);
        res.status(201).json({
            message: 'Form created successfully.',
            form: {
                id: newForm.id,
                name: newForm.name,
                shareCode: newForm.share_code
            }
        });
    } catch (error) {
        console.error('Error creating form:', error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'A form with a generated share code already exists. Please try again.' });
        }
        res.status(500).json({ message: 'Server error creating form.' });
    }
});

/**
 * @route GET /api/forms
 * @description Get all forms created by the current admin. Requires admin role.
 * @access Private (Admin)
 */
router.get('/', authenticateToken, authorizeRoles(['admin']), async (req, res) => { // Removed '/forms'
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Only administrators can view their created forms.' });
        }
        const adminId = req.user.id;
        const forms = await Form.findByAdminId(adminId);
        res.json(forms);
    } catch (error) {
        console.error('Error fetching forms:', error);
        res.status(500).json({ message: 'Server error fetching forms.' });
    }
});

/**
 * @route GET /api/forms/:formId
 * @description Get a specific form definition. Requires admin role (or possibly user if joining).
 * @access Private (Admin, or via share code for user)
 */
router.get('/:formId', authenticateToken, authorizeRoles(['admin']), async (req, res) => { // Removed '/forms'
    try {
        const { formId } = req.params;
        const form = await Form.findById(formId);
        if (!form) {
            return res.status(404).json({ message: 'Form not found.' });
        }
        if (req.user.role === 'admin' && form.admin_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied: You are not the admin of this form.' });
        }
        res.json(form);
    } catch (error) {
        console.error('Error fetching form by ID:', error);
        res.status(500).json({ message: 'Server error fetching form.' });
    }
});

/**
 * @route GET /api/forms/join/:shareCode
 * @description Get form definition and current response data for a user joining.
 * @access Private (Authenticated User)
 */
router.get('/join/:shareCode', authenticateToken, async (req, res) => { // Removed '/forms'
    try {
        const { shareCode } = req.params;
        console.log(`[formRoutes] Attempting to join form with shareCode: ${shareCode}`);
        const form = await Form.findByShareCode(shareCode);

        if (!form) {
            console.log(`[formRoutes] Form not found for shareCode: ${shareCode}`);
            return res.status(404).json({ message: 'Form not found with this share code.' });
        }

        console.log(`[formRoutes] Found form: ID=${form.id}, Name=${form.name}`);
        console.log(`[formRoutes] Current User: ID=${req.user.id}, Username=${req.user.username}`);

        const response = await FormResponse.getByFormIdAndUserId(form.id, req.user.id);
        console.log(`[formRoutes] Response from FormResponse.getByFormIdAndUserId:`, response);

        res.status(200).json({
            form: form,
            response: response ? response.data : {}
        });
    } catch (error) {
        console.error('Error joining form:', error);
        res.status(500).json({ message: 'Server error joining form.' });
    }
});

module.exports = router;
