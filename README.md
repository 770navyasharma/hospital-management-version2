# Hospital Management System V2 (MAD-II)

A premium, Flask-based enterprise web application for hospital operations. Featuring high-end portals for Admins, Doctors, and Patients with real-time analytics, dynamic data visualization, and professional clinical reporting.

This project is developed for the Modern Application Development II (MAD-II) course.

## 🚀 Tech Stack

![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![Vue.js](https://img.shields.io/badge/Vue.js-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

* **Backend:** Flask (Python)
* **Frontend:** Vue.js 3, Bootstrap 5, Jinja2
* **Database:** SQLite with Flask-SQLAlchemy
* **Analytics:** Chart.js with dynamic API integration
* **Reporting:** html2pdf.js for professional medical exports
* **Authentication:** Flask-Security-Too (RBAC enabled)

## ✨ Features Implemented

### 🛡️ Secure Admin Portal
* **Advanced Analytics Dashboard:** Real-time visualization of appointment volume, patient intake mix, and doctor workload using high-performance Chart.js components.
* **Dynamic Global Filtering:** Centralized date-range picker that instantly updates all dashboard metrics via asynchronous API calls.
* **Medical Case Management:** Complete oversight of patient profiles, clinical histories, and appointment logs.
* **Professional PDF Exports:** Automated generation of Clinical Visit Reports with A4-optimized layouts, medical typography, and secure data mapping.
* **Staff Performance Tracking:** Multi-bar comparative charts showing recovery rates and patient load per specialist.
* **Administrative Control:** Full Blacklist/Restore functionality for user accounts with secure confirmation flows.

### 👨‍⚕️ Doctor Dashboard & Management (New!)
* **Real-time Statistics:** Instant visibility into treated, cancelled, and queued patients.
* **Availability Scheduler:** Dynamic calendar-based scheduling for doctor slots.
* **Request Management:** Accept/Reject workflow with **Swipe Gestures** (Mobile-friendly).
* **Ongoing Visit Portal:** Live diagnosis, structured prescriptions (JSON-based), and clinical notes.
* **Attachment Management:** Upload and preview reports, X-rays, and videos with premium global modal controls.

### 🔐 Security & Core
* **Role-Based Access Control (RBAC):** Strict partitioning between Admin, Doctor, and Patient views.
* **Self-Registration:** Custom aesthetic registration flow for new patients.
* **Admin Shield:** Secure script-based administrator initialization.

## 📊 Milestone: Doctor Dashboard & Appointment/Treatment Management
* ✅ **Expected Time:** 7 days
* 📊 **Completion Progress:** 15%

- [x] **Milestone 0:** GitHub Repository Setup
- [x] **Milestone 1:** Database Models and Schema Setup
- [x] **Milestone 2:** Authentication and Role-Based Access
- [x] **Milestone 3:** Admin Portal & Analytics Engine
- [x] **Milestone 4:** Doctor Dashboard & Consultation Tools
- [ ] **Milestone 5:** Patient Dashboard and Appointment System
- [ ] **Milestone 6:** Backend Jobs (Celery + Redis)
- [ ] **Milestone 7:** API Performance Optimization

## ⚙️ Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd hospital-management-version2
    ```

2.  **Activate Virtual Environment:**
    ```bash
    # macOS/Linux
    source venv/bin/activate
    # Windows
    .\venv\Scripts\activate
    ```

3.  **Install Dependencies:**
    ```bash
    pip install Flask Flask-SQLAlchemy Flask-Security-Too Flask-Bcrypt passlib bcrypt
    ```

4.  **Initialize Database & Admin:**
    ```bash
    python create_admin.py
    ```

5.  **Run the Application:**
    ```bash
    python run.py
    ```

## 🔑 Default Credentials

- **Admin Email:** `admin@hms.com`
- **Admin Password:** `admin123`
