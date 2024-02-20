require('moment/locale/ru');
const vercelEdgeService = require('./vercel-edge-service');

class Greenstreak {
    async _checkGreenStreak() {
       return await vercelEdgeService._checkDates()
    };

    async _getGreenStreakLength() {
        return await vercelEdgeService._getGreenstreakLength()
    };
}

module.exports = (function () {
    return new Greenstreak();
})();

