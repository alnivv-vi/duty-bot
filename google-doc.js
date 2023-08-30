const axios = require('axios');

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
        axios
            .get( process.env.GOOGLE_SCRIPT_URL)
            .then(res => {
                this._dutyId = res.data.id;
                this._dutyName = res.data.duty;
                console.log(this._dutyName)
            })
            .catch(error => {
                console.error(error);
            });
    }

}

module.exports = (function () {
    return new GoogleDocService();
})();

