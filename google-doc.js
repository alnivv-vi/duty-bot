
class GoogleDocService {
    async start() {
        await this.fetchDutyData();
    }

    getActualDutyId() {
        return this._dutyId;
    }

    getActualDutyName() {
        return this._dutyName;
    }

    async fetchDutyData() {
        try {
            const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
                method: 'GET',
                timeout: 15000,
                signal: new AbortController().signal
            });
            const data = await response.json();
            this._dutyId = data.id;
            this._dutyName = data.duty;
            console.log(this._dutyName);
        } catch (error) {
            console.error(error);
        }
    }
}

module.exports = (function () {
    return new GoogleDocService();
})();

