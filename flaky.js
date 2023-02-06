const slackService = require('./slack-service');
const axios = require('axios');
const HTMLParser = require('node-html-parser');

class Flaky {

    async start(rateValue) {
        let testCases = await this._getTestCasesUrls();
        await this._getSuccessRate(testCases, rateValue);
    }

    getFlakyData() {
        return this._flakyData;
    }

    async _fetchTestCases() {
        let res = await axios.get(process.env.ALLURE_URL);
        return res.data
    }

    async _getTestCasesUrls() {
        let document = await this._fetchTestCases();
        const root = HTMLParser.parse(document);
        let linksRaw = root.getElementsByTagName('a');
        let hrefs = [];
        linksRaw.forEach(element => hrefs.push(element.rawAttrs));
        let jsonLinks = hrefs.filter(value => /(\.json).*/.test(value));
        let urls = [];
        jsonLinks.forEach(element => urls.push(process.env.ALLURE_URL + element.toString().replace('href="', '').slice(0, -1)));
        return urls;
    }

    async _getSuccessRate(testCases, rateValue) {
        const result = [];
        let start = Date.now();
        for (let i = 0; i < 100; i++) {
            try {
                let res = await axios.get(testCases[i], {timeout:10000});
                let data = res.data;
                if (!data.extra.history || data.status === "skipped") continue;
                let statistic = data.extra.history.statistic;
                let successRate = statistic.passed / statistic.total * 100;
                let roundSuccessRate = Math.round(successRate * 100) / 100
                if (roundSuccessRate > rateValue) continue;
                let name = data.name;
                let testCaseSuccess = `${name}: ${roundSuccessRate}%`;
                result.push(testCaseSuccess);
            }
            catch (error) {
                console.log('Ошибка при получении данных с сервера allure');
            }
        }
        result.sort(this.customSort);
        let itemsCount = result.length;
        let chunkCount = Math.floor(itemsCount / 50);
        let chunkSize = Math.floor(itemsCount / chunkCount);
        let data = await slackService._sliceIntoChunks(result, chunkSize);
        this._flakyData = {itemsCount: itemsCount, chunkCount: chunkCount, message: data};
        let end = Date.now();
        console.log(`Скрипт flaky отработал за ${end - start} миллисекунд`);
        console.log(this._flakyData);
    }

    customSort = function (a, b) {
        return (Number(a.match(/(\d+)/g)[0]) - Number((b.match(/(\d+)/g)[0])));
    }
}

module.exports = (function () {
    return new Flaky();
})();

