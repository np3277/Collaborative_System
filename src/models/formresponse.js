// src/models/FormResponse.js
const { db } = require('../config/database');

class FormResponse {
    /**
     * Finds a form response by formId and userId.
     * If no response exists, it creates an empty one for that user and form.
     * @param {string} formId - The ID of the form.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<Object>} The form response object (guaranteed to exist).
     */
    static async getByFormIdAndUserId(formId, userId) {
        console.log(`[FormResponse] getByFormIdAndUserId called with formId: ${formId}, userId: ${userId}`);

        let response = await db.oneOrNone(
            'SELECT id, form_id, user_id, data, last_edited_by_username FROM form_responses WHERE form_id = $1 AND user_id = $2',
            [formId, userId]
        );

        if (!response) {
            console.log(`[FormResponse] No existing response found for formId: ${formId}, userId: ${userId}. Creating new response.`);
            try {
                response = await db.one(`
                    INSERT INTO form_responses (form_id, user_id, data, created_at, updated_at)
                    VALUES ($1, $2, '{}'::jsonb, NOW(), NOW())
                    RETURNING id, form_id, user_id, data, last_edited_by_username
                `, [formId, userId]);
                console.log(`[FormResponse] Successfully created new response for formId: ${formId}, userId: ${userId}. Response ID: ${response.id}`);
            } catch (insertError) {
                console.error(`[FormResponse] ERROR during INSERT of new response for formId: ${formId}, userId: ${userId}:`, insertError);
                throw insertError;
            }
        } else {
            console.log(`[FormResponse] Found existing response for formId: ${formId}, userId: ${userId}. Response ID: ${response.id}`);
        }

        return response;
    }

    /**
     * Updates a specific field within the form's collaborative response data for a specific user.
     * This uses PostgreSQL's JSONB update operator `||` to merge.
     * @param {string} formId - The ID of the form.
     * @param {string} userId - The ID of the user performing the update.
     * @param {string} fieldName - The name of the field to update.
     * @param {*} newValue - The new value for the field.
     * @param {string} username - The username of the user performing the update.
     * @returns {Promise<Object>} The updated form response data.
     */
    static async updateField(formId, userId, fieldName, newValue, username) { // Added userId as a parameter
        const updateObject = {};
        updateObject[fieldName] = newValue;

        const updatedResponse = await db.one(`
            INSERT INTO form_responses (form_id, user_id, data, last_edited_by_username, created_at, updated_at)
            VALUES ($1, $2, $3::jsonb, $4, NOW(), NOW())
            ON CONFLICT (form_id, user_id) DO UPDATE SET
                data = form_responses.data || $3::jsonb,
                last_edited_by_username = $4,
                updated_at = NOW()
            RETURNING data, last_edited_by_username
        `, [formId, userId, JSON.stringify(updateObject), username]);

        return updatedResponse.data;
    }
}

module.exports = FormResponse;
