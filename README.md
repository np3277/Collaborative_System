Collaborative Form Filling System
This project implements a backend system for collaborative form filling, allowing administrators to create dynamic forms and multiple users to collaboratively fill a their own instance of a shared response in real-time. It's designed with real-time updates, data consistency, and scalability in mind.

Table of Contents
Architecture and Design Decisions

Technologies Used

Key Features

Setup & Run Instructions

API Endpoints

WebSocket Events

Edge Cases Handled

Future Improvements

Architecture and Design Decisions
The system employs a layered architecture focused on real-time communication and data persistence.

API Gateway (Implicit): Express.js acts as the entry point for both RESTful API requests and WebSocket connections.

Form Management: Dedicated routes and controllers handle the creation, retrieval, and management of form definitions.

Collaboration Layer: Socket.IO manages WebSocket connections, enabling real-time bidirectional communication for live updates. It uses Redis as a Pub/Sub mechanism for scaling across multiple instances.

Data Persistence: PostgreSQL serves as the primary database for storing form definitions and the individual user's response for each form.

Caching/Messaging: Redis is utilized for Socket.IO's adapter (Pub/Sub) and can be extended for other caching needs like temporary field locks.

Design Choices Rationale:

Node.js with Express: Chosen for its asynchronous, non-blocking I/O model, which is highly efficient for handling concurrent connections typical in real-time applications. Express provides a minimalist and flexible framework.

Socket.IO: A battle-tested library for real-time, bi-directional communication. It abstracts away WebSocket complexities and provides fallback mechanisms, ensuring broad browser compatibility and robust connection management.

PostgreSQL: Selected for its strong ACID compliance, ensuring data consistency under simultaneous edits. Its JSONB data type is perfect for storing flexible, dynamic form field definitions and the collaborative response data without rigid schema migrations for every form change.

Redis: Crucial for horizontal scaling of Socket.IO instances. Its Pub/Sub capabilities allow messages to be broadcast efficiently across all connected Node.js servers, ensuring all clients receive updates regardless of which server they are connected to. Its speed also makes it suitable for potential field locking mechanisms.

JWT (JSON Web Tokens): For stateless authentication, allowing secure communication between clients and the server for both REST and WebSocket connections.

Docker & Docker Compose: For containerization, providing a consistent development, testing, and production environment. It simplifies dependency management and orchestration of multiple services (Node.js, PostgreSQL, Redis).

Technologies Used
Backend: Node.js, Express.js

Real-time: Socket.IO

Database: PostgreSQL (using pg-promise for database interactions)

Cache/Pub-Sub: Redis

Authentication: JSON Web Tokens (JWT)

Containerization: Docker, Docker Compose

Frontend (Basic Demo): HTML, JavaScript (vanilla)

Key Features
Admin Role:

Create new forms with dynamic fields (text, number, dropdown).

Generate a unique share code for each form.

User Role:

Join a shared form using its unique share code.

Collaboratively fill the form with other users on their individual response instance.

Experience live updates as others type or edit fields in real-time.

Per-User Shared Response: Each user has their own editable response instance for a given form. Changes are synchronized across all users viewing the same form and response.

Real-time Synchronization: Achieved via WebSockets, ensuring all users see changes instantly.

Data Consistency: PostgreSQL's transactional capabilities combined with an "optimistic locking" strategy (last write wins at the field level) ensures data integrity.

Setup & Run Instructions
Make sure you have Docker and Docker Compose installed on your system.

Clone the repository:

git clone <your-repo-link>
cd collaborative-form-filling-system

Create .env file:
Copy the .env.example file to .env and configure your environment variables.

cp .env.example .env

Modify .env with your desired values (e.g., strong JWT_SECRET).

Clean and Rebuild Docker Containers (Recommended for a Fresh Start):
This command will stop and remove all existing containers, networks, and all persistent database data (including users, forms, and responses). It then rebuilds the Node.js application image and starts all services. This is crucial after any schema changes or if you encounter unexpected issues.

docker-compose down -v --rmi all
# Then, restart Docker Desktop if you are on Windows.
docker-compose up --build -d

--build: Ensures the Node.js Docker image is rebuilt with the latest code.

-d: Runs the containers in detached mode (in the background).

Verify all services are running: docker-compose ps

Access the Application:

Frontend Demo: http://localhost:8000

Important: After running docker-compose down -v --rmi all, your database is completely wiped. You must register new Admin and User accounts via the frontend before proceeding.

