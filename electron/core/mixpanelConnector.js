const { default: mixpanel } = require("mixpanel-browser");

async function initMixpanel() {
    mixpanel.init("4d0ba913c6c040932ce81d85babc6e3e", {
        autocapture: true,
        record_sessions_percentage: 100,
        api_host: "https://api-eu.mixpanel.com",
    });
}

module.exports = {
    initMixpanel
}