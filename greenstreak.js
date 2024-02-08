const {WebClient} = require('@slack/web-api');
const moment = require('moment');
require('moment/locale/ru');
const vercelEdgeService = require('./vercel-edge-service');

class Greenstreak {
    async _checkGreenStreak(channelId) {
       return await vercelEdgeService._checkDates()
    };

    async _buildGreenStreakMsg() {

    };

}

module.exports = (function () {
    return new Greenstreak();
})();

