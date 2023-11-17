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
        this._dutyId = undefined;
        this._dutyName = undefined;
        axios({method: 'get',
            url: process.env.GOOGLE_SCRIPT_URL,
            timeout: 15000,
            signal: AbortSignal.timeout(15000)})
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

