(function () {
    const { createApp } = Vue;

    const app = createApp({
        delimiters: ['[[', ']]'],
        data() {
            const shared = window.HMS_DOCTOR_SHARED || { globalState: {}, sharedMethods: {} };
            return {
                globalState: shared.globalState,
                sharedMethods: shared.sharedMethods,
                pageLoading: true   
            }
        },
        async mounted() {
            console.log("Ongoing Page Initializing...");
            if (this.sharedMethods && this.sharedMethods.fetchGlobalData) {
                await this.sharedMethods.fetchGlobalData();
            }
            
            this.pageLoading = false;
        },
        unmounted() {
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
