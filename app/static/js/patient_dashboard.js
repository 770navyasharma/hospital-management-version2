const { createApp } = Vue;

createApp({
    delimiters: ['[[', ']]'],
    data() {
        return {
            doctors: [], // Hydrated from server
            searchQuery: '',
            selectedDept: null,
            showBookingModal: false,
            selectedDoctor: null,
            isUrgent: false,
            urgentNote: '',
            loading: false,
            myAppointments: []
        }
    },
    computed: {
        filteredDoctors() {
            return this.doctors.filter(d => {
                const matchesSearch = d.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                    d.dept.toLowerCase().includes(this.searchQuery.toLowerCase());
                const matchesDept = !this.selectedDept || d.dept === this.selectedDept;
                return matchesSearch && matchesDept;
            });
        }
    },
    mounted() {
        this.loadDoctors();
        this.loadAppointments();
    },
    methods: {
        async loadDoctors() {
            // Note: In a real app we'd have a specific API for this, but for now we'll mock the mapping 
            // from the global window object or just pass them as JSON.
            // For this implementation, I'll assume we can get them from a window variable.
            if (window.doctorData) {
                this.doctors = window.doctorData;
            }
        },
        openBookingModal(doctor) {
            this.selectedDoctor = doctor;
            this.isUrgent = false;
            this.urgentNote = '';
            this.showBookingModal = true;

            this.$nextTick(() => {
                flatpickr("#bookingDatetime", {
                    enableTime: true,
                    dateFormat: "Y-m-dTH:i",
                    altInput: true,
                    altFormat: "F j, Y at h:i K",
                    minDate: "today",
                    time_24hr: false
                });
            });
        },
        async submitBooking() {
            const dt = document.getElementById('bookingDatetime').value;
            if (!dt) return alert("Please select a date and time.");

            if (this.isUrgent && !this.urgentNote) {
                return alert("Please provide a reason for the urgent request.");
            }

            this.loading = true;
            try {
                const res = await fetch('/api/patient/book', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        doctor_id: this.selectedDoctor.id,
                        datetime: dt,
                        is_urgent: this.isUrgent,
                        note: this.urgentNote
                    })
                });

                const result = await res.json();
                if (res.ok) {
                    alert("Appointment requested! Please wait for doctor's approval.");
                    this.showBookingModal = false;
                    this.loadAppointments();
                } else {
                    alert(result.message);
                }
            } catch (error) {
                console.error("Booking error:", error);
                alert("Failed to request appointment. Please try again.");
            } finally {
                this.loading = false;
            }
        },
        async loadAppointments() {
            try {
                const res = await fetch('/api/patient/appointments');
                if (res.ok) {
                    this.myAppointments = await res.json();
                }
            } catch (e) { console.error("History fetch error:", e); }
        },
        async cancelAppointment(apptId) {
            const reason = prompt("Please provide a reason for cancellation:");
            if (reason === null) return; // Cancelled prompt

            try {
                const res = await fetch(`/api/patient/cancel/${apptId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: reason || 'No reason provided' })
                });
                if (res.ok) {
                    alert("Appointment cancelled.");
                    this.loadAppointments();
                }
            } catch (e) {
                alert("Failed to cancel appointment.");
            }
        }
    }
}).mount('#patient-app');
