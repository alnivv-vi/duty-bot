require('moment/locale/ru');
const vercelEdgeService = require('./vercel-edge-service');

class Greenstreak {
    async _checkGreenStreak() {
       return await vercelEdgeService._checkDates()
    };
}

module.exports = (function () {
    return new Greenstreak();
})();

