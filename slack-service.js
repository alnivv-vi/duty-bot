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
        if (!compare) return;
        console.log(compare.lastFailedTestsUrl);
        let lastFailedTests = await this._getFailedTests(compare.lastFailedTestsUrl);
        console.log(compare.previousFailedTestsUrl);

        let previousFailedTests = await this._getFailedTests(compare.previousFailedTestsUrl);
        let diff = lastFailedTests.filter(x => !previousFailedTests.includes(x));
        let diffCount = diff.length;
        let chunkCount = Math.floor(diffCount / 20);
        let chunkSize = Math.floor(diffCount / chunkCount);
        let result = await this._sliceIntoChunks(diff, chunkSize);
        return {
            diffCount: diffCount,
            chunkCount: chunkCount,
            message: result,
            previousTagName: compare.previousTagName
        };
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
        if (filtered) {
            return await this._getMessagesToCompare(filtered)
        }
    }

    async _getFailedTests(reportUrl) {
        try {
            const dataChannelId = process.env.FAILED_ANALYTICS_CHANNEL;
            const web = new WebClient(process.env.SLACK_BOT_TOKEN);
            let response = await web.conversations.history({channel: dataChannelId});
            let responseObj = Object.values(response.messages);
            let raw = await this._filterByUrl(responseObj, reportUrl);
            let rawWithoutUrl = raw.replace(/<http:\S+failedRerunTests\.txt>/, '');
            return rawWithoutUrl.split('\n');
        } catch (error) {
            console.log('Ошибка при получении данных из failedRerunTests.txt');
        }
    };

    async _filterByUrl(responseObj, url) {
        try {
            let messages = [];

            responseObj.forEach(element => messages.push(element.text));
            let message = messages.find(el => el.includes(url));
            let index = messages.findIndex(el => el.includes(url));

            // Проверяем предыдущие сообщения.
            // Если перед сообщением со ссылкой на отчёт есть сообщение без ссылки, значит slack сплитил сообщение, и нужно его соединить
            let previousMessages = messages.slice(index + 1);
            let currentIndex = 0;
            let fullMessage = message;
            while (currentIndex < previousMessages.length) {
                if (currentIndex === 0 && previousMessages[currentIndex].includes("failedRerunTests.txt")) {
                    break;
                }
                if (!previousMessages[currentIndex].includes("failedRerunTests.txt")) {
                    fullMessage += previousMessages[currentIndex];
                    previousMessages.splice(currentIndex, 1);
                } else {
                    currentIndex++;
                }
            }
            return fullMessage;
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
            else (console.log('Тег не подходит под условия'));
        } catch (error) {
            console.log('Ошибка при фильтрации сообщений по группе');
        }
    };

    async _getMessagesToCompare(messages) {
        try {
            let lastTagName = messages[0];
            let lastFailedTestsUrl = lastTagName.match(/http:\S+failedRerunTests\.txt/)[0];
            let previousMessages = messages.slice(1);
            let previousMessage = [];
            let previousTagName = '';

            for (let message of previousMessages) {
                console.log(message);
                if(message.match(/\d+-canary.*/) || message.match(/\d+--acceptance.*/)) {
                    continue
                }
                let tagName = message.match(/\d+-master.*/)[0];
                if (tagName !== lastTagName) {
                    previousMessage = message;
                    previousTagName = tagName;
                    break;
                }
            }
            let previousFailedTestsUrl = previousMessage.match(/http:\S+failedRerunTests\.txt/)[0];

            return {
                lastFailedTestsUrl: lastFailedTestsUrl,
                previousFailedTestsUrl: previousFailedTestsUrl,
                previousTagName: previousTagName
            };

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

    async sendMsgToSiteQaAutomation(text) {
        const web = new WebClient(process.env.SLACK_BOT_TOKEN);
        await web.chat.postMessage({channel: process.env.SITE_QA_AUTOMATION_CHANNEL_ID, text: text})
    }

    declination(number) {
        let titles = ['тест', 'теста', 'тестов'];
        let cases = [2, 0, 1, 1, 1, 2];
        return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
    }
}

module.exports = (function () {
    return new SlackService();
})();