API Endpoints
All API endpoints are protected by JWT authentication (except /auth/register and /auth/login). You need to include the Authorization: Bearer <token> header for authenticated requests.

Authentication
POST /auth/register

Registers a new user (can be admin or user role).

Body: { "username": "testuser", "password": "password123", "role": "user" }

Response: { "message": "User registered successfully." }

POST /auth/login

Logs in a user and returns a JWT token.

Body: { "username": "testuser", "password": "password123" }

Response: { "token": "jwt_token_string", "user": { "id": "uuid", "username": "...", "role": "..." } }

Forms (Admin Role Required for Creation/Viewing Own Forms)
POST /api/forms

Description: Creates a new form definition and an associated initial empty response.

Body:

{
  "name": "Employee Survey",
  "description": "Annual feedback for staff.",
  "fields": [
    { "type": "text", "name": "fullName", "label": "Full Name", "required": true },
    { "type": "number", "name": "age", "label": "Age", "required": false },
    { "type": "dropdown", "name": "department", "label": "Department", "options": ["HR", "Engineering", "Marketing"], "required": true },
    { "type": "text", "name": "comments", "label": "Additional Comments", "required": false }
  ]
}

Response:

{
  "message": "Form created successfully.",
  "form": {
    "id": "uuid",
    "name": "Employee Survey",
    "shareCode": "RND123"
  }
}

GET /api/forms

Description: Retrieves all forms created by the current admin.

Response: [{ "id": "uuid", "name": "...", "shareCode": "..." }, ...]

GET /api/forms/:formId

Description: Retrieves a specific form definition by its ID.

Response: { "id": "uuid", "name": "...", "fields": [...], "shareCode": "..." }

GET /api/forms/join/:shareCode

Description: Retrieves a form definition and the current user's response data for that form (creating an empty response if none exists for the user).

Response: { "form": { ...formDefinition... }, "response": { ...currentUserResponseData... } }

WebSocket Events
The WebSocket server runs on the same port as the HTTP server (http://localhost:8000).

Client to Server Events
join_form

Payload: { "shareCode": "STRING", "token": "JWT_TOKEN" }

Description: Used by clients to authenticate and join a specific form's collaboration room.

update_field

Payload: { "formId": "UUID", "fieldName": "STRING", "newValue": "ANY_TYPE" }

Description: Sent by a client when a form field's value changes.

Server to Client Events
form_joined

Payload: { "form": { ...formDefinition... }, "response": { ...currentUserResponseData... } }

Description: Sent to a client immediately after they successfully join_form. Provides the form's structure and their current response data.

field_updated

Payload: { "formId": "UUID", "fieldName": "STRING", "newValue": "ANY_TYPE", "updatedBy": "STRING" }

Description: Broadcast to all clients in a specific formId room when any user updates a field. The updatedBy is the username of the user who made the change.

form_error

Payload: { "message": "STRING" }

Description: Sent to a client if an error occurs (e.g., invalid share code, authentication failure).

Edge Cases Handled
Concurrent Edits: The system uses an "optimistic locking" approach for field updates. If multiple users update the same field simultaneously, the last successful write to the database will prevail ("last write wins" at the field level). For most form-filling scenarios, this is acceptable, as users are generally focused on different fields or quickly see updates.

Network Disconnections: Socket.IO handles automatic reconnections and buffering of events, ensuring a resilient real-time experience.

Authentication/Authorization: All sensitive API routes and WebSocket join_form events require a valid JWT, and role-based access control (admin vs. user) is enforced.

Invalid Form/Share Code: The system gracefully handles attempts to join non-existent forms or using invalid share codes.

Data Validation: Basic server-side validation is performed on form creation (e.g., ensuring required fields are present).

Future Improvements
Advanced Conflict Resolution: Implement Operational Transformation (OT) or Conflict-Free Replicated Data Types (CRDTs) for character-level collaborative editing within text fields (more complex).

Field Locking (Explicit): Implement a mechanism where a user editing a field explicitly "locks" it for a short duration, preventing others from editing until unlocked or timeout. This would require Redis to store lock states.

User Presence: Show which users are currently viewing/editing a form (e.g., "3 users online").

Version History: Allow viewing previous versions of a form response.

Permissions: More granular permissions for forms (e.g., view-only users, specific field permissions).

Robust Input Validation: More comprehensive server-side and client-side validation for all field types.

Rate Limiting: Protect against abuse for API endpoints.

Frontend Enhancements: A more robust and visually appealing frontend (e.g., using React/Vue/Angular), including user management UI, form creation UI, and real-time typing indicators.