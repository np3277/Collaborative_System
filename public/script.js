// public/script.js
const API_BASE_URL = window.location.origin; // Dynamically get base URL
const socket = io(API_BASE_URL);

let currentUser = null;
let currentToken = null;
let currentForm = null;
let currentFormResponse = {};

// --- DOM Elements ---
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const registerUserBtn = document.getElementById('register-user-btn');
const registerAdminBtn = document.getElementById('register-admin-btn');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authStatusDiv = document.getElementById('auth-status');
const loggedInUserInfo = document.getElementById('logged-in-user-info');

const adminSection = document.getElementById('admin-section');
const formNameInput = document.getElementById('form-name');
const formDescriptionInput = document.getElementById('form-description');
const formFieldsContainer = document.getElementById('form-fields-container');
const addTextFieldBtn = document.getElementById('add-text-field-btn');
const addNumberFieldBtn = document.getElementById('add-number-field-btn');
const addDropdownFieldBtn = document.getElementById('add-dropdown-field-btn');
const createFormBtn = document.getElementById('create-form-btn');
const createFormStatusDiv = document.getElementById('create-form-status');

const userSection = document.getElementById('user-section');
const joinShareCodeInput = document.getElementById('join-share-code');
const joinFormBtn = document.getElementById('join-form-btn');
const joinFormStatusDiv = document.getElementById('join-form-status');
const adminFormsListDiv = document.getElementById('admin-forms-list');
const formsListUl = document.getElementById('forms-list');

const collaborativeFormDisplay = document.getElementById('collaborative-form-display');
const currentFormTitle = document.getElementById('current-form-title');
const currentFormDescription = document.getElementById('current-form-description');
const liveFormFieldsContainer = document.getElementById('live-form-fields-container');
const collaborativeStatusDiv = document.getElementById('collaborative-status');

// --- Utility Functions ---

function displayMessage(element, message, type = 'info') {
    element.textContent = message;
    element.className = `message-box mt-2 ${type === 'error' ? 'error-message' : ''}`;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000); // Hide after 5 seconds
}

function clearFormCreationInputs() {
    formNameInput.value = '';
    formDescriptionInput.value = '';
    formFieldsContainer.innerHTML = ''; // Clear dynamic fields
    // Add initial empty field to prevent creating a form with no fields
    addFieldToAdminForm('text');
}

function updateUIForAuth(user, token) {
    currentUser = user;
    currentToken = token;
    if (user && token) {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('token', token);
        loggedInUserInfo.textContent = `Logged in as: ${user.username} (${user.role})`;
        loggedInUserInfo.style.display = 'block';
        loginBtn.style.display = 'none';
        registerUserBtn.style.display = 'none';
        registerAdminBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';

        if (user.role === 'admin') {
            adminSection.style.display = 'block';
            adminFormsListDiv.style.display = 'block';
            fetchAdminForms();
        } else {
            adminSection.style.display = 'none';
            adminFormsListDiv.style.display = 'none';
        }
        userSection.style.display = 'block'; // Users can always join forms
    } else {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        loggedInUserInfo.style.display = 'none';
        loginBtn.style.display = 'inline-block';
        registerUserBtn.style.display = 'inline-block';
        registerAdminBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        adminSection.style.display = 'none';
        userSection.style.display = 'none';
        collaborativeFormDisplay.style.display = 'none'; // Hide form if logged out
    }
}

// --- Authentication Handlers ---

async function authRequest(endpoint, username, password, role = null) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(role ? { username, password, role } : { username, password })
        });
        const data = await response.json();
        if (response.ok) {
            displayMessage(authStatusDiv, data.message || 'Success!', 'info');
            if (data.token) {
                updateUIForAuth(data.user, data.token);
            }
        } else {
            displayMessage(authStatusDiv, data.message || 'An error occurred.', 'error');
        }
    } catch (error) {
        console.error('Auth error:', error);
        displayMessage(authStatusDiv, 'Network error during authentication.', 'error');
    }
}

registerUserBtn.addEventListener('click', () => authRequest('register', authUsernameInput.value, authPasswordInput.value, 'user'));
registerAdminBtn.addEventListener('click', () => authRequest('register', authUsernameInput.value, authPasswordInput.value, 'admin'));
loginBtn.addEventListener('click', () => authRequest('login', authUsernameInput.value, authPasswordInput.value));
logoutBtn.addEventListener('click', () => {
    updateUIForAuth(null, null);
    // Also disconnect from WebSocket if currently connected to a form
    if (socket.connected) {
        socket.disconnect();
        console.log('Socket disconnected on logout.');
    }
    currentForm = null;
    currentFormResponse = {};
    liveFormFieldsContainer.innerHTML = '';
});

// --- Admin: Form Creation ---

