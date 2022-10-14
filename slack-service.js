const {WebClient} = require('@slack/web-api');
const fetch = require('node-fetch');

class SlackService {
    async getData(channelId) {
        let messages = await this._getMessagesFromChannel(channelId);
        let filtered = await this._filterByGroup(messages);
        let compare = await this._getMessagesToCompare(filtered);
        let lastFailedTests = await this._getFailedTests(compare.lastTagName)
        let previousFailedTests = await this._getFailedTests(compare.previousTagName)
        let diff = await lastFailedTests.filter(x => !previousFailedTests.includes(x));
        let diffCount = diff.length;
        console.log(diffCount);
        let chunkCount = Math.floor(diffCount / 20);
        let chunkSize = Math.floor(diffCount / chunkCount);
        console.log(chunkCount);
        let result = await this.sliceIntoChunks(diff, chunkSize);
        console.log(result)
        return {diffCount: diffCount, chunkCount: chunkCount, message: result};
    }

    async sendReply(channelId, text) {
        const web = new WebClient(process.env.SLACK_BOT_TOKEN);
        let response = await web.conversations.history({channel: channelId});
        let responseObj = Object.values(response.messages);

        let timeStamp = responseObj[0].ts;
        await web.chat.postMessage({channel: channelId, text: text, thread_ts: timeStamp})
    }

    async _getFailedTests(tagName) {
        let raw = await this._getContent(tagName);
        return raw.split('\n');
    };

    async _getContent(url, callback) {
        let res = await fetch(url),
            ret = await res.text();
        return callback ? callback(ret) : ret;
    };

    async sliceIntoChunks(arr, chunkSize) {
        const res = [];
        for (let i = 0; i < arr.length; i += chunkSize) {
            const chunk = arr.slice(i, i + chunkSize);
            res.push(chunk);
        }
        return res;
    }

    async _getMessagesFromChannel(channelId) {
        const web = new WebClient(process.env.SLACK_BOT_TOKEN);
        try {
            let response = await web.conversations.history({channel: channelId});
            console.log(response);
            let responseObj = Object.values(response.messages);
            console.log(responseObj);


            let messages = [];
            responseObj.forEach(element => messages.push(element.text));
            return messages.filter(value => /(\/failedRerunTests\.txt).*/.test(value))

        } catch (error) {
            console.log('Ошибка при получении сообщений в канале');
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

}

module.exports = (function () {
    return new SlackService();
})();

