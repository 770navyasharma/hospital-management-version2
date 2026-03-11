(function () {
    const { createApp, nextTick } = Vue;

    const app = createApp({
        delimiters: ['[[', ']]'],
        data() {
            const shared = window.HMS_DOCTOR_SHARED || { globalState: {}, sharedMethods: {} };
            return {
                globalState: shared.globalState,
                sharedMethods: shared.sharedMethods,
                allHistory: [],
                allStats: [],
                stats: {
                    treatedCount: 0,
                    cancelledCount: 0,
                    queueCount: 0
                },
                activeSchedDates: [],
                activeConfigs: {},
                allAvailability: {},
                showPatientModal: false,
                selectedPatient: {},
                patientHistory: [],
                localAppointments: [],
                totalToday: 0,
                leftToday: 0,
                pendingRequestsCount: 0,
                nextPatientData: null
            }
        },
        computed: {
            statCards() {
                return [
                    { title: 'Total Appointments Today', value: this.totalToday, bgColor: 'rgba(78, 115, 223, 0.1)', iconColor: '#4e73df', icon: 'bi-calendar3' },
                    { title: 'Appointments Left', value: this.leftToday, bgColor: 'rgba(246, 194, 62, 0.15)', iconColor: '#f6c23e', icon: 'bi-hourglass-split' },
                    { title: 'Pending Requests', value: this.pendingRequestsCount, bgColor: 'rgba(28, 200, 138, 0.1)', iconColor: '#1cc88a', icon: 'bi-person-plus-fill' }
                ];
            },
            appointments() { return this.localAppointments || []; },
            requests() { return this.globalState.requests || []; },
            treatedCount() { return this.stats.treatedCount || 0; },
            cancelledCount() { return this.stats.cancelledCount || 0; },
            queueCount() { return this.stats.queueCount || 0; },
            nextPatient() {
                return this.nextPatientData;
            }
        },
        async mounted() {
            console.log("Dashboard Mounted. Fetching initial data...");
            await this.fetchData();
            this.initAvailabilityCalendar();
        },
        unmounted() {
        },
        methods: {
            async fetchData() {
                console.log("Fetching Dashboard Data...");
                let data = null;
                if (this.sharedMethods && this.sharedMethods.fetchGlobalData) {
                    data = await this.sharedMethods.fetchGlobalData();
                }

                if (data) {
                    this.localAppointments = data.appointments || [];
                    this.allHistory = data.history || [];
                    this.allStats = data.stats || [];
                    this.stats = {
                        treatedCount: data.treated_count || 0,
                        cancelledCount: data.cancelled_count || 0,
                        queueCount: data.queue_count || 0
                    };
                    
                    this.totalToday = data.total_today || 0;
                    this.leftToday = data.left_today || 0;
                    this.pendingRequestsCount = data.pending_requests_count || 0;
                    this.nextPatientData = data.next_patient;
                    this.allAvailability = data.availability || {};
                    nextTick(() => this.renderChart());
                }
            },

            viewFile(path) { window.open(path, '_blank'); },

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
            },
            async fetchPageData() { await this.fetchData(); },
            async fetchPageData() { await this.fetchData(); },
            async startVisit(id) {
                const confirmed = await this.sharedMethods.showConfirm(
                    "Initiate Visit?",
                    "This will automatically mark the current ongoing patient as 'Completed'. Are you sure?"
                );

                if (confirmed) {
                    try {
                        const res = await fetch(`/doctor/api/appointment/start/${id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        });

                        const result = await res.json();
                        if (result.status === "success") {
                            this.sharedMethods.showToast("Visit started successfully!");
                            window.location.href = "/doctor/ongoing-appointment";
                        } else {
                            this.sharedMethods.showToast("Error: " + result.message, "error");
                        }
                    } catch (error) {
                        this.sharedMethods.showToast("Failed to start appointment.", "error");
                    }
                }
            },
            formatDate(dateStr) {
                if (!dateStr) return '';
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            },
            async initAvailabilityCalendar() {
                nextTick(() => {
                    const el = document.getElementById('inlineCalendar');
                    if (!el) return;

                    const today = new Date().toISOString().split('T')[0];
                    flatpickr(el, {
                        inline: true,
                        mode: "multiple",
                        dateFormat: "Y-m-d",
                        minDate: "today",
                        defaultDate: [today],
                        onChange: (selectedDates, dateStr) => {
                            const newDates = dateStr ? dateStr.split(', ') : [];
                            Object.keys(this.activeConfigs).forEach(d => {
                                if (!newDates.includes(d)) delete this.activeConfigs[d];
                            });
                            newDates.forEach(d => {
                                if (!this.activeConfigs[d]) {
                                    const existing = this.allAvailability[d] || [];
                                    this.activeConfigs[d] = existing.length > 0
                                        ? existing.map(r => ({ start: r.split('-')[0], end: r.split('-')[1] }))
                                        : [{ start: '09:00', end: '10:00' }];
                                }
                            });
                            this.activeSchedDates = newDates.sort();
                        }
                    });

                    this.activeSchedDates = [today];
                    const existingToday = this.allAvailability[today] || [];
                    this.activeConfigs[today] = existingToday.length > 0
                        ? existingToday.map(r => ({ start: r.split('-')[0], end: r.split('-')[1] }))
                        : [{ start: '09:00', end: '10:00' }];
                });
            },
            addSlot(date) { if (this.activeConfigs[date]) this.activeConfigs[date].push({ start: '09:00', end: '10:00' }); },
            removeSlot(date, i) { if (this.activeConfigs[date]) this.activeConfigs[date].splice(i, 1); },
            async viewPatientDetail(appt) {
                this.selectedPatient = {
                    id: appt.patient_id,
                    name: appt.patient_name,
                    pic: appt.patient_pic,
                    gender: appt.patient_gender,
                    age: appt.patient_age,
                    note: appt.urgent_note || "Reason not specified",
                    internal_notes: appt.internal_notes || ""
                };
                this.patientHistory = [];
                this.showPatientModal = true;
                this.fetchPatientHistory(appt.patient_id);
            },
            async viewRequestDetail(req) {
                this.selectedPatient = {
                    id: req.patient_id,
                    name: req.name,
                    pic: req.pic,
                    gender: req.gender,
                    age: req.age,
                    note: req.note || "Reason not specified",
                    internal_notes: req.internal_notes || ""
                };
                this.patientHistory = [];
                this.showPatientModal = true;
                this.fetchPatientHistory(req.patient_id);
            },
            async fetchPatientHistory(patientId) {
                try {
                    const res = await fetch(`/doctor/api/doctor/patient-history/${patientId}`);
                    if (res.ok) this.patientHistory = await res.json();
                } catch (e) { console.error("Failed to fetch history:", e); }
            },
            async saveAvailability() {
                if (this.activeSchedDates.length === 0) {
                    this.sharedMethods.showToast("Please select at least one date.", "error");
                    return;
                }
                Object.keys(this.activeConfigs).forEach(date => {
                    this.allAvailability[date] = this.activeConfigs[date].map(s => `${s.start}-${s.end}`);
                });
                try {
                    const res = await fetch('/doctor/api/doctor/update-availability', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(this.allAvailability)
                    });
                    if (res.ok) this.sharedMethods.showToast(`Schedule updated!`);
                } catch (e) { this.sharedMethods.showToast("Failed to save.", "error"); }
            },
            renderChart() {
                const canvas = document.getElementById('summaryChart');
                if (!canvas) return;
                const existingChart = Chart.getChart(canvas);
                if (existingChart) existingChart.destroy();
                new Chart(canvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: ['Treated', 'Cancelled', 'In Queue'],
                        datasets: [{
                            data: [this.stats.treatedCount, this.stats.cancelledCount, this.stats.queueCount],
                            backgroundColor: ['#1cc88a', '#e74a3b', '#4e73df'],
                            borderWidth: 0, cutout: '75%', borderRadius: 5
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } }
                    },
                    plugins: [{
                        id: 'centerText',
                        beforeDraw: (chart) => {
                            const { width, height, ctx } = chart;
                            ctx.restore();
                            
                            
                            ctx.font = `bold 2.5em Outfit, sans-serif`;
                            ctx.textBaseline = "middle";
                            ctx.fillStyle = "#1a202c";
                            const total = (this.stats.treatedCount || 0) + (this.stats.cancelledCount || 0) + (this.stats.queueCount || 0);
                            const text = total.toString();
                            const textX = Math.round((width - ctx.measureText(text).width) / 2);
                            ctx.fillText(text, textX, height / 2 - 5);

                            
                            ctx.font = `bold 0.75rem Inter, sans-serif`;
                            ctx.fillStyle = "#718096";
                            const label = "TOTAL";
                            const labelX = Math.round((width - ctx.measureText(label).width) / 2);
                            ctx.fillText(label, labelX, height / 2 + 25);
                            
                            ctx.save();
                        }
                    }]
                });
            }
        }
    });

    if (window.HMS_DOCTOR_SHARED && window.HMS_DOCTOR_SHARED.sharedMethods.registerDirectives) {
        window.HMS_DOCTOR_SHARED.sharedMethods.registerDirectives(app);
    }
    app.mount('#doctor-app');
})();