let fieldCounter = 0; // To ensure unique field names for initial demo

function addFieldToAdminForm(type, fieldData = {}) {
    fieldCounter++;
    const fieldId = `field-${fieldCounter}`;
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'flex flex-col sm:flex-row items-start sm:items-center gap-2 border p-3 rounded-md bg-white';
    fieldDiv.dataset.type = type;

    let fieldContent = `
        <input type="hidden" name="type" value="${type}">
        <div class="flex-grow w-full sm:w-auto">
            <label for="${fieldId}-label" class="block text-gray-700 text-xs font-bold mb-1">Label:</label>
            <input type="text" id="${fieldId}-label" name="label" class="w-full border rounded py-1 px-2 text-gray-700" placeholder="e.g., Your Name" value="${fieldData.label || ''}">
        </div>
        <div class="flex-grow w-full sm:w-auto">
            <label for="${fieldId}-name" class="block text-gray-700 text-xs font-bold mb-1">Name (unique key):</label>
            <input type="text" id="${fieldId}-name" name="name" class="w-full border rounded py-1 px-2 text-gray-700" placeholder="e.g., fullName" value="${fieldData.name || ''}">
        </div>
    `;

    if (type === 'dropdown') {
        fieldContent += `
            <div class="flex-grow w-full sm:w-auto">
                <label for="${fieldId}-options" class="block text-gray-700 text-xs font-bold mb-1">Options (comma-separated):</label>
                <input type="text" id="${fieldId}-options" name="options" class="w-full border rounded py-1 px-2 text-gray-700" placeholder="e.g., Option1,Option2" value="${(fieldData.options || []).join(',') || ''}">
            </div>
        `;
    }

    fieldContent += `
        <div class="flex-shrink-0">
            <label class="block text-gray-700 text-xs font-bold mb-1">Required:</label>
            <input type="checkbox" id="${fieldId}-required" name="required" ${fieldData.required ? 'checked' : ''} class="mr-2 leading-tight">
        </div>
        <button type="button" class="remove-field-btn text-red-500 hover:text-red-700 font-bold py-1 px-2 rounded">X</button>
    `;

    fieldDiv.innerHTML = fieldContent;
    formFieldsContainer.appendChild(fieldDiv);

    // Add event listener for remove button
    fieldDiv.querySelector('.remove-field-btn').addEventListener('click', () => {
        fieldDiv.remove();
    });
}

addTextFieldBtn.addEventListener('click', () => addFieldToAdminForm('text'));
addNumberFieldBtn.addEventListener('click', () => addFieldToAdminForm('number'));
addDropdownFieldBtn.addEventListener('click', () => addFieldToAdminForm('dropdown'));

createFormBtn.addEventListener('click', async () => {
    if (!currentToken) {
        displayMessage(createFormStatusDiv, 'You must be logged in to create a form.', 'error');
        return;
    }

    const name = formNameInput.value.trim();
    const description = formDescriptionInput.value.trim();
    const fields = [];

    formFieldsContainer.querySelectorAll('.flex.flex-col').forEach(fieldDiv => {
        const type = fieldDiv.dataset.type;
        const label = fieldDiv.querySelector('[name="label"]').value.trim();
        const fieldName = fieldDiv.querySelector('[name="name"]').value.trim();
        const required = fieldDiv.querySelector('[name="required"]').checked;

        if (!label || !fieldName) {
            displayMessage(createFormStatusDiv, 'All field labels and unique names must be filled.', 'error');
            return; // Skip this field, or show error for all fields
        }

        const field = { type, label, name: fieldName, required };
        if (type === 'dropdown') {
            const optionsInput = fieldDiv.querySelector('[name="options"]').value.trim();
            field.options = optionsInput.split(',').map(opt => opt.trim()).filter(opt => opt !== '');
            if (field.options.length === 0) {
                 displayMessage(createFormStatusDiv, `Dropdown field '${label}' must have options.`, 'error');
                 return;
            }
        }
        fields.push(field);
    });

    if (!name) {
        displayMessage(createFormStatusDiv, 'Form name is required.', 'error');
        return;
    }
    if (fields.length === 0) {
        displayMessage(createFormStatusDiv, 'At least one field is required for the form.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/forms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ name, description, fields })
        });
        const data = await response.json();
        if (response.ok) {
            displayMessage(createFormStatusDiv, data.message || 'Form created!', 'info');
            clearFormCreationInputs();
            if (currentUser && currentUser.role === 'admin') {
                fetchAdminForms(); // Refresh list of created forms
            }
        } else {
            displayMessage(createFormStatusDiv, data.message || 'Failed to create form.', 'error');
        }
    } catch (error) {
        console.error('Error creating form:', error);
        displayMessage(createFormStatusDiv, 'Network error during form creation.', 'error');
    }
});

