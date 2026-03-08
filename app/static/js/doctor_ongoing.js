(function () {
    const { createApp } = Vue;

    const app = createApp({
        delimiters: ['[[', ']]'],
        data() {
            const shared = window.HMS_DOCTOR_SHARED || { globalState: {}, sharedMethods: {} };
            return {
                globalState: shared.globalState,
                sharedMethods: shared.sharedMethods,
                pageLoading: true   // ← prevents "No Active Session" flash on first load
            }
        },
        async mounted() {
            console.log("Ongoing Page Initializing...");
            if (this.sharedMethods && this.sharedMethods.fetchGlobalData) {
                await this.sharedMethods.fetchGlobalData();
            }
            // Hide spinner ONLY after real data has loaded
            this.pageLoading = false;

            // Keep data fresh every 10s
            this.pollInterval = setInterval(async () => {
                if (this.sharedMethods && this.sharedMethods.fetchGlobalData) {
                    await this.sharedMethods.fetchGlobalData();
                }
            }, 10000);
        },
        unmounted() {
            if (this.pollInterval) clearInterval(this.pollInterval);
        },
        methods: {
            async fetchPageData() {
                if (this.sharedMethods && this.sharedMethods.fetchGlobalData) {
                    await this.sharedMethods.fetchGlobalData();
                }
            }
        }
    });

    if (window.HMS_DOCTOR_SHARED && window.HMS_DOCTOR_SHARED.sharedMethods.registerDirectives) {
        window.HMS_DOCTOR_SHARED.sharedMethods.registerDirectives(app);
    }
    app.mount('#doctor-app');
})();
