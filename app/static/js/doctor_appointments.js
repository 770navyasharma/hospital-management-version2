(function () {
    const { createApp, nextTick } = Vue;

    const app = createApp({
        delimiters: ['[[', ']]'],
        data() {
            const shared = window.HMS_DOCTOR_SHARED || { globalState: {}, sharedMethods: {} };
            return {
                globalState: shared.globalState,
                sharedMethods: shared.sharedMethods,
                allAppointments: [],
                dateRange: '',
                fp: null,
                searchQuery: '',
                activeStatusFilters: ['Booked', 'Ongoing', 'Requested'],
                statusOptions: ['Booked', 'Ongoing', 'Requested', 'Completed', 'Cancelled', 'Rejected'],
                expandedId: null,
                patientHistory: [],
                historyLoading: false,
                copyStatus: null
            }
        },
        computed: {
            filteredAppointments() {
                if (!this.allAppointments) return [];
                return this.allAppointments.filter(appt => {
                    const matchesSearch = !this.searchQuery ||
                        (appt.patient_name || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                        (appt.diagnosis || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                        (appt.urgent_note && appt.urgent_note.toLowerCase().includes(this.searchQuery.toLowerCase()));

                    const matchesStatus = this.activeStatusFilters.length === 0 || this.activeStatusFilters.includes(appt.status);
                    return matchesSearch && matchesStatus;
                }).sort((a, b) => {
                    
                    const dateA = new Date(a.raw_date || a.datetime);
                    const dateB = new Date(b.raw_date || b.datetime);
                    if (dateB - dateA !== 0) return dateB - dateA;

                    
                    return a.status.localeCompare(b.status);
                });
            }
        },
        async mounted() {
            console.log("Appointments Page Mounted.");
            await this.fetchData();
            this.initDatePicker();
        },
        unmounted() {
        },
        methods: {
            async fetchData() {
                console.log("Fetching Appointments List...");
                if (this.sharedMethods && this.sharedMethods.fetchGlobalData) {
                    await this.sharedMethods.fetchGlobalData();
                }

                try {
                    const url = `/doctor/api/doctor/appointments-list?date_range=${this.dateRange}`;
                    const res = await fetch(url);
                    if (!res.ok) {
                        if (res.status === 401 || res.status === 302) {
                            window.location.href = "/login";
                            return;
                        }
                    }
                    this.allAppointments = await res.json();
                } catch (e) {
                    console.error("Failed to fetch appointments", e);
                }
            },
            async fetchPageData() {
                await this.fetchData();
            },
            initDatePicker() {
                nextTick(() => {
                    const el = document.getElementById('apptDateFilter');
                    if (!el) return;
                    this.fp = flatpickr(el, {
                        mode: "range",
                        dateFormat: "Y-m-d",
                        onChange: (selectedDates, dateStr) => {
                            if (selectedDates.length === 2) {
                                this.dateRange = dateStr;
                                this.fetchData();
                            }
                        }
                    });
                });
            },
            clearFilter() {
                this.dateRange = '';
                if (this.fp) this.fp.clear();
                this.fetchData();
            },
            toggleStatusFilter(status) {
                const index = this.activeStatusFilters.indexOf(status);
                if (index > -1) {
                    this.activeStatusFilters.splice(index, 1);
                } else {
                    this.activeStatusFilters.push(status);
                }
            },
            resetFilters() {
                this.searchQuery = '';
                this.activeStatusFilters = ['Booked', 'Ongoing', 'Requested'];
                this.clearFilter();
            },
            async toggleRow(appt) {
                if (this.expandedId === appt.id) {
                    this.expandedId = null;
                    return;
                }
                this.expandedId = appt.id;
                this.fetchPatientHistory(appt.patient_id);
            },
            async fetchPatientHistory(patientId) {
                if (!patientId) return;
                this.historyLoading = true;
                this.patientHistory = [];
                try {
                    const res = await fetch(`/doctor/api/doctor/patient-history/${patientId}`);
                    this.patientHistory = await res.json();
                } catch (e) {
                    console.error("History fetch failed", e);
                } finally {
                    this.historyLoading = false;
                }
            },
            calculateAge(dobStr) {
                if (!dobStr) return '??';
                const birthDate = new Date(dobStr);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
                return age;
            },
            copyToClipboard(text, id) {
                if (!text) return;
                navigator.clipboard.writeText(text).then(() => {
                    this.copyStatus = id;
                    setTimeout(() => {
                        this.copyStatus = null;
                    }, 2000);
                });
            },
            getPaymentBadgeClass(status) {
                return {
                    'bg-success text-white': status === 'Paid',
                    'bg-warning text-dark': status === 'Partially Paid',
                    'bg-secondary text-white': status === 'Pending' || !status
                };
            },
            getStatusBadgeClass(status) {
                return {
                    'bg-success-soft text-success': status === 'Completed',
                    'bg-primary-soft text-primary': status === 'Booked' || status === 'Ongoing',
                    'bg-danger-soft text-danger': status === 'Cancelled' || status === 'Rejected',
                    'bg-warning-soft text-warning': status === 'Expired',
                    'bg-info-soft text-info': status === 'Requested'
                };
            },
            async processReq(id, status) {
                if (this.sharedMethods && this.sharedMethods.processReq) {
                    await this.sharedMethods.processReq.call(this, id, status);
                    await this.fetchData();
                }
            },
            getStatusColor(status) {
                if (this.sharedMethods && this.sharedMethods.getStatusColor) {
                    return this.sharedMethods.getStatusColor(status);
                }
                return '#858796';
            }
        }
    });

    if (window.HMS_DOCTOR_SHARED && window.HMS_DOCTOR_SHARED.sharedMethods.registerDirectives) {
        window.HMS_DOCTOR_SHARED.sharedMethods.registerDirectives(app);
    }
    app.mount('#doctor-app');
})();