// --- Admin: Fetch & Display Forms ---
// public/script.js
// ... (rest of your code)

// --- Admin: Fetch & Display Forms ---

async function fetchAdminForms() {
    if (!currentToken || currentUser.role !== 'admin') {
        formsListUl.innerHTML = '<li class="text-gray-600 italic">Not authorized to view forms.</li>';
        return;
    }

    try {
        // CORRECTED FETCH CALL:
        // This should hit the GET /api/forms route defined in formRoutes.js
        const response = await fetch(`${API_BASE_URL}/api/forms`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        const forms = await response.json();

        formsListUl.innerHTML = ''; // Clear previous list
        if (forms && forms.length > 0) {
            forms.forEach(form => {
                const li = document.createElement('li');
                li.className = 'border-b pb-2 mb-2 flex justify-between items-center';
                li.innerHTML = `
                    <div>
                        <strong class="text-gray-800">${form.name}</strong> (Share Code: <span class="font-mono text-blue-700">${form.share_code}</span>)
                    </div>
                    <button data-share-code="${form.share_code}" class="btn-primary text-sm py-1 px-3 join-from-list-btn">Join</button>
                `;
                formsListUl.appendChild(li);
            });
            // Add event listeners to the new "Join" buttons
            document.querySelectorAll('.join-from-list-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    joinShareCodeInput.value = event.target.dataset.shareCode;
                    joinFormBtn.click(); // Programmatically click the join button
                });
            });
        } else {
            formsListUl.innerHTML = '<li class="text-gray-600 italic">No forms created yet.</li>';
        }
    } catch (error) {
        console.error('Error fetching admin forms:', error);
        formsListUl.innerHTML = '<li class="text-red-600 italic">Error loading forms.</li>';
    }
}

// ... (rest of your script.js)


// --- User: Join Form ---

