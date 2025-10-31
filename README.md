# Hospital Management System V2 (MAD-II)

A modern, Flask-based web application for managing hospital operations. This system provides a clean interface for booking appointments, managing patient histories, and streamlining hospital workflows for patients, doctors, and admins.

This project is being developed for the Modern Application Development II (MAD-II) course.

## 🚀 Tech Stack

![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)

* **Backend:** Flask
* **Database:** SQLite with Flask-SQLAlchemy
* **Authentication:** Flask-Security-Too (with passlib & bcrypt)
* **Frontend:** HTML, Bootstrap 5, Jinja2

## ✨ Features Implemented (So Far)

* **Secure Authentication:** Full login, logout, "Remember Me" functionality, and strong session protection.
* **Role-Based Access Control (RBAC):** Three distinct user roles:
    * **Admin:** Can access all system functionalities (future).
    * **Doctor:** Can manage appointments and patient history (future).
    * **Patient:** Can book appointments and view their history.
* **Patient Self-Registration:** A custom, aesthetic, and secure registration page for new patients.
* **Secure Admin Creation:** Admin user is pre-created via a secure script (`create_admin.py`).
* **Role-Specific Redirects:** Users are automatically redirected to their correct dashboard upon login.
* **Protected Routes:** Logged-in users are prevented from accessing public pages (like login/register) and vice-versa.
* **Modern UI/UX:** A clean, responsive landing page and authentication flow using custom CSS and SVGs.

## ⚙️ Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-name>
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    # For macOS/Linux
    python3 -m venv venv
    source venv/bin/activate

    # For Windows
    python -m venv venv
    .\venv\Scripts\activate
    ```

3.  **Create a `requirements.txt` file** in your root directory and add the following:
    ```txt
    Flask
    Flask-SQLAlchemy
    Flask-Security-Too
    Flask-Bcrypt
    passlib
    bcrypt
    ```

4.  **Install the dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Initialize the Database & Admin:**
    This step creates the `hospital.db` file and your pre-defined admin user.
    ```bash
    python create_admin.py
    ```
    *You will see messages confirming the database and users are created.*

6.  **Run the Application:**
    ```bash
    python run.py
    ```
    The application will be running at `http://127.0.0.1:5000/`.

## 🔑 Default Credentials

You can log in as the pre-built administrator to get started:

* **Email:** `admin@hms.com`
* **Password:** `admin123`

## 📊 Milestone Progress

-   [x] **Milestone 0:** GitHub Repository Setup
-   [x] **Milestone:** Database Models and Schema Setup
-   [x] **Milestone:** Authentication and Role-Based Access
-   [ ] **Milestone:** Admin Dashboard and Management
-   [ ] **Milestone:** Doctor Dashboard & Management
-   [ ] **Milestone:** Patient Dashboard and Appointment System
-   [ ] **Milestone:** Appointment History and Conflict Prevention
-   [ ] **Milestone:** Backend Jobs (Celery + Redis)
-   [ ] **Milestone:** API Performance Optimization (Redis Cache)