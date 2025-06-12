// src/models/Form.js
const { db } = require('../config/database');
const generateShareCode = require('../utils/shareCodeGenerator');

class Form {
    /**
     * Creates a new form and an associated empty form response owned by the admin.
     * @param {Object} formDetails - Form details including name, description, fields.
     * @param {string} adminId - The ID of the admin creating the form.
     * @returns {Promise<Object>} The created form object.
     */
    static async create(formDetails, adminId) {
        const { name, description, fields } = formDetails;
        let shareCode;
        let formId;

        // Use a transaction to ensure both form and response are created or neither are
        await db.tx(async t => {
            // Generate a unique share code
            let isUnique = false;
            while (!isUnique) {
                shareCode = generateShareCode();
                const existingForm = await t.oneOrNone('SELECT id FROM forms WHERE share_code = $1', [shareCode]);
                if (!existingForm) {
                    isUnique = true;
                }
            }

            // Insert form
            const form = await t.one(`
                INSERT INTO forms (admin_id, name, description, fields, share_code)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, name, share_code, description, fields
            `, [adminId, name, description, JSON.stringify(fields), shareCode]);

            formId = form.id;

            // Insert initial empty form response, associating it with the admin who created the form
            await t.none(`
                INSERT INTO form_responses (form_id, user_id, data)
                VALUES ($1, $2, '{}'::jsonb)
            `, [formId, adminId]); // <--- CHANGED: Added user_id parameter (adminId)

            return form; // Return the form created within the transaction
        });

        // After the transaction, fetch the form again to confirm and return
        // This is done outside tx block because the outer function returns a promise
        // and we need to return the actual form object
        const createdForm = await db.one('SELECT id, name, description, fields, share_code FROM forms WHERE id = $1', [formId]);
        return createdForm;
    }

    /**
     * Finds a form by its ID.
     * @param {string} id - The form ID.
     * @returns {Promise<Object|null>} The form object or null if not found.
     */
    static async findById(id) {
        return db.oneOrNone('SELECT id, name, description, fields, share_code FROM forms WHERE id = $1', [id]);
    }

    /**
     * Finds forms by admin ID.
     * @param {string} adminId - The ID of the admin.
     * @returns {Promise<Array<Object>>} List of forms created by the admin.
     */
    static async findByAdminId(adminId) {
        return db.any('SELECT id, name, description, share_code FROM forms WHERE admin_id = $1 ORDER BY created_at DESC', [adminId]);
    }

    /**
     * Finds a form by its share code.
     * @param {string} shareCode - The unique share code.
     * @returns {Promise<Object|null>} The form object or null if not found.
     */
    static async findByShareCode(shareCode) {
        return db.oneOrNone('SELECT id, name, description, fields, share_code FROM forms WHERE share_code = $1', [shareCode]);
    }
}

module.exports = Form;