joinFormBtn.addEventListener('click', async () => {
    if (!currentToken) {
        displayMessage(joinFormStatusDiv, 'You must be logged in to join a form.', 'error');
        return;
    }

    const shareCode = joinShareCodeInput.value.trim();
    if (!shareCode) {
        displayMessage(joinFormStatusDiv, 'Please enter a share code.', 'error');
        return;
    }

    try {
        // Fetch initial form data and response
        const response = await fetch(`${API_BASE_URL}/api/forms/join/${shareCode}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        const data = await response.json();

        if (response.ok) {
            currentForm = data.form;
            currentFormResponse = data.response;

            // Disconnect from any previous Socket.IO room before joining a new one
            if (socket.connected) {
                 socket.emit('leave_form', { formId: currentForm ? currentForm.id : null }); // Inform server to leave current room
                 // For this simple demo, we rely on `socket.join` implicitly leaving old rooms
            } else {
                // If socket is not connected, force a reconnect to ensure it joins the new room correctly
                socket.connect();
            }

            // Emit join_form event to Socket.IO
            socket.emit('join_form', {
                shareCode: shareCode,
                token: currentToken
            });

            // Update UI to show collaborative form
            displayCollaborativeForm();
            displayMessage(joinFormStatusDiv, `Successfully joined form "${currentForm.name}".`, 'info');
        } else {
            displayMessage(joinFormStatusDiv, data.message || 'Failed to join form.', 'error');
        }
    } catch (error) {
        console.error('Error joining form:', error);
        displayMessage(joinFormStatusDiv, 'Network error joining form.', 'error');
    }
});

// --- Collaborative Form Display ---

function displayCollaborativeForm() {
    if (!currentForm) {
        collaborativeFormDisplay.style.display = 'none';
        return;
    }

    collaborativeFormDisplay.style.display = 'block';
    currentFormTitle.textContent = currentForm.name;
    currentFormDescription.textContent = currentForm.description || '';
    liveFormFieldsContainer.innerHTML = ''; // Clear previous fields

    currentForm.fields.forEach(field => {
        const fieldGroupDiv = document.createElement('div');
        fieldGroupDiv.className = 'field-group';

        const labelElem = document.createElement('label');
        labelElem.className = 'block text-gray-700 text-sm font-bold mb-2';
        labelElem.htmlFor = `live-${field.name}`;
        labelElem.textContent = field.label + (field.required ? ' *' : '');
        fieldGroupDiv.appendChild(labelElem);

        let inputElement;
        const initialValue = currentFormResponse[field.name] !== undefined ? currentFormResponse[field.name] : '';

        if (field.type === 'dropdown') {
            inputElement = document.createElement('select');
            inputElement.id = `live-${field.name}`;
            inputElement.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
            field.options.forEach(option => {
                const optionElem = document.createElement('option');
                optionElem.value = option;
                optionElem.textContent = option;
                inputElement.appendChild(optionElem);
            });
            inputElement.value = initialValue;
            inputElement.addEventListener('change', (event) => handleFieldChange(field.name, event.target.value));
        } else {
            inputElement = document.createElement('input');
            inputElement.id = `live-${field.name}`;
            inputElement.type = field.type;
            inputElement.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
            inputElement.value = initialValue;
            inputElement.placeholder = `Enter ${field.label}`;
            // Debounce input for text/number fields to avoid too many socket emissions
            let typingTimer;
            const doneTypingInterval = 500; // milliseconds
            inputElement.addEventListener('input', (event) => {
                clearTimeout(typingTimer);
                typingTimer = setTimeout(() => {
                    handleFieldChange(field.name, event.target.value);
                }, doneTypingInterval);
            });
        }

        fieldGroupDiv.appendChild(inputElement);

        const statusSpan = document.createElement('span');
        statusSpan.id = `status-${field.name}`;
        statusSpan.className = 'text-xs text-gray-500 ml-2 italic';
        fieldGroupDiv.appendChild(statusSpan);

        liveFormFieldsContainer.appendChild(fieldGroupDiv);
    });
}

function handleFieldChange(fieldName, newValue) {
    if (!currentForm || !currentUser) return;

    // Update local state immediately for responsiveness
    currentFormResponse[fieldName] = newValue;

    // Emit update to server
    socket.emit('update_field', {
        formId: currentForm.id,
        fieldName: fieldName,
        newValue: newValue
    });

    // Optionally show a "saving..." indicator
    const statusElem = document.getElementById(`status-${fieldName}`);
    if (statusElem) {
        statusElem.textContent = `(You are editing ${fieldName}...)`;
        setTimeout(() => {
            if (statusElem.textContent.includes('You are editing')) {
                statusElem.textContent = ''; // Clear if still showing current user's edit
            }
        }, 1000);
    }
}

// --- Socket.IO Event Listeners ---

socket.on('connect', () => {
    console.log('Connected to Socket.IO server.');
    // If we have a token and a current form, try to rejoin the room
    if (currentToken && currentForm) {
        socket.emit('join_form', { shareCode: currentForm.share_code, token: currentToken });
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from Socket.IO server.');
    collaborativeStatusDiv.textContent = 'Disconnected from collaboration server. Attempting to reconnect...';
    collaborativeStatusDiv.style.display = 'block';
});

socket.on('form_joined', (data) => {
    console.log('Joined form successfully:', data);
    currentForm = data.form;
    currentFormResponse = data.response;
    displayCollaborativeForm(); // Re-render with initial data
    collaborativeStatusDiv.textContent = 'You are live! Collaborative editing enabled.';
    collaborativeStatusDiv.style.display = 'block';
});

socket.on('field_updated', (data) => {
    // Only update if this is for the currently viewed form and not our own edit
    if (currentForm && data.formId === currentForm.id && data.updatedBy !== currentUser.username) {
        currentFormResponse[data.fieldName] = data.newValue;
        const inputElement = document.getElementById(`live-${data.fieldName}`);
        if (inputElement) {
            inputElement.value = data.newValue; // Update UI
            const statusElem = document.getElementById(`status-${data.fieldName}`);
            if (statusElem) {
                statusElem.textContent = `(Last edited by ${data.updatedBy})`;
                setTimeout(() => {
                    statusElem.textContent = ''; // Clear after a brief display
                }, 2000);
            }
        }
        console.log(`Field ${data.fieldName} updated to ${data.newValue} by ${data.updatedBy}`);
    }
});

socket.on('form_error', (data) => {
    console.error('Form Error:', data.message);
    displayMessage(joinFormStatusDiv, data.message, 'error'); // Display error in join section
    collaborativeStatusDiv.textContent = `Error: ${data.message}`;
    collaborativeStatusDiv.style.display = 'block';
    currentForm = null;
    currentFormResponse = {};
    liveFormFieldsContainer.innerHTML = '';
    currentFormTitle.textContent = '';
    currentFormDescription.textContent = '';
    collaborativeFormDisplay.style.display = 'none';
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    // Attempt to auto-login from local storage
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
        try {
            const user = JSON.parse(storedUser);
            updateUIForAuth(user, storedToken);
        } catch (e) {
            console.error('Error parsing stored user data:', e);
            updateUIForAuth(null, null); // Clear invalid data
        }
    }

    // Add an initial text field to the admin form creation
    addFieldToAdminForm('text', { label: 'Participant Name', name: 'participantName', required: true });
    addFieldToAdminForm('number', { label: 'Age', name: 'age' });
    addFieldToAdminForm('dropdown', { label: 'Favorite Color', name: 'favColor', options: ['Red', 'Green', 'Blue'] });
});