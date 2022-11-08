const {WebClient} = require('@slack/web-api');

class SlackService {
    /**
     * Получение объекта с данными по разнице прогонов.
     * Последний отчёт в канале сравнивается с предыдущим отчётом (с предыдущим тегом) по аналогичной группе тестов.
     *
     * Свойства возвращаемого объекта:
     * - diffCount - Количество новых упавших тестов,
     * - chunkCount - Количество частей (чанков), на которые нужно разбить сообщение,
     * чтобы обойти ограничение слака по количеству символов в одном сообщении.
     * - message - текст с сообщением, где отображаются уникальные упавшие тесты
     * @param {string} channelId - id канала, в котором получаем отчёты с упавшими тестами
     */
    async getDiff(channelId) {
        let compare = await this._getDataForCompare(channelId);
        let lastFailedTests = await this._getFailedTests(compare.lastTagName)
        let previousFailedTests = await this._getFailedTests(compare.previousTagName);
        let diffRaw = lastFailedTests.filter(x => !previousFailedTests.includes(x));
        // Удаление побочного элемента - ссылки на отчёт
        let diff = diffRaw.slice(0, -1);
        let diffCount = diff.length;
        let chunkCount = Math.floor(diffCount / 20);
        let chunkSize = Math.floor(diffCount / chunkCount);
        let result = await this._sliceIntoChunks(diff, chunkSize);
        return {diffCount: diffCount, chunkCount: chunkCount, message: result};
    }

    /**
     * Отправка ответа в тред к последнему сообщению
     * @param {string} channelId - id канала, в котором находится нужное сообщение
     * @param {string} text - текст ответа
     */
    async sendReplyToLastMsg(channelId, text) {
        const web = new WebClient(process.env.SLACK_BOT_TOKEN);
        let response = await web.conversations.history({channel: channelId});
        let responseObj = Object.values(response.messages);

        let timeStamp = responseObj[0].ts;
        await web.chat.postMessage({channel: channelId, text: text, thread_ts: timeStamp})
    }

    async _getDataForCompare(channelId) {
        let reports = await this._getReports(channelId);
        let filtered = await this._filterByGroup(reports);
        return await this._getMessagesToCompare(filtered)
    }

    async _getFailedTests(reportUrl) {
        const dataChannelId = process.env.FAILED_ANALYTICS_CHANNEL;
        const web = new WebClient(process.env.SLACK_BOT_TOKEN);
        let response = await web.conversations.history({channel: dataChannelId});
        let responseObj = Object.values(response.messages);
        let raw = await this._filterByUrl(responseObj, reportUrl);
        return raw.split('\n');
    };

    async _filterByUrl(responseObj, url) {
        try {
            let messages = [];
            responseObj.forEach(element => messages.push(element.text));
            return messages.find(el => el.includes(url));

        } catch (error) {
            console.log('Ошибка при поиске сообщения в канале #site-autotest-failed-analytics');
        }
    };

    async _getReports(channelId) {
        try {
            const web = new WebClient(process.env.SLACK_BOT_TOKEN);
            let response = await web.conversations.history({channel: channelId});
            let responseObj = Object.values(response.messages);
            let messages = [];
            responseObj.forEach(element => messages.push(element.text));
            return messages.filter(value => /(\/failedRerunTests\.txt).*/.test(value))
        } catch (error) {
            console.log('Ошибка при получении сообщений с отчётами в канале #site-autotest-report-prod');
        }
    };

    async _filterByGroup(messages) {
        try {
            if (messages[0].match(/-acceptance.*/)) return messages.filter(value => /-acceptance.*/.test(value));
            else if (messages[0].match(/-api.*/)) return messages.filter(value => /-api.*/.test(value));
            else if (messages[0].match(/-backend.*/)) return messages.filter(value => /-backend.*/.test(value));
        } catch (error) {
            console.log('Ошибка при фильтрации сообщений по группе');
        }
    };

    async _getMessagesToCompare(messages) {
        try {
            let lastMessage = messages[0]
            let lastTagName = lastMessage.match(/\d+-master.*/)[0];
            let lastFailedTestsUrl = lastMessage.match(/http:\S+failedRerunTests\.txt/)[0];
            let previousMessages = messages.slice(1);
            let previousMessage = [];
            let previousTagName = '';

            for (let message of previousMessages) {
                let tagName = message.match(/\d+-master.*/)[0]
                if (tagName !== lastTagName) {
                    previousMessage = message
                    previousTagName = tagName
                    break;
                }
            }
            let previousFailedTestsUrl = previousMessage.match(/http:\S+failedRerunTests\.txt/)[0];

            return {lastTagName: lastFailedTestsUrl, previousTagName: previousFailedTestsUrl};

        } catch (error) {
            console.log('Не удалось получить данные для сравнения');
        }
    };

    async _sliceIntoChunks(arr, chunkSize) {
        const res = [];
        for (let i = 0; i < arr.length; i += chunkSize) {
            const chunk = arr.slice(i, i + chunkSize);
            res.push(chunk);
        }
        return res;
    }
}

module.exports = (function () {
    return new SlackService();
})();

