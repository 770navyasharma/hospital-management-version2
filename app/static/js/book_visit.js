const { createApp } = Vue;

createApp({
    delimiters: ['[[', ']]'],
    directives: { 'click-outside': clickOutside },
    data() {
        return {
            globalState,
            sharedMethods,
            searchQuery: '',
            selectedDepts: [],
            departments: window.allDepts || [],
            doctors: window.allDoctors || [],
            showDetailModal: false,
            selectedDoc: null,
            todaySlots: [],
            
            showBookingModal: false,
            selectedDoctor: null,
            selectedDate: '',
            selectedSlot: null,
            availableSlots: [],
            bookedIntervals: [],
            isUrgent: false,
            urgentNote: '',
            medicalHistory: '',
            loading: false,
            selectedTime: '',
            timePicker: null,
            showConfirmModal: false,
            nowClock: new Date()
        }
    },
    computed: {
        filteredDoctors() {
            return this.doctors.filter(doc => {
                const q = this.searchQuery.toLowerCase().trim();
                const matchesSearch = !q || 
                    doc.name.toLowerCase().includes(q) ||
                    doc.dept.toLowerCase().includes(q) ||
                    (doc.degree && doc.degree.toLowerCase().includes(q)) ||
                    (doc.bio && doc.bio.toLowerCase().includes(q)) ||
                    (doc.tagline && doc.tagline.toLowerCase().includes(q));

                const matchesDept = this.selectedDepts.length === 0 || 
                                    this.selectedDepts.includes(doc.dept);

                return matchesSearch && matchesDept;
            });
        },
        sevenDays() {
            const days = [];
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            for (let i = 0; i < 7; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() + i);
                
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                days.push({
                    value: `${yyyy}-${mm}-${dd}`,
                    dayShort: i === 0 ? 'Today' : dayNames[d.getDay()],
                    dateNum: d.getDate(),
                    monthShort: monthNames[d.getMonth()]
                });
            }
            return days;
        },
        isTodaySelected() {
            return this.selectedDate === this.getTodayStr();
        },
        leadTimeThreshold() {
            const bufferNow = new Date(this.nowClock.getTime() + 20 * 60000);
            return bufferNow.getHours().toString().padStart(2, '0') + ":" + bufferNow.getMinutes().toString().padStart(2, '0');
        }
    },
    watch: {
        selectedSlot(newSlot) {
            if (newSlot) {
                const now = new Date();
                const todayStr = this.getTodayStr();
                let minTime = newSlot.start;

                if (this.selectedDate === todayStr) {
                    const threshold = this.leadTimeThreshold;
                    if (threshold > minTime) minTime = threshold;
                }

                this.selectedTime = minTime;

                this.$nextTick(() => {
                    const el = document.getElementById("specificTime");
                    if (el) {
                        if (this.timePicker) this.timePicker.destroy();
                        this.timePicker = flatpickr("#specificTime", {
                            enableTime: true,
                            noCalendar: true,
                            dateFormat: "H:i",
                            time_24hr: true,
                            defaultDate: minTime,
                            minTime: minTime,
                            maxTime: newSlot.end,
                            onChange: (selectedDates, timeStr) => {
                                this.selectedTime = timeStr;
                            }
                        });
                    }
                });
            } else {
                this.selectedTime = '';
                if (this.timePicker) {
                    this.timePicker.destroy();
                    this.timePicker = null;
                }
            }
        }
    },
    methods: {
        toggleDept(deptName) {
            const index = this.selectedDepts.indexOf(deptName);
            if (index > -1) this.selectedDepts.splice(index, 1);
            else this.selectedDepts.push(deptName);
        },

        resetFilters() {
            this.searchQuery = '';
            this.selectedDepts = [];
        },

        selectDay(dateValue) {
            this.selectedDate = dateValue;
            this.selectedSlot = null;
            this.selectedTime = '';
            this.availableSlots = [];
            this.bookedIntervals = [];
            this.fetchAvailableSlots();
        },

        openConfirmModal() {
            if (!this.selectedSlot) {
                sharedMethods.showToast('Please select a slot first.', 'warning');
                return;
            }
            this.showConfirmModal = true;
        },

        midpointDisplay(slot) {
            const sStart = this.timeToMinutes(slot.start);
            const sEnd = this.timeToMinutes(slot.end);
            const mid = Math.round((sStart + sEnd) / 2);
            const h = Math.floor(mid / 60);
            const m = mid % 60;
            const suffix = h >= 12 ? 'PM' : 'AM';
            const hr = h % 12 || 12;
            return `${hr}:${String(m).padStart(2, '0')} ${suffix}`;
        },

        async seeFullDetails(doctor) {
            this.selectedDoc = doctor;
            this.todaySlots = [];
            
            
            const modalEl = document.getElementById('doctorDetailModal');
            let modalBus = bootstrap.Modal.getInstance(modalEl);
            if (!modalBus) modalBus = new bootstrap.Modal(modalEl);
            modalBus.show();
            
            const today = new Date().toISOString().split('T')[0];
            try {
                const res = await fetch(`/patient/api/doctor-availability/${doctor.id}/${today}`);
                if (res.ok) {
                    const data = await res.json();
                    this.todaySlots = data.available_slots || [];
                }
            } catch (e) {
                console.error("Failed to fetch today's slots:", e);
            }
        },

        openBookingModal(doctor) {
            this.selectedDoctor = doctor;
            this.selectedDate = '';
            this.selectedSlot = null;
            this.availableSlots = [];
            this.bookedIntervals = []; 
            this.isUrgent = false;
            this.urgentNote = '';
            this.medicalHistory = globalState.patientProfile?.medical_history || '';
            this.showBookingModal = true;

            
            const detailModalEl = document.getElementById('doctorDetailModal');
            if (detailModalEl) {
                const modalBus = bootstrap.Modal.getInstance(detailModalEl);
                if (modalBus) modalBus.hide();
            }
        },

        async fetchAvailableSlots() {
            if (!this.selectedDoctor || !this.selectedDate) return;
            try {
                const res = await fetch(`/patient/api/doctor-availability/${this.selectedDoctor.id}/${this.selectedDate}`);
                if (res.ok) {
                    const data = await res.json();
                    this.availableSlots = data.available_slots || [];
                    this.bookedIntervals = data.booked_intervals || [];
                }
            } catch (e) {
                console.error("Failed to fetch slots:", e);
            }
        },

        selectSlot(slot) {
            this.selectedSlot = slot;
            let start = slot.start;
            if (this.isTodaySelected && start < this.leadTimeThreshold) {
                start = this.leadTimeThreshold;
            }
            this.selectedTime = start;
        },

        timeToMinutes(timeStr) {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        },

        getSlotDurationString(slot) {
            const mins = this.timeToMinutes(slot.end) - this.timeToMinutes(slot.start);
            if (mins >= 60) return `${(mins / 60).toFixed(1)}h`;
            return `${mins}m`;
        },

        getBusyIntervalsForSlot(slot) {
            const sStart = this.timeToMinutes(slot.start);
            const sEnd = this.timeToMinutes(slot.end);
            return this.bookedIntervals.filter(b => {
                const bStart = this.timeToMinutes(b.start);
                const bEnd = this.timeToMinutes(b.end);
                return bStart < sEnd && bEnd > sStart;
            });
        },

        getBusyBlockStyle(slot, busy) {
            const sStart = this.timeToMinutes(slot.start);
            const sEnd = this.timeToMinutes(slot.end);
            const totalWidth = sEnd - sStart;
            const bStart = Math.max(this.timeToMinutes(busy.start), sStart);
            const bEnd = Math.min(this.timeToMinutes(busy.end), sEnd);
            const left = ((bStart - sStart) / totalWidth) * 100;
            const width = ((bEnd - bStart) / totalWidth) * 100;
            return { left: `${left}%`, width: `${width}%` };
        },

        getBusyBlockWidth(slot, busy) {
            const sStart = this.timeToMinutes(slot.start);
            const sEnd = this.timeToMinutes(slot.end);
            const bStart = Math.max(this.timeToMinutes(busy.start), sStart);
            const bEnd = Math.min(this.timeToMinutes(busy.end), sEnd);
            return ((bEnd - bStart) / (sEnd - sStart)) * 100;
        },

        getSelectionPreviewStyle(slot) {
            if (!this.selectedTime) return { display: 'none' };
            const sStart = this.timeToMinutes(slot.start);
            const sEnd = this.timeToMinutes(slot.end);
            const totalWidth = sEnd - sStart;
            const selStart = this.timeToMinutes(this.selectedTime);
            const left = ((selStart - sStart) / totalWidth) * 100;
            const width = (30 / totalWidth) * 100;
            return { left: `${left}%`, width: `${width}%`, borderLeft: '2px solid #4e73df', zIndex: '4' };
        },

        getTodayStr() {
            const d = this.nowClock || new Date();
            const y = d.getFullYear();
            const m = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            return `${y}-${m}-${day}`;
        },

        getLeadTimeBlockStyle(slot) {
            if (!this.isTodaySelected) return { display: 'none' };
            
            const threshold = this.leadTimeThreshold;
            if (threshold <= slot.start) return { display: 'none' };
            
            const startMins = this.timeToMinutes(slot.start);
            const endMins = this.timeToMinutes(slot.end);
            const thresholdMins = this.timeToMinutes(threshold);
            
            const totalWidth = endMins - startMins;
            const deadWidth = Math.min(totalWidth, thresholdMins - startMins);
            
            const widthPct = (deadWidth / totalWidth) * 100;
            
            return {
                left: '0%',
                width: widthPct + '%',
                backgroundColor: '#94a3b8',
                opacity: '0.6',
                zIndex: '3',
                borderRadius: 'inherit'
            };
        },

        formatDate(dateStr) {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
        },

        formatTime(timeStr) {
            if (!timeStr) return '--:--';
            const [h, m] = timeStr.split(':');
            const hh = parseInt(h);
            const suffix = hh >= 12 ? 'PM' : 'AM';
            const hr = hh % 12 || 12;
            return `${hr}:${m} ${suffix}`;
        },

        async submitBooking() {
            if (!this.selectedSlot) return sharedMethods.showToast("Please select a time slot.", "warning");
            const finalTime = this.selectedTime || this.selectedSlot.start;

            if (this.isTodaySelected && finalTime < this.leadTimeThreshold) {
                return sharedMethods.showToast(`Please choose a time at least 20 minutes from now (${this.formatTime(this.leadTimeThreshold)}).`, "error");
            }

            this.loading = true;
            try {
                const res = await fetch('/patient/api/book', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        doctor_id: this.selectedDoctor.id,
                        datetime: `${this.selectedDate}T${finalTime}`,
                        is_urgent: this.isUrgent,
                        note: this.urgentNote,
                        medical_history: this.medicalHistory
                    })
                });
                if (res.ok) {
                    this.showConfirmModal = false;
                    this.showBookingModal = false;
                    sharedMethods.showToast("🎉 Appointment requested successfully! The doctor will confirm shortly.");
                    sharedMethods.fetchProfile(); // Sync back the history update
                } else {
                    const result = await res.json();
                    sharedMethods.showToast(result.message, "error");
                }
            } catch (e) {
                sharedMethods.showToast("Connection error. Please try again.", "error");
            } finally {
                this.loading = false;
            }
        },

        async fetchDoctorStatuses() {
            try {
                const res = await fetch('/patient/api/doctor-statuses');
                if (!res.ok) return;
                const statusMap = await res.json();
                this.doctors.forEach(doc => {
                    if (statusMap[doc.id] !== undefined) {
                        doc.status = statusMap[doc.id];
                    }
                });
                if (this.selectedDoc && statusMap[this.selectedDoc.id]) {
                    this.selectedDoc.status = statusMap[this.selectedDoc.id];
                }
                if (this.selectedDoctor && statusMap[this.selectedDoctor.id]) {
                    this.selectedDoctor.status = statusMap[this.selectedDoctor.id];
                }
            } catch (e) {
                console.warn('Could not fetch doctor statuses:', e);
            }
        }
    },
    mounted() {
        this.fetchDoctorStatuses();
        setInterval(() => this.fetchDoctorStatuses(), 60000);
        setInterval(() => { this.nowClock = new Date(); }, 10000);
    }
}).mount('#patient-app');
